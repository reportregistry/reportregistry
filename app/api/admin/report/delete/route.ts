import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

// Permanent, hard delete -- unlike "Remove" (which just sets status to
// 'removed' and keeps the row in the audit trail), this actually drops the
// row from the reports table. Deliberately restricted to reports that are
// ALREADY in 'removed' status, so this can only ever be a second,
// intentional step after the normal moderation action, never a shortcut
// that skips it. There is no undo once this runs.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: 'A report id is required.' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: existing, error: fetchError } = await supabase
    .from('reports')
    .select('id, status')
    .eq('id', body.id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }

  if (existing.status !== 'removed') {
    return NextResponse.json(
      { error: 'Only reports already marked Removed can be permanently deleted.' },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabase.from('reports').delete().eq('id', body.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
