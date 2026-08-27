import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase';
import SubscribeButton from '../SubscribeButton';
import BulkReportForm from '../BulkReportForm';

async function getSubscriptionStatus(clerkUserId: string) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('subscribers')
    .select('status')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();
  return data?.status === 'active';
}

export default async function BulkReportPage() {
  const { userId } = auth();

  if (!isSupabaseConfigured()) {
    return (
      <main className="min-h-screen px-6 py-24 text-center">
        <h1 className="text-3xl font-extrabold">Bulk Report</h1>
        <div className="mx-auto mt-10 max-w-md rounded-xl border border-orange bg-orange/10 p-8">
          <p className="text-sm text-muted">
            Supabase isn't configured yet -- add your Supabase keys to
            `.env.local` to unlock this page.
          </p>
        </div>
      </main>
    );
  }

  const isActive = userId ? await getSubscriptionStatus(userId) : false;

  return (
    <main className="min-h-screen px-6 py-24 text-center">
      <h1 className="text-3xl font-extrabold">Bulk Report</h1>
      <p className="mx-auto mt-3 max-w-lg text-muted">
        Paste a whole list of contacts to report at once. Subscriber-only,
        same as search. Filing reports one at a time on the{' '}
        <Link href="/report" className="text-orange">
          public report page
        </Link>{' '}
        is still free for anyone.
      </p>

      {isActive ? (
        <div className="mt-10">
          <BulkReportForm />
        </div>
      ) : (
        <div className="mx-auto mt-10 max-w-md rounded-xl border border-border bg-card p-8">
          <p className="mb-6 text-muted">
            Bulk reporting is a subscriber feature. Subscribe to unlock
            search and bulk reporting.
          </p>
          <SubscribeButton />
        </div>
      )}
    </main>
  );
}
