'use client';

import { useState } from 'react';
import Link from 'next/link';
import SearchBox from './SearchBox';
import WatchList from './WatchList';
import EnhancedReportsList from './EnhancedReportsList';

type HistoryItem = {
  query_type: string;
  query_value: string;
  total_reports: number;
  category_counts: Record<string, number>;
  searched_at: string;
};

type Watch = {
  id: string;
  query_type: string;
  query_value: string;
  created_at: string;
};

type EnhancedReport = {
  id: string;
  query_type: string;
  query_value: string;
  category_counts: Record<string, number> | null;
  summary: string | null;
  resolved_at: string | null;
};

type MyReport = {
  id: string;
  phone_numbers: string[] | null;
  subject_emails: string[] | null;
  social_handles: string[] | null;
  status: string;
  created_at: string;
};

const MY_REPORT_STATUS_STYLES: Record<string, string> = {
  pending: 'border-orange/40 bg-orange/10 text-orange',
  approved: 'border-[#5aa9e6]/40 bg-[#5aa9e6]/10 text-[#5aa9e6]',
  removed: 'border-red/40 bg-red/10 text-red',
};

const TABS = ['search', 'watching', 'enhanced'] as const;
type Tab = (typeof TABS)[number];

// Splits what used to be one long, stacked dashboard page (search box,
// then a "Watching" section, then an "Enhanced Reports" section) into
// tabs instead. Each list already had its own pagination (10 per page) to
// keep it from turning into a wall of cards -- this just adds a second
// layer on top so a subscriber isn't scrolling past all three every time
// they only want one. Tab state resets on page reload, on purpose;
// there's no need to persist which tab was open across visits.
export default function DashboardTabs({
  initialCredits,
  initialHistory,
  watches,
  enhancedReports,
  myReports,
}: {
  initialCredits: number;
  initialHistory: HistoryItem[];
  watches: Watch[];
  enhancedReports: EnhancedReport[];
  myReports: MyReport[];
}) {
  const [tab, setTab] = useState<Tab>('search');

  const labels: Record<Tab, string> = {
    search: 'Search',
    watching: `Watching (${watches.length})`,
    enhanced: `Enhanced Reports (${enhancedReports.length})`,
  };

  return (
    <div className="mt-10">
      <div className="mx-auto flex max-w-md justify-center gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              tab === t
                ? 'border-white bg-white text-navy'
                : 'border-border text-muted hover:text-white'
            }`}
          >
            {labels[t]}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'search' && (
          <>
            <SearchBox initialCredits={initialCredits} initialHistory={initialHistory} />
            <p className="mt-6 text-sm text-muted">
              Have a whole list to report?{' '}
              <Link href="/dashboard/bulk-report" className="text-orange">
                Bulk-report it here
              </Link>
              .
            </p>

            {myReports.length > 0 && (
              <div className="mx-auto mt-8 max-w-md text-left">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
                    Recently filed by you
                  </h3>
                  <Link href="/dashboard/my-reports" className="text-xs text-orange underline">
                    View all
                  </Link>
                </div>
                <div className="mt-3 space-y-2">
                  {myReports.map((r) => (
                    <Link
                      key={r.id}
                      href={`/dashboard/my-reports/${r.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-white/30"
                    >
                      <span className="min-w-0 break-words">
                        {[
                          ...(r.phone_numbers || []),
                          ...(r.subject_emails || []),
                          ...(r.social_handles || []),
                        ].join(', ') || '—'}
                      </span>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${
                          MY_REPORT_STATUS_STYLES[r.status] || ''
                        }`}
                      >
                        {r.status}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'watching' && (
          <div className="mx-auto max-w-md text-left">
            <WatchList initialWatches={watches} />
          </div>
        )}

        {tab === 'enhanced' && (
          <div className="mx-auto max-w-md text-left">
            <EnhancedReportsList reports={enhancedReports} />
          </div>
        )}
      </div>
    </div>
  );
}
