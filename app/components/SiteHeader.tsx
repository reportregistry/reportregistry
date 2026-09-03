import Link from 'next/link';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase';

// Number of this user's own filed reports that moved out of 'pending'
// (resolved_at gets set, see app/api/admin/report/route.ts) since they
// last opened /dashboard/my-reports (report_inbox_state, see
// supabase/schema.sql -- that page upserts it on every load). Same idea
// as an unread-mail count. Runs on every page load for a signed-in user
// since this header is shared site-wide (see app/layout.tsx); a cheap
// head-count query, so acceptable at current scale.
async function getUnreadReportCount(userId: string | null): Promise<number> {
  if (!userId || !isSupabaseConfigured()) return 0;

  const supabase = getServiceClient();
  const { data: inboxState } = await supabase
    .from('report_inbox_state')
    .select('last_seen_at')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  const lastSeenAt = inboxState?.last_seen_at || new Date(0).toISOString();

  const { count } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_clerk_user_id', userId)
    .neq('status', 'pending')
    .not('resolved_at', 'is', null)
    .gt('resolved_at', lastSeenAt);

  return count || 0;
}

// Shared across every page via app/layout.tsx, so there's always a way
// back home and consistent branding/nav -- previously this only existed
// on the homepage itself, which meant /report, /sign-in, /sign-up, etc.
// had no header at all.
export default async function SiteHeader() {
  const { userId } = auth();
  const unreadCount = await getUnreadReportCount(userId);

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-navy/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-base font-extrabold sm:text-lg">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-orange" />
          ReportRegistry
        </Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-3">
          <Link
            href="/report"
            className="hidden whitespace-nowrap px-2 py-1.5 text-muted transition hover:text-white sm:inline"
          >
            Report Free
          </Link>
          <SignedOut>
            <Link
              href="/sign-in"
              className="whitespace-nowrap rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/40 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="whitespace-nowrap rounded-lg bg-gradient-to-br from-red to-orange px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 sm:px-4 sm:py-2 sm:text-sm"
            >
              Subscribe
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard/my-reports"
              className={`relative whitespace-nowrap px-2 py-1.5 text-muted transition hover:text-white ${
                unreadCount > 0 ? 'inline' : 'hidden sm:inline'
              }`}
            >
              My Reports
              {unreadCount > 0 && (
                <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <Link
              href="/dashboard"
              className="whitespace-nowrap rounded-lg bg-gradient-to-br from-red to-orange px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 sm:px-4 sm:py-2 sm:text-sm"
            >
              Go to Search
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </nav>
      </div>
    </header>
  );
}
