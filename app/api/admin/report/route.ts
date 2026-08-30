import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

const VALID_STATUSES = ['pending', 'approved', 'removed'];

// Moderation action: approve or remove a report. Gated by middleware
// (sign-in required) plus the admin-email allowlist below -- being signed
// in is not enough, you have to be one of the emails in ADMIN_EMAILS.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  let body: { id?: string; status?: string; admin_summary?: string | null };
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

  const supabase = getServiceClient();
  const { error } = await supabase
    .from('reports')
    .update(updates)
    .eq('id', body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
