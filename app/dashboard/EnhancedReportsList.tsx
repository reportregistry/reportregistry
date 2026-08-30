'use client';

import { useState } from 'react';

// Same pagination treatment as SearchBox's "Recent searches" -- capped at
// 25 rows server-side (see dashboard/page.tsx's getEnhancedReports), but
// paginated here instead of stacked all at once so the dashboard doesn't
// turn into a wall of cards once someone's requested a bunch of deep dives.
const PAGE_SIZE = 10;

type EnhancedReport = {
  id: string;
  query_type: string;
  query_value: string;
  category_counts: Record<string, number> | null;
  summary: string | null;
  resolved_at: string | null;
};

export default function EnhancedReportsList({ reports }: { reports: EnhancedReport[] }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  if (reports.length === 0) {
    return (
      <p className="text-center text-sm text-muted">
        Nothing here yet. Results from any priority-search deep dive you
        request will show up in this list once an admin completes it.
      </p>
    );
  }

  const searchTerm = search.trim().toLowerCase();
  const filtered = searchTerm
    ? reports.filter((r) => r.query_value.toLowerCase().includes(searchTerm))
    : reports;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      {reports.length > PAGE_SIZE && (
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Search by phone or email"
          className="mb-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-orange"
        />
      )}

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted">No matches for "{search}".</p>
      )}

      {totalPages > 1 && filtered.length > 0 && (
        <p className="mb-2 text-right text-xs text-muted">
          Page {clampedPage + 1} of {totalPages}
        </p>
      )}
      <div className="space-y-3">
        {visible.map((r) => {
          // "Clean" is driven by the actual data (no categories flagged),
          // not by matching the admin's wording -- so a custom-written
          // all-clear summary gets the same green treatment as one filled
          // in from the "Clean" preset in /admin.
          const isClean = !r.category_counts || Object.keys(r.category_counts).length === 0;
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold capitalize">
                  {r.query_type}: {r.query_value}
                </span>
                {r.resolved_at && (
                  <span className="text-xs text-muted">
                    {new Date(r.resolved_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {!isClean ? (
                <div className="mt-3 space-y-1.5 text-sm">
                  {Object.entries(r.category_counts!).map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="text-muted">{category}</span>
                      <span className="font-semibold text-orange">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm font-semibold text-green-400">
                  Clean, nothing concerning turned up.
                </p>
              )}

              {r.summary && (
                <p
                  className={`mt-3 rounded-lg bg-navy p-3 text-sm ${
                    isClean ? 'text-green-400' : 'text-white'
                  }`}
                >
                  {r.summary}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && filtered.length > 0 && (
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
