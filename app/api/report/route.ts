import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { normalizePhone } from '@/lib/phone';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { isValidPhoneNumber } from '@/lib/phoneLookup';
import { SCAM_TYPES } from '@/lib/scamTypes';

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

// Filing a report is always free and does NOT require an account
// (middleware.ts deliberately leaves this route unprotected). If the
// filer is signed in, their reporter contact info comes straight from
// their Clerk account. If not, the form requires them to manually type
// their own name + phone/email instead, so every report stays
// traceable even from anonymous filers. New reports land as 'pending'
// and only show up in search once approved (see supabase/schema.sql for
// the moderation workflow).
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();

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

    // One report can have more than one category (e.g. a no-show who was
    // also threatening), so this is every valid value the client sent,
    // deduped -- not just the first one.
    const scam_type = Array.from(
      new Set(formData.getAll('scam_type').filter((t): t is string => SCAM_TYPES.includes(t as string)))
    );
    const otherDetails = (formData.get('scam_type_other') as string)?.trim();

    let description = (formData.get('description') as string)?.trim() || '';
    if (scam_type.includes('Other') && otherDetails) {
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

    // Real-number check via Twilio Lookup (lib/phoneLookup.ts) -- catches
    // typos and made-up numbers before they land in the registry. Skipped
    // entirely if TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN aren't configured,
    // and fails open (treats as valid) on a Twilio outage, so this can
    // never be the reason a legitimate report with a working phone
    // number gets rejected.
    if (phones.length > 0) {
      const validity = await Promise.all(phones.map((p) => isValidPhoneNumber(p)));
      const invalidPhones = phones.filter((_, i) => !validity[i]);
      if (invalidPhones.length > 0) {
        return NextResponse.json(
          {
            error: `This doesn't look like a real phone number: ${invalidPhones.join(', ')}. Double-check it and try again.`,
          },
          { status: 400 }
        );
      }
    }

    // Reporter contact: pulled from Clerk if signed in, otherwise from the
    // manually-typed "Your info" fields (required client-side when signed
    // out, re-checked here server-side too, and checked before the evidence
    // upload below so a rejected anonymous submission doesn't still write a
    // file to storage). Kept private either way, never shown to subscribers
    // or the public, used only to follow up on disputes or a
    // law-enforcement request per the Terms.
    let finalReporterEmail: string | null = null;
    let finalReporterPhone: string | null = null;
    let reporterName: string | null = null;

    if (userId) {
      const reporterUser = await currentUser();
      finalReporterEmail = reporterUser?.emailAddresses?.[0]?.emailAddress || null;
      finalReporterPhone = normalizePhone(reporterUser?.phoneNumbers?.[0]?.phoneNumber) || null;
      reporterName = reporterUser?.firstName || null;
    } else {
      reporterName = ((formData.get('reporter_name') as string) || '').trim() || null;
      finalReporterEmail = cleanEmail(formData.get('reporter_email'));
      finalReporterPhone = normalizePhone(formData.get('reporter_phone') as string);

      if (!reporterName || (!finalReporterEmail && !finalReporterPhone)) {
        return NextResponse.json(
          {
            error:
              "Since you're not signed in, your name plus a phone number or email is required so the report is traceable.",
          },
          { status: 400 }
        );
      }
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

    const { data: inserted, error: insertError } = await supabase
      .from('reports')
      .insert({
        phone_numbers: phones,
        subject_emails: emails,
        subject_first_name,
        scam_type,
        description,
        reporter_name: reporterName,
        reporter_email: finalReporterEmail,
        reporter_phone: finalReporterPhone,
        // Only set for signed-in filers -- this is what powers the
        // signed-in "My reports" dashboard page. Anonymous filers instead
        // get a tracking_code (auto-generated by the DB default) to check
        // status without an account, via /report/status.
        reporter_clerk_user_id: userId || null,
        evidence_urls,
        status: 'pending',
      })
      .select('tracking_code')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, trackingCode: inserted?.tracking_code || null });
  } catch (err) {
    return NextResponse.json(
      { error: 'Unexpected error submitting report.' },
      { status: 500 }
    );
  }
}
