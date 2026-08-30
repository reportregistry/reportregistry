// Validates a phone number is real (not just well-formatted) using
// Twilio's Lookup v2 API, on the public report form only -- this is the
// site's one unauthenticated, open-write endpoint, so it's the one worth
// paying a few tenths of a cent per submission to keep clean. This is a
// basic validity check ONLY (no line_type_intelligence / carrier fields
// requested), which keeps each lookup at Twilio's base rate rather than
// the more expensive add-on tiers -- see lib/README note in the report
// route for where a future "show VOIP/line type on search" feature would
// hook in differently (that's a search-time enrichment, not a submission
// gate, and wasn't part of this build).
//
// Assumes US/Canada numbers (prepends +1) since the rest of the app
// (lib/phone.ts normalizePhone) makes the same assumption -- there's no
// country selector on the report form. An international number typed in
// consistently will still often validate fine since Twilio is lenient
// about a wrong leading "+1" on an otherwise-valid international E.164
// number, but this hasn't been tested against non-US numbers.
//
// Fails OPEN (treats as valid) if TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN
// aren't configured, or if the Twilio API call itself errors/times out --
// same pattern as verifyTurnstileToken in lib/turnstile.ts. A validation
// outage should never be the reason a legitimate report gets rejected.
export async function isValidPhoneNumber(digitsOnly: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return true;

  const e164 = digitsOnly.startsWith('+') ? digitsOnly : `+1${digitsOnly}`;

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const res = await fetch(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}`,
      { headers: { Authorization: `Basic ${auth}` } }
    );

    // A 404 from Lookup v2 means Twilio couldn't parse it as a phone
    // number at all -- treat that as invalid. Any other non-2xx (rate
    // limit, outage, bad credentials) fails open rather than blocking a
    // real submission over our own misconfiguration.
    if (res.status === 404) return false;
    if (!res.ok) return true;

    const data = await res.json();
    return data.valid !== false;
  } catch {
    return true;
  }
}
