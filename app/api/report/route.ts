import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { normalizePhone } from '@/lib/phone';
import { verifyTurnstileToken } from '@/lib/turnstile';

const SCAM_TYPES = [
  'Scammer/Spam Caller',
  'Fake Email/Link',
  'Flake-No Show',
  'Threats/Dangerous',
  'Fake Payment',
  'Other',
];

function cleanEmail(raw: FormDataEntryValue | null): string | null {
  const v = (raw as string)?.trim().toLowerCase();
  return v || null;
}

// Keeps only the first word of whatever was typed, so "John Smith" becomes
// "John" -- last names aren't collected, by design.
function firstNameOnly(raw: FormDataEntryValue | null): string | null {
  const v = (raw as string)?.trim();
  if (!v) return null;
  return v.split(/\s+/)[0] || null;
}

// Filing a report is always free, but requires a signed-in account
// (enforced by middleware.ts -- this route is in the protected list, so
// userId below is never actually null in practice; the check is just
// defense in depth). Reporter contact info comes straight from their
// Clerk account rather than a manual form field, since they're always
// signed in here. New reports land as 'pending' and only show up in
// search once approved (see supabase/schema.sql for the moderation
// workflow).
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const formData = await req.formData();

    const turnstileToken = formData.get('cf-turnstile-response') as string | null;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    const humanVerified = await verifyTurnstileToken(turnstileToken, ip);
    if (!humanVerified) {
      return NextResponse.json(
        { error: 'Captcha verification failed. Please try again.' },
        { status: 400 }
      );
    }

    const phones = [
      normalizePhone(formData.get('phone_number') as string),
      normalizePhone(formData.get('phone_number_2') as string),
    ].filter((p): p is string => Boolean(p));

    const emails = [
      cleanEmail(formData.get('subject_email')),
      cleanEmail(formData.get('subject_email_2')),
    ].filter((e): e is string => Boolean(e));

    const subject_first_name = firstNameOnly(formData.get('subject_name'));

    const scam_type_raw = (formData.get('scam_type') as string) || '';
    const scam_type = SCAM_TYPES.includes(scam_type_raw) ? scam_type_raw : null;
    const otherDetails = (formData.get('scam_type_other') as string)?.trim();

    let description = (formData.get('description') as string)?.trim() || '';
    if (scam_type === 'Other' && otherDetails) {
      // Admin-only detail on what "Other" means here -- never surfaced by
      // the search API, same as the rest of `description`.
      description = `[Other: ${otherDetails}] ${description}`.trim();
    }

    const file = formData.get('evidence') as File | null;

    if ((phones.length === 0 && emails.length === 0) || !description) {
      return NextResponse.json(
        { error: 'A phone number or email for the person you\'re reporting, plus a description, are required.' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    const evidence_urls: string[] = [];

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(path, bytes, { contentType: file.type });

      if (uploadError) {
        return NextResponse.json(
          { error: `Could not upload evidence: ${uploadError.message}` },
          { status: 500 }
        );
      }

      const { data: publicUrl } = supabase.storage
        .from('evidence')
        .getPublicUrl(path);
      evidence_urls.push(publicUrl.publicUrl);
    }

    // Reporter contact comes from their Clerk account (they're always
    // signed in to reach this route) -- kept private, never shown to
    // subscribers or the public, used only to follow up on disputes.
    const reporterUser = await currentUser();
    const finalReporterEmail = reporterUser?.emailAddresses?.[0]?.emailAddress || null;
    const finalReporterPhone =
      normalizePhone(reporterUser?.phoneNumbers?.[0]?.phoneNumber) || null;

    const { error: insertError } = await supabase.from('reports').insert({
      phone_numbers: phones,
      subject_emails: emails,
      subject_first_name,
      scam_type,
      description,
      reporter_email: finalReporterEmail,
      reporter_phone: finalReporterPhone,
      evidence_urls,
      status: 'pending',
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'Unexpected error submitting report.' },
      { status: 500 }
    );
  }
}
