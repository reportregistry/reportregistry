'use client';

import { useState } from 'react';
import BuyCreditsButton from './BuyCreditsButton';

type Result = { isScam: boolean } | null;

export default function SearchBox({ initialCredits }: { initialCredits: number }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [error, setError] = useState('');

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

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    setDeepDiveState('idle');
    setDeepDiveError('');
    try {
      const { isEmail, phone, email } = parseQuery(query);
      const param = isEmail
        ? `email=${encodeURIComponent(email)}`
        : `phone=${encodeURIComponent(phone)}`;
      const res = await fetch(`/api/search?${param}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
      } else {
        setResult(data);
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
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
            ? '⚠️ Flagged as a scam. Reports have been filed on this contact.'
            : '✅ No scam reports found for this contact.'}
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
    </div>
  );
}
