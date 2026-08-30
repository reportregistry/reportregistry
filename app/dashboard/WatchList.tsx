'use client';

import { useState } from 'react';

const PAGE_SIZE = 10;

type Watch = {
  id: string;
  query_type: string;
  query_value: string;
  created_at: string;
};

// Lists everything the subscriber is currently watching (see the "Watch
// this number" toggle in SearchBox.tsx) with a one-click unwatch. This
// list is fetched at page load and doesn't live-sync with SearchBox's own
// toggle state -- a page refresh reconciles the two, which is an
// acceptable tradeoff for how infrequently someone adds/removes a watch.
export default function WatchList({ initialWatches }: { initialWatches: Watch[] }) {
  const [watches, setWatches] = useState(initialWatches);
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function unwatch(w: Watch) {
    setBusyId(w.id);
    try {
      const res = await fetch('/api/watch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(w.query_type === 'phone' ? { phone: w.query_value } : { email: w.query_value }),
      });
      if (res.ok) {
        setWatches((prev) => prev.filter((x) => x.id !== w.id));
      }
    } finally {
      setBusyId(null);
    }
  }

  if (watches.length === 0) {
    return (
      <p className="text-center text-sm text-muted">
        Not watching anything yet. Search a number or email, then use the
        "Watch this number" link under the result to get emailed if a new
        report ever lands on it.
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(watches.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const visible = watches.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      {totalPages > 1 && (
        <p className="mb-2 text-right text-xs text-muted">
          Page {clampedPage + 1} of {totalPages}
        </p>
      )}
      <div className="space-y-2">
        {visible.map((w) => (
          <div
            key={w.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <span className="truncate text-white">{w.query_value}</span>
            <button
              onClick={() => unwatch(w)}
              disabled={busyId === w.id}
              className="ml-3 shrink-0 text-xs text-muted underline decoration-dotted hover:text-red disabled:opacity-50"
            >
              {busyId === w.id ? 'Removing…' : 'Unwatch'}
            </button>
          </div>
        ))}
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
