import Link from 'next/link';

export type MyReportSummary = {
  id: string;
  phone_numbers: string[] | null;
  subject_emails: string[] | null;
  social_handles: string[] | null;
  subject_first_name: string | null;
  status: string;
  resolved_at: string | null;
  created_at: string;
};

export const MY_REPORT_STATUS_STYLES: Record<string, string> = {
  pending: 'border-orange/40 bg-orange/10 text-orange',
  approved: 'border-[#5aa9e6]/40 bg-[#5aa9e6]/10 text-[#5aa9e6]',
  removed: 'border-red/40 bg-red/10 text-red',
};

// Shared card-list rendering for "reports I've filed" -- used by both the
// standalone /dashboard/my-reports page (the canonical, full list; also
// the one that clears the unread badge in SiteHeader.tsx) and the "My
// Reports" tab on the main dashboard (DashboardTabs.tsx), so a subscriber
// sees IDENTICAL styling and "New" logic no matter which door they came
// in through, instead of two slightly different hand-rolled lists drifting
// apart over time.
export function MyReportsList({
  reports,
  previousLastSeenAt,
}: {
  reports: MyReportSummary[];
  previousLastSeenAt: string;
}) {
  if (reports.length === 0) {
    return (
      <p className="text-center text-sm text-muted">
        You haven't filed any reports while signed in yet.{' '}
        <Link href="/report" className="text-orange underline">
          File one here
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => {
        const isNew = r.status !== 'pending' && r.resolved_at && r.resolved_at > previousLastSeenAt;
        return (
          <div
            key={r.id}
            className={`rounded-xl border p-5 ${
              isNew ? 'border-orange bg-orange/5' : 'border-border bg-card'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/dashboard/my-reports/${r.id}`}
                className="min-w-0 break-words text-sm font-semibold text-white underline decoration-dotted hover:text-orange"
              >
                {[...(r.phone_numbers || []), ...(r.subject_emails || []), ...(r.social_handles || [])].join(
                  ', '
                ) || '—'}
                {isNew && (
                  <span className="ml-2 inline-block rounded-full bg-orange px-2 py-0.5 text-[10px] font-bold uppercase text-navy">
                    New
                  </span>
                )}
              </Link>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                  MY_REPORT_STATUS_STYLES[r.status] || ''
                }`}
              >
                {r.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Filed {new Date(r.created_at).toLocaleDateString()}
              {r.subject_first_name ? `, ${r.subject_first_name}` : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}
