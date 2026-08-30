'use client';

import { useState } from 'react';
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

      {history.length > 0 && (
        <div className="mt-4 text-left">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Recent searches
          </h2>
          <div className="space-y-2">
            {history.map((h, i) => {
              const marks = SCAM_TYPES.map((c) => [c, h.category_counts?.[c] ?? 0] as const).filter(
                ([, count]) => count > 0
              );
              return (
                <button
                  key={i}
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
        </div>
      )}

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
                <span className="font-semibold">{s.firstName || 'Unknown name'}</span>
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

    </div>
  );
}
