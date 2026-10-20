'use client';

import { useState } from 'react';

const PAGE_SIZE = 20;

export type RedAlertReport = {
  id: string;
  phone_numbers: string[] | null;
  subject_emails: string[] | null;
  social_handles: string[] | null;
  subject_first_name: string | null;
  scam_type: string[] | null;
  alert_message: string | null;
  alert_sent_at: string;
};

// The "Red Alerts" tab in DashboardTabs.tsx -- every report an admin has
// approved into this feed (reports.alert_sent_at is set, see
// api/admin/report/alert/route.ts), newest first, 20 per page per request.
// Visible to every active subscriber, not just whoever watched or searched
// this specific number -- that's the whole point versus the Watch feature.
// "New" highlighting + the nav badge in SiteHeader.tsx both key off
// red_alert_inbox_state, same pattern as My Reports' unread badge.
export function RedAlertsList({
  reports,
  previousLastSeenAt,
}: {
  reports: RedAlertReport[];
  previousLastSeenAt: string;
}) {
  const [page, setPage] = useState(0);

  if (reports.length === 0) {
    return (
      <p className="text-center text-sm text-muted">
        Nothing in the Red Alerts feed right now. Reports an admin flags as
        urgent will show up here for every subscriber to see.
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const visible = reports.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      {totalPages > 1 && (
        <p className="mb-2 text-right text-xs text-muted">
          Page {clampedPage + 1} of {totalPages}
        </p>
      )}
      <div className="space-y-3">
        {visible.map((r) => {
          const isNew = r.alert_sent_at > previousLastSeenAt;
          const identifiers = [
            ...(r.phone_numbers || []),
            ...(r.subject_emails || []),
            ...(r.social_handles || []),
          ].join(', ');
          return (
            <div
              key={r.id}
              className={`rounded-xl border p-5 text-left ${
                isNew ? 'border-red bg-red/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0 break-words text-sm font-semibold">
                  ⚠️ {identifiers || '—'}
                  {isNew && (
                    <span className="ml-2 inline-block rounded-full bg-red px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      New
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {new Date(r.alert_sent_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {r.subject_first_name ? `${r.subject_first_name} · ` : ''}
                {r.scam_type?.length ? r.scam_type.join(', ') : 'Uncategorized'}
              </p>
              {r.alert_message && (
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-navy p-3 text-sm text-white">{r.alert_message}</p>
              )}
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
    </div>
  );
}
