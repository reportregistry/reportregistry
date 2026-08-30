import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase';
import SearchBox from './SearchBox';
import SubscribeButton from './SubscribeButton';
import EnhancedReportsList from './EnhancedReportsList';

async function getSubscriber(clerkUserId: string) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('subscribers')
    .select('status, search_credits, purchased_credits')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();
  // Total shown to the subscriber is the free monthly pool (resets to 20
  // on the 1st, no rollover) plus purchased/admin-added credits (never
  // expire). See supabase/schema.sql for the split.
  return {
    isActive: data?.status === 'active',
    credits: (data?.search_credits ?? 0) + (data?.purchased_credits ?? 0),
  };
}

async function getSearchHistory(clerkUserId: string) {
  const supabase = getServiceClient();
  // Every search gets logged, including repeats, so a number you check
  // often would otherwise flood the list with copies of itself. Pull more
  // rows than needed, then keep only the most recent row per query_value
  // before capping at 25 -- de-duped, most-recent-first.
  const { data } = await supabase
    .from('search_history')
    .select('query_type, query_value, total_reports, category_counts, searched_at')
    .eq('clerk_user_id', clerkUserId)
    .order('searched_at', { ascending: false })
    .limit(200);

  const seen = new Set<string>();
  const deduped = [];
  for (const row of data || []) {
    const key = row.query_value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= 25) break;
  }
  return deduped;
}

async function getEnhancedReports(clerkUserId: string) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('deep_dive_requests')
    .select('id, query_type, query_value, category_counts, summary, resolved_at')
    .eq('clerk_user_id', clerkUserId)
    .eq('status', 'completed')
    .order('resolved_at', { ascending: false })
    .limit(25);
  return data || [];
}

export default async function DashboardPage() {
  const { userId } = auth();

  if (!isSupabaseConfigured()) {
    return (
      <main className="min-h-screen px-6 py-24 text-center">
        <h1 className="text-3xl font-extrabold">Search the Registry</h1>
        <div className="mx-auto mt-10 max-w-md rounded-xl border border-orange bg-orange/10 p-8">
          <p className="text-sm text-muted">
            Supabase isn't configured yet, so search can't run. Sign-in
            works fine, add your Supabase keys to `.env.local` to unlock
            this page.
          </p>
        </div>
      </main>
    );
  }

  const { isActive, credits } = userId
    ? await getSubscriber(userId)
    : { isActive: false, credits: 0 };

  const [searchHistory, enhancedReports] = userId && isActive
    ? await Promise.all([getSearchHistory(userId), getEnhancedReports(userId)])
    : [[], []];

  return (
    <main className="min-h-screen px-6 py-24 text-center">
      <h1 className="text-3xl font-extrabold">Search the Registry</h1>

      {isActive ? (
        <div className="mt-10">
          <SearchBox initialCredits={credits} initialHistory={searchHistory} />
          <p className="mt-6 text-sm text-muted">
            Have a whole list to report?{' '}
            <Link href="/dashboard/bulk-report" className="text-orange">
              Bulk-report it here
            </Link>
            .
          </p>
          <div className="mx-auto mt-14 max-w-md text-left">
            <h2 className="mb-3 text-center text-lg font-bold">Enhanced Reports</h2>
            <EnhancedReportsList reports={enhancedReports} />
          </div>
        </div>
      ) : (
        <div className="mx-auto mt-10 max-w-md rounded-xl border border-border bg-card p-8">
          <p className="mb-6 text-muted">
            Search is subscriber-only. Subscribe to check any phone number
            for scam reports. Filing a report yourself is always free.
          </p>
          <SubscribeButton />
        </div>
      )}
    </main>
  );
}
