import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic';

const CATEGORIES = [
  'Scammer/Spam Caller',
  'Fake Email/Link',
  'Flake-No Show',
  'Threats/Dangerous',
  'Fake Payment',
  'Other',
];

const EMPTY_RESULT = { phone_numbers: [], emails: [], category: null, summary: '' };

// "Smart report": reads an uploaded screenshot (a text conversation,
// email, etc.), pulls out any phone numbers/emails it can find, and
// suggests a category. Best-effort only -- the reporter can and should
// review/edit everything before submitting. If ANTHROPIC_API_KEY isn't
// configured, this quietly returns an empty result instead of erroring,
// so the rest of the report form still works without it.
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(EMPTY_RESULT);
  }

  try {
    const formData = await req.formData();
    const file = formData.get('evidence') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `This screenshot is being submitted as evidence for a scam/spam report. Read it and respond with ONLY raw JSON, no markdown fences, no commentary, in exactly this shape:
{"phone_numbers": string[], "emails": string[], "category": one of ${JSON.stringify(CATEGORIES)} or null, "summary": string}

- phone_numbers / emails: any that visibly appear in the screenshot. Empty arrays if none.
- category: your best-guess classification of the behavior shown, or null if it's unclear.
- summary: one or two short, factual sentences describing what's shown. No speculation or exaggeration -- just what's visibly there.`,
            },
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const raw = textBlock && 'text' in textBlock ? textBlock.text : '{}';
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '');

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = EMPTY_RESULT;
    }

    return NextResponse.json({
      phone_numbers: Array.isArray(parsed.phone_numbers) ? parsed.phone_numbers : [],
      emails: Array.isArray(parsed.emails) ? parsed.emails : [],
      category: CATEGORIES.includes(parsed.category) ? parsed.category : null,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    });
  } catch {
    // Best-effort feature -- fail quietly rather than blocking the report.
    return NextResponse.json(EMPTY_RESULT);
  }
}
