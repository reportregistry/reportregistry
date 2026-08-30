// Minimal transactional email sender via Resend's HTTP API -- used only
// for watch-list alerts (see api/admin/report's approval-notification
// hook and app/dashboard/WatchList.tsx). No SDK dependency, just a fetch
// call, since this is the only email the app sends.
//
// Fails OPEN (silently skips, never throws) if RESEND_API_KEY isn't
// configured, same pattern as verifyTurnstileToken and
// isValidPhoneNumber -- a missing email integration should never break
// the admin action (approving a report) that triggers it.
//
// Requires a domain verified in Resend's dashboard for the "from"
// address to actually deliver -- set RESEND_FROM_EMAIL once that's done,
// e.g. "ReportRegistry Alerts <alerts@reportregistry.com>".
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !to) return;

  const from = process.env.RESEND_FROM_EMAIL || 'ReportRegistry <onboarding@resend.dev>';

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
  } catch {
    // Best-effort -- a failed email should never break the admin action
    // (approving a report) that triggered it.
  }
}
