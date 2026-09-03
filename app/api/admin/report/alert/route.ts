import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { sendEmail } from '@/lib/email';

// "Red Alert": an on-demand email blast to every currently-active
// subscriber about one specific report, triggered by an admin clicking
// the button in AdminReportList.tsx. Deliberately separate from the Watch
// feature (app/api/watch/route.ts + notifyWatchers in
// api/admin/report/route.ts), which only emails the specific subscribers
// who chose to watch that exact number/email -- this reaches EVERYONE
// with an active subscription, regardless of whether they've ever
// searched this number, so it's reserved for cases an admin judges
// serious enough to warrant that reach. The message is always
// admin-written (never the reporter's raw description), same editorial
// rule as admin_summary and the reporter public note -- this route
// doesn't accept or send any reporter-authored text.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  let body: { id?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: 'A report id is required.' }, { status: 400 });
  }

  const message = (body.message || '').trim();
  if (!message) {
    return NextResponse.json({ error: 'An alert message is required.' }, { status: 400 });
  }
  if (message.length > 1000) {
    return NextResponse.json({ error: 'Alert message must be 1000 characters or fewer.' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Only approved reports can trigger an alert -- sending a mass email
  // about a report that hasn't even been reviewed yet would defeat the
  // whole point of the approval workflow.
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('id, phone_numbers, subject_emails, subject_first_name, scam_type, status')
    .eq('id', body.id)
    .maybeSingle();

  if (reportError || !report) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }
  if (report.status !== 'approved') {
    return NextResponse.json(
      { error: 'Only approved reports can trigger a Red Alert.' },
      { status: 400 }
    );
  }

  const { data: subscribers, error: subError } = await supabase
    .from('subscribers')
    .select('email')
    .eq('status', 'active');

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  const recipients = Array.from(
    new Set((subscribers || []).map((s) => s.email).filter((e): e is string => Boolean(e)))
  );

  const identifiers = [...(report.phone_numbers || []), ...(report.subject_emails || [])].join(', ');
  const subject = '⚠️ Red Alert from ReportRegistry';
  const bodyText = [
    `A ReportRegistry admin has flagged the following as high-risk:`,
    identifiers ? `Contact: ${identifiers}` : null,
    report.subject_first_name ? `Name on file: ${report.subject_first_name}` : null,
    report.scam_type?.length ? `Category: ${report.scam_type.join(', ')}` : null,
    '',
    message,
    '',
    'This alert was sent to every active ReportRegistry subscriber. Search this contact on your dashboard for full details.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  // Best-effort, same pattern as notifyWatchers -- sendEmail already
  // fails open per-recipient, so one bad address never blocks the rest.
  await Promise.all(recipients.map((to) => sendEmail(to, subject, bodyText)));

  const { error: updateError } = await supabase
    .from('reports')
    .update({ alert_message: message, alert_sent_at: new Date().toISOString() })
    .eq('id', body.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sentCount: recipients.length });
}
