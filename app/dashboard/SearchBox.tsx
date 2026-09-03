'use client';

import { useState } from 'react';
import Link from 'next/link';
import BuyCreditsButton from './BuyCreditsButton';
import { SCAM_TYPES } from '@/lib/scamTypes';

type Result = {
  isScam: boolean;
  totalReports: number;
  categoryCounts: Record<string, number>;
  snippets: { firstName: string | null; categories: string[]; summary: string; reportedAt: string }[];
} | null;

type HistoryItem = {
  query_type: string;
  query_value: string;
  total_reports: number;
  category_counts: Record<string, number>;
  searched_at: string;
};

// Traffic-light thresholds for a single category's count: clean at 0,
// a caution zone once there's a report but it's not a pattern yet, and a
// hard warning once it stacks up. Applies per-category, not to the total.
function countColorClass(count: number): string {
  if (count === 0) return 'text-green-400';
  if (count <= 7) return 'text-orange';
  return 'text-red';
}

// Recent searches is capped at 25 stored rows (see dashboard/page.tsx),
// but stacking up to 25 cards on a narrow dashboard column gets messy
// fast -- paginate the display instead of dumping them all at once.
const HISTORY_PAGE_SIZE = 10;

export default function SearchBox({
  initialCredits,
  initialHistory = [],
}: {
  initialCredits: number;
  initialHistory?: HistoryItem[];
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState(initialHistory);
  const [historyPage, setHistoryPage] = useState(0);

  const [watching, setWatching] = useState<boolean | null>(null);
  const [watchBusy, setWatchBusy] = useState(false);

  const [credits, setCredits] = useState(initialCredits);
  const [deepDiveState, setDeepDiveState] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [deepDiveError, setDeepDiveError] = useState('');

  function parseQuery(raw: string) {
    const isEmail = raw.includes('@');
    return {
      isEmail,
      phone: isEmail ? '' : raw.trim(),
      email: isEmail ? raw.trim().toLowerCase() : '',
    };
  }

  async function runSearch(raw: string) {
    setLoading(true);
    setError('');
    setResult(null);
    setWatching(null);
    setDeepDiveState('idle');
    setDeepDiveError('');
    try {
      const { isEmail, phone, email } = parseQuery(raw);
      const param = isEmail
        ? `email=${encodeURIComponent(email)}`
        : `phone=${encodeURIComponent(phone)}`;
      const res = await fetch(`/api/search?${param}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
      } else {
        setResult(data);
        // Best-effort, separate from the main search result -- if this
        // fails for any reason, the watch toggle just stays hidden
        // (watching === null) rather than breaking the search itself.
        fetch(`/api/watch?${param}`)
          .then((r) => r.json())
          .then((w) => setWatching(Boolean(w.watching)))
          .catch(() => setWatching(null));
        // Search succeeded, so the API already logged it server-side --
        // mirror that here so "Recent searches" updates without a reload.
        // De-dupe by value first: re-searching something already in the
        // list (e.g. clicking a history item again) should move it back
        // to the top, not stack a duplicate copy underneath itself.
        const value = isEmail ? email : phone;
        setHistory((prev) => [
          {
            query_type: isEmail ? 'email' : 'phone',
            query_value: value,
            total_reports: data.totalReports,
            category_counts: data.categoryCounts,
            searched_at: new Date().toISOString(),
          },
          ...prev.filter((h) => h.query_value.toLowerCase() !== value.toLowerCase()),
        ].slice(0, 25));
        // The new/moved-up entry always lands at the top of the list, so
        // jump back to page 1 to show it rather than leaving the user
        // stranded on whatever page they were previously viewing.
        setHistoryPage(0);
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  function searchAgain(value: string) {
    setQuery(value);
    runSearch(value);
  }

  async function toggleWatch() {
    if (watching === null) return;
    const { isEmail, phone, email } = parseQuery(query);
    setWatchBusy(true);
    try {
      const res = await fetch('/api/watch', {
        method: watching ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEmail ? { email } : { phone }),
      });
      if (res.ok) setWatching((w) => !w);
    } finally {
      setWatchBusy(false);
    }
  }

  async function handleDeepDive() {
    setDeepDiveState('submitting');
    setDeepDiveError('');
    try {
      const { isEmail, phone, email } = parseQuery(query);
      const res = await fetch('/api/search/deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEmail ? { email } : { phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeepDiveError(data.error || 'Something went wrong.');
        setDeepDiveState('idle');
      } else {
        setCredits((c) => c - 1);
        setDeepDiveState('done');
      }
    } catch {
      setDeepDiveError('Something went wrong. Try again.');
      setDeepDiveState('idle');
    }
  }

  const totalHistoryPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const visibleHistory = history.slice(
    historyPage * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE
  );

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <span>
          Priority search credits: <span className="font-semibold text-white">{credits}</span>
        </span>
        <BuyCreditsButton />
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          required
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Phone number or email"
          className="flex-1 rounded-lg border border-border bg-card px-4 py-3 text-white outline-none focus:border-orange"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-gradient-to-br from-red to-orange px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Checking…' : 'Check'}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-red bg-red/10 p-4 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div
          className={`mt-4 rounded-lg border p-4 text-center font-semibold ${
            result.isScam
              ? 'border-red bg-red/10 text-red'
              : 'border-green-500 bg-green-500/10 text-green-400'
          }`}
        >
          {result.isScam
            ? `⚠️ ${result.totalReports} report${result.totalReports === 1 ? '' : 's'} on file for this contact.`
            : '✅ No scam reports found for this contact.'}
        </div>
      )}

      {result && watching !== null && (
        <button
          onClick={toggleWatch}
          disabled={watchBusy}
          className={`mt-2 w-full text-center text-xs transition disabled:opacity-50 ${
            watching ? 'text-[#2dd4bf]' : 'text-muted hover:text-[#2dd4bf]'
          }`}
        >
          {watching
            ? '★ Watching, you\'ll get an email if a new report lands on this'
            : '☆ Watch this number/email for future reports'}
        </button>
      )}

      {result && (
        <div className="mt-3 space-y-1.5 rounded-lg border border-border bg-card p-4 text-sm">
          {/* Every category always shows, even at 0, so the color itself
              tells the story: green means clean, not just "no data yet". */}
          {SCAM_TYPES.map((category) => {
            const count = result.categoryCounts[category] ?? 0;
            return (
              <div key={category} className="flex items-center justify-between">
                <span className="text-muted">{category}</span>
                <span className={`font-semibold ${countColorClass(count)}`}>{count}</span>
              </div>
            );
          })}
          {result.categoryCounts['Unspecified'] > 0 && (
            <div className="flex items-center justify-between border-t border-border pt-1.5">
              <span className="text-muted">Uncategorized</span>
              <span className={`font-semibold ${countColorClass(result.categoryCounts['Unspecified'])}`}>
                {result.categoryCounts['Unspecified']}
              </span>
            </div>
          )}
        </div>
      )}

      {result && !result.isScam && deepDiveState !== 'done' && (
        <div className="mt-3 rounded-lg border border-border bg-card p-4 text-center text-sm">
          <p className="text-muted">
            Not in our records doesn't always mean it's safe. Spend 1 priority
            search credit to have an admin manually dig into this one.
          </p>
          <button
            onClick={handleDeepDive}
            disabled={deepDiveState === 'submitting' || credits <= 0}
            className="mt-3 rounded-lg border border-orange px-4 py-2 text-xs font-semibold text-orange transition hover:bg-orange/10 disabled:opacity-50"
          >
            {deepDiveState === 'submitting'
              ? 'Submitting…'
              : credits <= 0
              ? 'No credits left, buy a 50-pack above'
              : 'Request a deeper dive (1 credit)'}
          </button>
          {deepDiveError && <p className="mt-2 text-xs text-red">{deepDiveError}</p>}

          {/* If it's the person who searched who actually got scammed by
              this clean-so-far number, get them straight into the report
              form with it already filled in -- one click instead of
              retyping what they just searched. */}
          <p className="mt-3 text-xs text-muted">
            Got scammed by this one?{' '}
            <Link
              href={`/report?${parseQuery(query).isEmail ? 'email' : 'phone'}=${encodeURIComponent(
                query.trim()
              )}`}
              className="text-orange underline"
            >
              File a report on it
            </Link>
            .
          </p>
        </div>
      )}

      {deepDiveState === 'done' && (
        <div className="mt-3 rounded-lg border border-orange bg-orange/10 p-4 text-center text-sm">
          Submitted. An admin will manually look into this one.
        </div>
      )}

      {result && result.snippets.length > 0 && (
        <div className="mt-3 space-y-2">
          {result.snippets.map((s, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 text-left text-sm">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="font-semibold">{s.firstName}</span>
                <span className="text-xs text-muted">
                  {new Date(s.reportedAt).toLocaleDateString()}
                </span>
              </div>
              {s.categories.length > 0 && (
                <p className="mt-1 text-xs text-orange">{s.categories.join(', ')}</p>
              )}
              <p className="mt-1.5 text-muted">{s.summary}</p>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-6 border-t border-border pt-4 text-left">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
              Recent searches ({history.length})
            </h2>
            {totalHistoryPages > 1 && (
              <span className="text-xs text-muted">
                Page {historyPage + 1} of {totalHistoryPages}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {visibleHistory.map((h, i) => {
              const marks = SCAM_TYPES.map((c) => [c, h.category_counts?.[c] ?? 0] as const).filter(
                ([, count]) => count > 0
              );
              return (
                <button
                  key={`${h.query_value}-${h.searched_at}`}
                  onClick={() => searchAgain(h.query_value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition hover:border-orange/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate text-white">{h.query_value}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted">
                      {new Date(h.searched_at).toLocaleDateString()}
                    </span>
                  </div>
                  {marks.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {marks.map(([category, count]) => (
                        <span key={category} className={`text-xs ${countColorClass(count)}`}>
                          {category}: {count}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="mt-1 block text-xs text-green-400">clean</span>
                  )}
                </button>
              );
            })}
          </div>

          {totalHistoryPages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-3">
              <button
                onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                disabled={historyPage === 0}
                className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-muted transition hover:text-white disabled:opacity-30"
              >
                Prev
              </button>
              <button
                onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages - 1, p + 1))}
                disabled={historyPage >= totalHistoryPages - 1}
                className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-muted transition hover:text-white disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
