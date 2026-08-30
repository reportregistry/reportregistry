import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { normalizePhone } from '@/lib/phone';

const MAX_ROWS = 500;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Phone-ish: an optional +, then digits with optional spaces/dashes/dots/
// parens between them, at least 7 digits total -- loose on purpose so
// international formats still match, tight enough to skip stray numbers.
const PHONE_REGEX = /\+?\(?\d[\d\-.\s()]{5,}\d/g;

// No fixed columns -- just paste whatever list you have (one entry per
// line, any format: "555-1234, John, scammed me", a bare number, a name
// and an email, etc). Every email and phone-like sequence on the line is
// pulled out automatically; whatever text is left over becomes the report
// notes. This trades a little precision for "just paste it and go."
function parseLine(line: string): { phones: string[]; emails: string[]; remainder: string } {
  const emails = (line.match(EMAIL_REGEX) || []).map((e) => e.toLowerCase());
  let remaining = line;
  emails.forEach((e) => {
    remaining = remaining.replace(new RegExp(e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
  });

  const phoneMatches = remaining.match(PHONE_REGEX) || [];
  const phones = phoneMatches
    .map((p) => normalizePhone(p))
    .filter((p): p is string => p !== null && p.length >= 7);
  phoneMatches.forEach((p) => {
    remaining = remaining.replace(p, ' ');
  });

  const remainder = remaining
    .replace(/^[\s,;:\-|]+|[\s,;:\-|]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { phones, emails, remainder };
}

// Subscriber-only: lets a paying subscriber paste a whole list of reports
// at once instead of filing them one by one through the public form. Rows
// still land as 'pending' like any other report -- being a subscriber
// doesn't skip moderation, it just unlocks the bulk-paste tool.
export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { data: subscriber } = await supabase
    .from('subscribers')
    .select('status')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (subscriber?.status !== 'active') {
    return NextResponse.json(
      { error: 'An active subscription is required to bulk-report.' },
      { status: 403 }
    );
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const lines = (body.text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return NextResponse.json({ error: 'Paste at least one line.' }, { status: 400 });
  }
  if (lines.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Max ${MAX_ROWS} rows per submission -- split into batches.` },
      { status: 400 }
    );
  }

  const user = await currentUser();
  const reporterEmail = user?.emailAddresses?.[0]?.emailAddress || null;
  const reporterPhone = normalizePhone(user?.phoneNumbers?.[0]?.phoneNumber) || null;

  const rowsToInsert: Record<string, unknown>[] = [];
  const skipped: { line: number; reason: string }[] = [];

  lines.forEach((line, i) => {
    const { phones, emails, remainder } = parseLine(line);

    if (phones.length === 0 && emails.length === 0) {
      skipped.push({
        line: i + 1,
        reason: "Couldn't find a phone number or email on this line.",
      });
      return;
    }

    const description = remainder || 'Bulk-submitted report (no additional details provided).';

    rowsToInsert.push({
      phone_numbers: phones,
      subject_emails: emails,
      subject_first_name: null,
      scam_type: [],
      description,
      reporter_email: reporterEmail,
      reporter_phone: reporterPhone,
      reporter_clerk_user_id: userId,
      evidence_urls: [],
      status: 'pending',
    });
  });

  if (rowsToInsert.length === 0) {
    return NextResponse.json(
      { error: 'None of the pasted rows had a usable phone number or email.', skipped },
      { status: 400 }
    );
  }

  const { error } = await supabase.from('reports').insert(rowsToInsert);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: rowsToInsert.length, skipped });
}
