import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase';
import SearchBox from './SearchBox';
import SubscribeButton from './SubscribeButton';

async function getSubscriber(clerkUserId: string) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('subscribers')
    .select('status, search_credits')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();
  return { isActive: data?.status === 'active', credits: data?.search_credits ?? 0 };
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

  return (
    <main className="min-h-screen px-6 py-24 text-center">
      <h1 className="text-3xl font-extrabold">Search the Registry</h1>

      {isActive ? (
        <div className="mt-10">
          <SearchBox initialCredits={credits} />
          <p className="mt-6 text-sm text-muted">
            Have a whole list to report?{' '}
            <Link href="/dashboard/bulk-report" className="text-orange">
              Bulk-report it here
            </Link>
            .
          </p>
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
