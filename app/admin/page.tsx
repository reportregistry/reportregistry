import { currentUser } from '@clerk/nextjs/server';
import { isAdminEmail } from '@/lib/admin';
import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase';
import AdminReportList from './AdminReportList';
import AdminDeepDiveList from './AdminDeepDiveList';
import AdminSubscriberList from './AdminSubscriberList';

export const dynamic = 'force-dynamic';

// middleware.ts already requires sign-in to reach this route -- this page
// adds the second gate, the ADMIN_EMAILS allowlist, so only you (or
// whoever's email you add) can actually see report contents.
export default async function AdminPage() {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  if (!isAdminEmail(email)) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-xl border border-red bg-red/10 p-8 text-center">
          <p className="font-semibold text-red">Not authorized.</p>
          <p className="mt-2 text-sm text-muted">
            This account isn't on the admin list. Add your email to
            ADMIN_EMAILS in .env.local to get access.
          </p>
        </div>
      </main>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <p className="font-semibold">Supabase isn't configured yet.</p>
          <p className="mt-2 text-sm text-muted">
            Add your Supabase keys to .env.local to see reports here.
          </p>
        </div>
      </main>
    );
  }

  const supabase = getServiceClient();
  const { data: reports, count: totalReports } = await supabase
    .from('reports')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: deepDives } = await supabase
    .from('deep_dive_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: subscribers } = await supabase
    .from('subscribers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-extrabold">Admin</h1>

        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">Reports</h2>
            <p className="text-sm text-muted">
              {totalReports ?? 0} total{' '}
              {totalReports && totalReports > 200 ? '(showing most recent 200)' : ''}
            </p>
          </div>
          <p className="mt-2 text-sm text-muted">
            Approve a report to make it count as "flagged" in search results.
            Remove a report to take it down entirely. Full contents here are
            never shown to subscribers or the public, only the yes/no
            verdict is.
          </p>
          <div className="mt-6">
            <AdminReportList initialReports={reports || []} />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="text-lg font-bold">Subscribers</h2>
          <p className="mt-2 text-sm text-muted">
            Everyone who's ever subscribed. Free credits (search_credits)
            reset to 20 automatically on the 1st of each month for active
            subscribers. Purchased/manually-added credits never expire and
            stack separately.
          </p>
          <div className="mt-6">
            <AdminSubscriberList initialSubscribers={subscribers || []} />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="text-lg font-bold">Priority-search deep dives</h2>
          <p className="mt-2 text-sm text-muted">
            A subscriber spent a credit here because a search on this number
            or email came back with nothing on file. Dig in manually, and if
            it turns out to be a real scam, file a normal report for it
            separately.
          </p>
          <div className="mt-6">
            <AdminDeepDiveList initialRequests={deepDives || []} />
          </div>
        </section>
      </div>
    </main>
  );
}
