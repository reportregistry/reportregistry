import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase';

const STATUS_STYLES: Record<string, string> = {
  pending: 'border-orange/40 bg-orange/10 text-orange',
  approved: 'border-[#5aa9e6]/40 bg-[#5aa9e6]/10 text-[#5aa9e6]',
  removed: 'border-red/40 bg-red/10 text-red',
};

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
  const { data: reports } = await supabase
    .from('reports')
    .select('id, phone_numbers, subject_emails, subject_first_name, status, created_at, tracking_code')
    .eq('reporter_clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <main className="min-h-screen px-6 py-24 text-center">
      <h1 className="text-3xl font-extrabold">My Reports</h1>
      <p className="mt-3 text-muted">
        Reports you've filed while signed in, and their current status.
      </p>

      <div className="mx-auto mt-10 max-w-lg text-left">
        {!reports || reports.length === 0 ? (
          <p className="text-center text-sm text-muted">
            You haven't filed any reports while signed in yet.{' '}
            <Link href="/report" className="text-orange underline">
              File one here
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {[...(r.phone_numbers || []), ...(r.subject_emails || [])].join(', ') || '—'}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                      STATUS_STYLES[r.status] || ''
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Filed {new Date(r.created_at).toLocaleDateString()}
                  {r.subject_first_name ? ` -- ${r.subject_first_name}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
