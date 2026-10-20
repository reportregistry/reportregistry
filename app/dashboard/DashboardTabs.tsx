'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SearchBox from './SearchBox';
import WatchList from './WatchList';
import EnhancedReportsList from './EnhancedReportsList';
import { MyReportsList, type MyReportSummary } from './my-reports/MyReportsList';
import { RedAlertsList, type RedAlertReport } from './RedAlertsList';

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

const TABS = ['search', 'watching', 'enhanced', 'myReports', 'redAlerts'] as const;
type Tab = (typeof TABS)[number];

// Splits what used to be one long, stacked dashboard page (search box,
// then a "Watching" section, then an "Enhanced Reports" section) into
// tabs instead. Each list already had its own pagination (10 per page) to
// keep it from turning into a wall of cards -- this just adds a second
// layer on top so a subscriber isn't scrolling past all three every time
// they only want one. Tab state resets on page reload, on purpose;
// there's no need to persist which tab was open across visits.
//
// "My Reports" is the 4th tab here, rendering the exact same
// MyReportsList component (and the same reports + previousLastSeenAt data,
// see getMyReportsWithInbox in page.tsx) as the standalone
// /dashboard/my-reports page -- that page still exists on its own for the
// "My Reports" nav link and for signed-in users who aren't subscribers
// (filing is free and doesn't require a subscription), but a subscriber
// checking search now never has to leave this screen to see what they've
// filed.
//
// "Red Alerts" is the 5th tab -- a feed of every report an admin has
// approved as urgent (see api/admin/report/alert/route.ts), visible to
// every active subscriber. Same unread-badge treatment as My Reports, just
// tracked separately via red_alert_inbox_state so the two counts don't mix.
export default function DashboardTabs({
  initialCredits,
  initialHistory,
  watches,
  enhancedReports,
  myReports,
  myReportsPreviousLastSeenAt,
  redAlerts,
  redAlertsPreviousLastSeenAt,
}: {
  initialCredits: number;
  initialHistory: HistoryItem[];
  watches: Watch[];
  enhancedReports: EnhancedReport[];
  myReports: MyReportSummary[];
  myReportsPreviousLastSeenAt: string;
  redAlerts: RedAlertReport[];
  redAlertsPreviousLastSeenAt: string;
}) {
  // Lets the "Red Alerts" nav badge in SiteHeader.tsx link straight to
  // /dashboard?tab=redAlerts and land on that tab already open, instead of
  // dropping someone on Search and making them click again.
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = (TABS as readonly string[]).includes(requestedTab || '')
    ? (requestedTab as Tab)
    : 'search';
  const [tab, setTab] = useState<Tab>(initialTab);

  const newReportCount = myReports.filter(
    (r) => r.status !== 'pending' && r.resolved_at && r.resolved_at > myReportsPreviousLastSeenAt
  ).length;

  const newRedAlertCount = redAlerts.filter(
    (r) => r.alert_sent_at > redAlertsPreviousLastSeenAt
  ).length;

  const labels: Record<Tab, string> = {
    search: 'Search',
    watching: `Watching (${watches.length})`,
    enhanced: `Enhanced Reports (${enhancedReports.length})`,
    myReports: `My Reports (${myReports.length})${newReportCount > 0 ? ` · ${newReportCount} new` : ''}`,
    redAlerts: `Red Alerts (${redAlerts.length})${newRedAlertCount > 0 ? ` · ${newRedAlertCount} new` : ''}`,
  };

  return (
    <div className="mt-10">
      <div className="mx-auto flex max-w-md flex-wrap justify-center gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              tab === t
                ? 'border-white bg-white text-navy'
                : t === 'myReports' && newReportCount > 0
                  ? 'border-orange text-orange'
                  : t === 'redAlerts' && newRedAlertCount > 0
                    ? 'border-red text-red'
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

        {tab === 'myReports' && (
          <div className="mx-auto max-w-md text-left">
            <MyReportsList reports={myReports} previousLastSeenAt={myReportsPreviousLastSeenAt} />
            <p className="mt-4 text-center text-xs text-muted">
              <Link href="/report" className="text-orange underline">
                File another report
              </Link>
            </p>
          </div>
        )}

        {tab === 'redAlerts' && (
          <div className="mx-auto max-w-md text-left">
            <RedAlertsList reports={redAlerts} previousLastSeenAt={redAlertsPreviousLastSeenAt} />
          </div>
        )}
      </div>
    </div>
  );
}
