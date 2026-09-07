'use client';

import { useState } from 'react';
import Link from 'next/link';

const PAGE_SIZE = 25;

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
// apart over time. Client-side search + 25-per-page pagination (same
// PAGE_SIZE convention as WatchList.tsx / EnhancedReportsList.tsx) live
// here too, since both callers pass in the same up-to-200-row dataset and
// shouldn't have to re-implement filtering separately.
export function MyReportsList({
  reports,
  previousLastSeenAt,
}: {
  reports: MyReportSummary[];
  previousLastSeenAt: string;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

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

  const searchTerm = search.trim().toLowerCase();
  const filtered = searchTerm
    ? reports.filter((r) => {
        const haystack = [
          ...(r.phone_numbers || []),
          ...(r.subject_emails || []),
          ...(r.social_handles || []),
          r.subject_first_name,
          r.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(searchTerm);
      })
    : reports;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
        placeholder="Search your reports by phone, email, social tag, name, or status"
        className="mb-4 w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange"
      />

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted">No matches for "{search}".</p>
      ) : (
        <>
          {totalPages > 1 && (
            <p className="mb-2 text-right text-xs text-muted">
              Page {clampedPage + 1} of {totalPages}
            </p>
          )}
          <div className="space-y-3">
            {visible.map((r) => {
              const isNew =
                r.status !== 'pending' && r.resolved_at && r.resolved_at > previousLastSeenAt;
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
                      {[
                        ...(r.phone_numbers || []),
                        ...(r.subject_emails || []),
                        ...(r.social_handles || []),
                      ].join(', ') || '—'}
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

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={clampedPage === 0}
                className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-muted transition hover:text-white disabled:opacity-30"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={clampedPage >= totalPages - 1}
                className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-muted transition hover:text-white disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
