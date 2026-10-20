import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

// "Red Alert": approve (or unapprove) a report into the persistent Red
// Alerts feed at /dashboard, visible to every active subscriber -- see
// RedAlertsList.tsx. This used to be a one-off email blast; that's gone
// (no sendEmail here anymore) in favor of a browsable, always-there feed
// plus an in-app unread badge (see SiteHeader.tsx and
// red_alert_inbox_state in supabase/schema.sql), same notification pattern
// already used for "My Reports". A report can be flagged as a CANDIDATE by
// either the reporter (the "Mark as Red Alert" checkbox on the report
// form, see reports.red_alert_requested) or an admin just deciding to post
// it -- either way, nothing shows in the feed until an admin explicitly
// approves it here. `message` is always admin-authored, same editorial
// rule as admin_summary -- this route never accepts or publishes the
// reporter's raw description.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  let body: { id?: string; message?: string; approve?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: 'A report id is required.' }, { status: 400 });
  }

  const message = (body.message || '').trim();
  if (message.length > 1000) {
    return NextResponse.json({ error: 'Note must be 1000 characters or fewer.' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Only approved reports can go into the feed -- posting something that
  // hasn't even been reviewed yet would defeat the whole point of the
  // approval workflow.
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('id, status')
    .eq('id', body.id)
    .maybeSingle();

  if (reportError || !report) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }
  if (report.status !== 'approved') {
    return NextResponse.json(
      { error: 'Only approved reports can be posted to Red Alerts.' },
      { status: 400 }
    );
  }

  const approve = body.approve !== false;
  const postedAt = approve ? new Date().toISOString() : null;

  const { error: updateError } = await supabase
    .from('reports')
    .update({ alert_message: message || null, alert_sent_at: postedAt })
    .eq('id', body.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, postedAt });
}
