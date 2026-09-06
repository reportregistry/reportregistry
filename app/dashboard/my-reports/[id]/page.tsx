import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase';

const STATUS_STYLES: Record<string, string> = {
  pending: 'border-orange/40 bg-orange/10 text-orange',
  approved: 'border-[#5aa9e6]/40 bg-[#5aa9e6]/10 text-[#5aa9e6]',
  removed: 'border-red/40 bg-red/10 text-red',
};

// The detail view behind clicking an identifier on /dashboard/my-reports.
// Scoped to reporter_clerk_user_id = the signed-in user, same as the list
// page -- so this can never be used to look up someone else's report by
// guessing an id, and (unlike the subscriber search flow) viewing your own
// filed report here never spends a search credit.
export default async function MyReportDetailPage({ params }: { params: { id: string } }) {
  const { userId } = auth();

  if (!isSupabaseConfigured() || !userId) {
    return (
      <main className="min-h-screen px-6 py-24 text-center">
        <h1 className="text-3xl font-extrabold">Report details</h1>
        <p className="mt-4 text-muted">Sign in to see this report.</p>
      </main>
    );
  }

  const supabase = getServiceClient();
  const { data: report } = await supabase
    .from('reports')
    .select(
      'id, phone_numbers, subject_emails, social_handles, subject_first_name, scam_type, description, admin_summary, reporter_public_note, public_note_approved, status, created_at, tracking_code'
    )
    .eq('id', params.id)
    .eq('reporter_clerk_user_id', userId)
    .maybeSingle();

  if (!report) {
    notFound();
  }

  const identifiers = [
    ...(report.phone_numbers || []),
    ...(report.subject_emails || []),
    ...(report.social_handles || []),
  ];

  return (
    <main className="min-h-screen px-6 py-24 text-center">
      <div className="flex items-center justify-center gap-3 text-sm">
        <Link href="/dashboard/my-reports" className="text-orange underline">
          Back to My Reports
        </Link>
        <span className="text-muted">·</span>
        <Link href="/dashboard" className="text-orange underline">
          Go to Search
        </Link>
      </div>
      <h1 className="mt-4 text-3xl font-extrabold">Report details</h1>

      <div className="mx-auto mt-8 max-w-lg text-left">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className="min-w-0 break-words text-lg font-semibold">
              {identifiers.join(', ') || '—'}
            </span>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                STATUS_STYLES[report.status] || ''
              }`}
            >
              {report.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Filed {new Date(report.created_at).toLocaleDateString()}
            {report.subject_first_name ? `, ${report.subject_first_name}` : ''}
          </p>
          {report.scam_type?.length ? (
            <p className="mt-3 text-sm">
              <span className="text-muted">Category: </span>
              {report.scam_type.join(', ')}
            </p>
          ) : null}
          <p className="mt-3 text-sm">
            <span className="text-muted">Tracking code: </span>
            {report.tracking_code}
          </p>

          {report.description && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                What you reported
              </p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-navy p-3 text-sm text-muted">
                {report.description}
              </p>
            </div>
          )}

          {report.status === 'approved' && report.admin_summary && (
            <div className="mt-4 rounded-lg border border-orange/30 bg-orange/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange">
                Public summary shown to subscribers
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{report.admin_summary}</p>
            </div>
          )}

          {report.reporter_public_note && (
            <div className="mt-4 rounded-lg border border-border bg-navy p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Your public note{' '}
                {report.public_note_approved ? (
                  <span className="text-[#5aa9e6]">(approved, visible on search)</span>
                ) : (
                  <span className="text-muted">(not yet approved for public display)</span>
                )}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{report.reporter_public_note}</p>
            </div>
          )}

          {report.status === 'pending' && (
            <p className="mt-4 text-xs italic text-muted">
              Still awaiting review -- it'll only count in search results once approved.
            </p>
          )}
          {report.status === 'removed' && (
            <p className="mt-4 text-xs italic text-muted">
              This report was reviewed and removed, so it doesn't appear in search results.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
