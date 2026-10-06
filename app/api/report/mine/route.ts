import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { normalizePhone } from '@/lib/phone';
import { isValidPhoneNumber } from '@/lib/phoneLookup';
import { SCAM_TYPES } from '@/lib/scamTypes';

// Lets a signed-in reporter edit a report THEY filed (from the
// /dashboard/my-reports/[id] page). Scoped to reporter_clerk_user_id =
// the signed-in user, so nobody can edit someone else's report by
// guessing an id. Anonymous reports (no Clerk user) can't be edited here.
//
// Moderation rule: an edit always sends the report back to 'pending'.
// Editing a pending report keeps it pending; editing an APPROVED report
// pulls it out of search (and out of the dashboard Red Alerts list) until
// an admin re-approves it, so a reporter can never change what
// subscribers see without a fresh review. Removed reports are final and
// can't be edited by the reporter.

type Body = {
  id?: string;
  phone_numbers?: string[];
  subject_emails?: string[];
  social_handles?: string[];
  subject_first_name?: string | null;
  scam_type?: string[];
  description?: string;
};

function cleanEmail(raw: unknown): string | null {
  const e = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

function strArray(v: unknown): string[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v)) return null;
  return v.filter((x): x is string => typeof x === 'string');
}

export async function PATCH(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: 'A report id is required.' }, { status: 400 });
  }

  const rawPhones = strArray(body.phone_numbers);
  const rawEmails = strArray(body.subject_emails);
  const rawSocials = strArray(body.social_handles);
  const rawTypes = strArray(body.scam_type);
  if (!rawPhones || !rawEmails || !rawSocials || !rawTypes) {
    return NextResponse.json({ error: 'Invalid field format.' }, { status: 400 });
  }

  const phones = Array.from(new Set(rawPhones.map((p) => normalizePhone(p)).filter((p): p is string => Boolean(p)))).slice(0, 5);
  const emails = Array.from(new Set(rawEmails.map(cleanEmail).filter((e): e is string => Boolean(e)))).slice(0, 5);
  const socials = Array.from(new Set(rawSocials.map((s) => s.trim()).filter(Boolean))).slice(0, 5);
  const scamType = Array.from(new Set(rawTypes.filter((t) => SCAM_TYPES.includes(t))));
  const description = (body.description || '').trim();
  const firstName = (body.subject_first_name || '').trim().split(/\s+/)[0]?.slice(0, 50) || null;

  if (phones.length === 0 && emails.length === 0 && socials.length === 0) {
    return NextResponse.json(
      { error: 'Keep at least one phone number, email, or social tag on the report.' },
      { status: 400 }
    );
  }
  if (!description) {
    return NextResponse.json({ error: 'The description cannot be blank.' }, { status: 400 });
  }
  if (description.length > 5000) {
    return NextResponse.json({ error: 'The description must be 5000 characters or fewer.' }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: existing } = await supabase
    .from('reports')
    .select('id, status, phone_numbers')
    .eq('id', body.id)
    .eq('reporter_clerk_user_id', userId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }
  if (existing.status === 'removed') {
    return NextResponse.json(
      { error: 'This report was removed after review and can no longer be edited.' },
      { status: 400 }
    );
  }

  // Same real-number check as the report form, but only for numbers the
  // reporter is newly adding -- re-validating unchanged ones would just
  // spend Twilio lookups for nothing.
  const previous = new Set(existing.phone_numbers || []);
  const added = phones.filter((p) => !previous.has(p));
  if (added.length > 0) {
    const validity = await Promise.all(added.map((p) => isValidPhoneNumber(p)));
    const invalid = added.filter((_, i) => !validity[i]);
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `This doesn't look like a real phone number: ${invalid.join(', ')}. Double-check it and try again.` },
        { status: 400 }
      );
    }
  }

  // The report form sends one text as both description (admin-only) and
  // reporter_public_note (the publishable candidate, capped at 500), so
  // keep them in sync here too. Strip the "[Other: ...]" prefix the form
  // adds for admins so it never becomes part of the public candidate.
  const publicNote = description.replace(/^\[Other: [^\]]*\]\s*/, '').slice(0, 500) || null;

  const { data, error } = await supabase
    .from('reports')
    .update({
      phone_numbers: phones,
      subject_emails: emails,
      social_handles: socials,
      subject_first_name: firstName,
      scam_type: scamType,
      description,
      reporter_public_note: publicNote,
      public_note_approved: false,
      status: 'pending',
      resolved_at: null,
    })
    .eq('id', body.id)
    .eq('reporter_clerk_user_id', userId)
    .select('id, status')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, report: data, wasApproved: existing.status === 'approved' });
}
