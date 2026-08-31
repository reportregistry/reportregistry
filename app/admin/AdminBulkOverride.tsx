'use client';

import { useState } from 'react';
import { SCAM_TYPES } from '@/lib/scamTypes';

// Applies the same manual category-count override to a whole pasted list
// of phone numbers or emails at once -- for cases like a batch you
// already have documented incident counts for (from another source, a
// spreadsheet, etc), rather than looking each one up individually in the
// single-lookup tool above. Still additive on top of real filed reports
// at search time, same mechanism as the single override -- see
// api/admin/profile-override/bulk/route.ts.
export default function AdminBulkOverride() {
  const [queryType, setQueryType] = useState<'phone' | 'email'>('phone');
  const [values, setValues] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    setResult('');

    const list = values
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
    if (list.length === 0) {
      setError('Paste at least one phone number or email, one per line.');
      return;
    }

    const categoryCounts: Record<string, number> = {};
    for (const category of SCAM_TYPES) {
      const n = Number(counts[category]);
      if (Number.isFinite(n) && n > 0) categoryCounts[category] = Math.floor(n);
    }
    if (Object.keys(categoryCounts).length === 0) {
      setError('Enter at least one category count above 0.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/profile-override/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryType, values: list, categoryCounts, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to apply.');
        return;
      }
      setResult(`Applied to ${data.applied} ${queryType === 'phone' ? 'number(s)' : 'email(s)'}.`);
      setValues('');
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="mb-3 text-sm font-semibold">Bulk apply to a list</p>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setQueryType('phone')}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            queryType === 'phone' ? 'border-white bg-white text-navy' : 'border-border text-muted'
          }`}
        >
          Phone numbers
        </button>
        <button
          type="button"
          onClick={() => setQueryType('email')}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            queryType === 'email' ? 'border-white bg-white text-navy' : 'border-border text-muted'
          }`}
        >
          Emails
        </button>
      </div>

      <textarea
        value={values}
        onChange={(e) => setValues(e.target.value)}
        rows={6}
        placeholder={queryType === 'phone' ? 'One phone number per line' : 'One email per line'}
        className="w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange"
      />

      <p className="mb-1.5 mt-3 text-xs text-muted">
        Category counts to apply to EVERY entry above (added on top of each one's real filed-report count)
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SCAM_TYPES.map((category) => (
          <div key={category} className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              placeholder="0"
              value={counts[category] || ''}
              onChange={(e) => setCounts((prev) => ({ ...prev, [category]: e.target.value }))}
              className="w-14 rounded-lg border border-border bg-navy px-2 py-1.5 text-xs outline-none focus:border-orange"
            />
            <span className="text-xs text-muted">{category}</span>
          </div>
        ))}
      </div>

      <label className="mt-3 block text-xs">
        <span className="mb-1 block text-muted">
          Internal notes (why -- e.g. source of these counts. Staff only.)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={2}
          className="w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange"
        />
      </label>

      {error && <p className="mt-2 text-xs text-red">{error}</p>}
      {result && <p className="mt-2 text-xs text-[#5aa9e6]">{result}</p>}

      <button
        onClick={submit}
        disabled={submitting}
        className="mt-3 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-navy disabled:opacity-50"
      >
        {submitting ? 'Applying…' : 'Apply to all'}
      </button>
    </div>
  );
}
