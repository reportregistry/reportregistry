import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { normalizePhone } from '@/lib/phone';
import { SCAM_TYPES } from '@/lib/scamTypes';

// Lets an admin log a report directly from the admin panel -- e.g. an
// incident they personally know about, or one being migrated in from
// somewhere else -- without going through the public /report form (no
// captcha, no "your info" requirement, since the admin IS the trusted
// party here). Defaults straight to 'approved' since an admin adding this
// by hand has, by definition, already reviewed it, but 'pending' can be
// requested too if they'd rather queue it for a second look first. Uses
// the exact same reports table and columns as every other report -- no
// schema changes needed -- with reporter_name/reporter_email/
// reporter_clerk_user_id populated from the admin's own Clerk account so
// the audit trail always shows who added it.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  let body: {
    phone_numbers?: string[];
    subject_emails?: string[];
    subject_first_name?: string | null;
    scam_type?: string[];
    description?: string;
    admin_summary?: string | null;
    status?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const phone_numbers = Array.from(
    new Set(
      (body.phone_numbers || [])
        .map((p) => normalizePhone(p))
        .filter((p): p is string => Boolean(p))
    )
  );
  const subject_emails = Array.from(
    new Set(
      (body.subject_emails || [])
        .map((e) => (e || '').trim().toLowerCase())
        .filter((e): e is string => Boolean(e))
    )
  );

  if (phone_numbers.length === 0 && subject_emails.length === 0) {
    return NextResponse.json(
      { error: 'At least one phone number or email is required.' },
      { status: 400 }
    );
  }

  const description = (body.description || '').trim();
  if (!description) {
    return NextResponse.json({ error: 'Description is required.' }, { status: 400 });
  }

  const scam_type = Array.from(
    new Set((body.scam_type || []).filter((t): t is string => SCAM_TYPES.includes(t)))
  );

  const subject_first_name = (body.subject_first_name || '').trim().split(/\s+/)[0] || null;

  const trimmedSummary = (body.admin_summary || '').trim();
  if (trimmedSummary.length > 500) {
    return NextResponse.json({ error: 'Summary must be 500 characters or fewer.' }, { status: 400 });
  }
  const admin_summary = trimmedSummary || null;

  const status = body.status === 'pending' ? 'pending' : 'approved';

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('reports')
    .insert({
      phone_numbers,
      subject_emails,
      subject_first_name,
      scam_type,
      description,
      admin_summary,
      reporter_name: user?.firstName ? `Admin (${user.firstName})` : 'Admin',
      reporter_email: email || null,
      reporter_clerk_user_id: user?.id || null,
      status,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, report: data });
}
