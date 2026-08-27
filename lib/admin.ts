// Simple email-allowlist admin check -- no roles/permissions system needed
// for a single-operator site. Set ADMIN_EMAILS in .env.local to a
// comma-separated list of the Clerk account email(s) allowed into /admin,
// e.g. ADMIN_EMAILS=you@email.com,partner@email.com
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
