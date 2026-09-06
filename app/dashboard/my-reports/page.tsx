import { auth } from '@clerk/nextjs/server';
import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase';
import { MyReportsList } from './MyReportsList';

// Available to ANY signed-in user, not just active subscribers -- filing
// a report is free and open to everyone, so checking on what you've
// filed shouldn't require a subscription either. middleware.ts already
// requires sign-in for everything under /dashboard.
//
// Only shows reports where reporter_clerk_user_id matches this user --
// set automatically at submission time for signed-in filers (see
// api/report/route.ts). Reports filed anonymously, or filed before this
// column existed, won't show up here; anonymous filers use their
// tracking code at /report/status instead.
export default async function MyReportsPage() {
  const { userId } = auth();

  if (!isSupabaseConfigured() || !userId) {
    return (
      <main className="min-h-screen px-6 py-24 text-center">
        <h1 className="text-3xl font-extrabold">My Reports</h1>
        <p className="mt-4 text-muted">Sign in to see reports you've filed.</p>
      </main>
    );
  }

  const supabase = getServiceClient();

  // Read the PREVIOUS last_seen_at before overwriting it below, so we can
  // still tell which of these reports were resolved since the last visit
  // (used for the "New" tag) even though loading this page immediately
  // marks everything as seen for the nav badge in SiteHeader.tsx.
  const { data: inboxState } = await supabase
    .from('report_inbox_state')
    .select('last_seen_at')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  const previousLastSeenAt = inboxState?.last_seen_at || new Date(0).toISOString();

  const { data: reports } = await supabase
    .from('reports')
    .select(
      'id, phone_numbers, subject_emails, social_handles, subject_first_name, status, resolved_at, created_at, tracking_code'
    )
    .eq('reporter_clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);

  // Loading this page IS "reading the inbox" -- mark everything seen as
  // of right now, so the unread badge in SiteHeader.tsx clears. Best-effort:
  // a failure here shouldn't stop the page from showing the reports.
  await supabase
    .from('report_inbox_state')
    .upsert({ clerk_user_id: userId, last_seen_at: new Date().toISOString() });

  return (
    <main className="min-h-screen px-6 py-24 text-center">
      <h1 className="text-3xl font-extrabold">My Reports</h1>
      <p className="mt-3 text-muted">
        Reports you've filed while signed in, and their current status.
      </p>

      <div className="mx-auto mt-10 max-w-lg text-left">
        <MyReportsList reports={reports || []} previousLastSeenAt={previousLastSeenAt} />
      </div>
    </main>
  );
}
