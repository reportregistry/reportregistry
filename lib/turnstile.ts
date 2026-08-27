// Verifies a Cloudflare Turnstile token server-side. Used on the public,
// unauthenticated report form to block bot spam. If TURNSTILE_SECRET_KEY
// isn't configured (e.g. local dev before you've set it up), this skips
// verification rather than blocking every submission.
export async function verifyTurnstileToken(
  token: string | null,
  ip?: string | null
): Promise<boolean> {
  if (!process.env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;

  const body = new URLSearchParams();
  body.append('secret', process.env.TURNSTILE_SECRET_KEY);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);

  try {
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body }
    );
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}
