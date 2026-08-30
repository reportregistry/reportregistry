import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { normalizePhone } from '@/lib/phone';
import { SCAM_TYPES } from '@/lib/scamTypes';
import { sendEmail } from '@/lib/email';

const VALID_STATUSES = ['pending', 'approved', 'removed'];

// Emails anyone watching a phone/email that appears on this report (see
// app/api/watch/route.ts and WatchList.tsx). Only called on the
// transition INTO 'approved' -- see the call site below -- so a watcher
// gets exactly one email per new report, not one per subsequent admin
// edit. Best-effort throughout: a missing subscriber email, a missing
// RESEND_API_KEY (sendEmail no-ops in that case), or any other hiccup
// here should never fail the approval itself.
async function notifyWatchers(
  supabase: ReturnType<typeof getServiceClient>,
  report: { phone_numbers: string[] | null; subject_emails: string[] | null }
) {
  const phones = report.phone_numbers || [];
  const emails = report.subject_emails || [];
  if (phones.length === 0 && emails.length === 0) return;

  const matches: { id: string; clerk_user_id: string; query_value: string }[] = [];
  if (phones.length > 0) {
    const { data } = await supabase
      .from('watches')
      .select('id, clerk_user_id, query_value')
      .eq('query_type', 'phone')
      .in('query_value', phones);
    if (data) matches.push(...data);
  }
  if (emails.length > 0) {
    const { data } = await supabase
      .from('watches')
      .select('id, clerk_user_id, query_value')
      .eq('query_type', 'email')
      .in('query_value', emails);
    if (data) matches.push(...data);
  }
  if (matches.length === 0) return;

  // One email per watcher, even if they somehow matched on more than one
  // identifier on the same report.
  const seenUsers = new Set<string>();
  const notifications = matches.filter((m) => {
    if (seenUsers.has(m.clerk_user_id)) return false;
    seenUsers.add(m.clerk_user_id);
    return true;
  });

  const { data: subs } = await supabase
    .from('subscribers')
    .select('clerk_user_id, email')
    .in('clerk_user_id', Array.from(seenUsers));
  const emailByUser = new Map((subs || []).map((s) => [s.clerk_user_id, s.email]));

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://reportregistry.com';
  await Promise.all(
    notifications.map((n) => {
      const to = emailByUser.get(n.clerk_user_id);
      if (!to) return Promise.resolve();
      return sendEmail(
        to,
        'New report on a number you\'re watching',
        `A new report was just approved on ${n.query_value}, which you're watching on ReportRegistry. Log in to see the details: ${baseUrl}/dashboard`
      );
    })
  );

  await supabase
    .from('watches')
    .update({ last_notified_at: new Date().toISOString() })
    .in('id', notifications.map((n) => n.id));
}

type Body = {
  id?: string;
  status?: string;
  admin_summary?: string | null;
  phone_numbers?: string[];
  subject_emails?: string[];
  subject_first_name?: string | null;
  scam_type?: string[];
  description?: string;
};

// Moderation action: approve/remove a report, PLUS full editing of every
// field on it -- phone numbers, emails, subject name, categories, and the
// reporter's description. Gated by middleware (sign-in required) plus the
// admin-email allowlist below -- being signed in is not enough, you have
// to be one of the emails in ADMIN_EMAILS. Every field below is optional
// in the request body; only the ones present get updated, so the report
// edit form and the "just change status" flow can both hit this route.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.id || !body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'A valid id and status are required.' }, { status: 400 });
  }

  // admin_summary is optional and separate from status changes -- when
  // present, it's the short public-facing blurb shown to subscribers on
  // search (see supabase/schema.sql). Blank/whitespace clears it back to
  // null (unpublishing it) rather than storing an empty string.
  const trimmedSummary = body.admin_summary?.trim();
  if (trimmedSummary && trimmedSummary.length > 500) {
    return NextResponse.json({ error: 'Summary must be 500 characters or fewer.' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { status: body.status };
  if (body.admin_summary !== undefined) {
    updates.admin_summary = trimmedSummary || null;
  }

  // Full-detail edits -- same normalization the public report form uses,
  // so an admin-edited number/email still matches correctly at search
  // time (digits-only phone, lowercased trimmed email).
  if (body.phone_numbers !== undefined) {
    if (!Array.isArray(body.phone_numbers)) {
      return NextResponse.json({ error: 'phone_numbers must be an array.' }, { status: 400 });
    }
    updates.phone_numbers = Array.from(
      new Set(body.phone_numbers.map((p) => normalizePhone(p)).filter((p): p is string => Boolean(p)))
    );
  }

  if (body.subject_emails !== undefined) {
    if (!Array.isArray(body.subject_emails)) {
      return NextResponse.json({ error: 'subject_emails must be an array.' }, { status: 400 });
    }
    updates.subject_emails = Array.from(
      new Set(
        body.subject_emails
          .map((e) => (e || '').trim().toLowerCase())
          .filter((e): e is string => Boolean(e))
      )
    );
  }

  if (
    updates.phone_numbers !== undefined &&
    updates.subject_emails !== undefined &&
    (updates.phone_numbers as string[]).length === 0 &&
    (updates.subject_emails as string[]).length === 0
  ) {
    return NextResponse.json(
      { error: 'A report needs at least one phone number or email.' },
      { status: 400 }
    );
  }

  if (body.subject_first_name !== undefined) {
    const name = (body.subject_first_name || '').trim();
    updates.subject_first_name = name ? name.split(/\s+/)[0] : null;
  }

  if (body.scam_type !== undefined) {
    if (!Array.isArray(body.scam_type)) {
      return NextResponse.json({ error: 'scam_type must be an array.' }, { status: 400 });
    }
    updates.scam_type = Array.from(
      new Set(body.scam_type.filter((t): t is string => SCAM_TYPES.includes(t)))
    );
  }

  if (body.description !== undefined) {
    const desc = (body.description || '').trim();
    if (!desc) {
      return NextResponse.json({ error: 'Description cannot be blank.' }, { status: 400 });
    }
    updates.description = desc;
  }

  const supabase = getServiceClient();

  // Needed to detect the transition INTO 'approved' below -- notifying
  // watchers on every edit to an already-approved report would spam
  // them for typo fixes, so this only fires the first time.
  const { data: existing } = await supabase
    .from('reports')
    .select('status')
    .eq('id', body.id)
    .maybeSingle();
  const wasApproved = existing?.status === 'approved';

  const { data, error } = await supabase
    .from('reports')
    .update(updates)
    .eq('id', body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!wasApproved && data.status === 'approved') {
    await notifyWatchers(supabase, data);
  }

  // Returns the full updated row so the admin UI can sync its local state
  // to exactly what got normalized/stored, rather than guessing.
  return NextResponse.json({ ok: true, report: data });
}
