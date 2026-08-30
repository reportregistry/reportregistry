'use client';

import { useState } from 'react';
import { SCAM_TYPES } from '@/lib/scamTypes';

type Lookup = {
  queryType: 'phone' | 'email';
  queryValue: string;
  computedCounts: Record<string, number>;
  overrideCounts: Record<string, number>;
  notes: string;
  updatedBy: string | null;
  updatedAt: string | null;
} | null;

// Manual per-category count overrides for a phone number or email. There
// is no stored "profile" row anywhere else in the app -- search always
// computes categoryCounts fresh from approved reports. This is the one
// place an admin can add to that number, e.g. for incidents known about
// but not worth filing as a separate report. Overrides ADD to the real
// count, they never replace or hide it -- the "Real (from filed reports)"
// column below always reflects actual approved reports regardless of
// what's set here.
export default function AdminProfileOverrides() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lookup, setLookup] = useState<Lookup>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  async function runLookup() {
    const raw = query.trim();
    if (!raw) return;
    setLoading(true);
    setError('');
    setSaveMsg('');
    setLookup(null);
    try {
      const isEmail = raw.includes('@');
      const param = isEmail ? `email=${encodeURIComponent(raw)}` : `phone=${encodeURIComponent(raw)}`;
      const res = await fetch(`/api/admin/profile-override?${param}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Lookup failed.');
        return;
      }
      setLookup(data);
      const nextDrafts: Record<string, string> = {};
      for (const category of SCAM_TYPES) {
        nextDrafts[category] = data.overrideCounts?.[category]
          ? String(data.overrideCounts[category])
          : '';
      }
      setDrafts(nextDrafts);
      setNotes(data.notes || '');
    } catch {
      setError('Lookup failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!lookup) return;
    setSaving(true);
    setSaveMsg('');
    setError('');
    try {
      const categoryCounts: Record<string, number> = {};
      for (const category of SCAM_TYPES) {
        const n = Number(drafts[category]);
        if (Number.isFinite(n) && n > 0) categoryCounts[category] = Math.floor(n);
      }
      const res = await fetch('/api/admin/profile-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [lookup.queryType]: lookup.queryValue,
          categoryCounts,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save.');
        return;
      }
      setSaveMsg(data.cleared ? 'Override cleared.' : 'Override saved.');
      setLookup((prev) => (prev ? { ...prev, overrideCounts: categoryCounts, notes } : prev));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runLookup()}
          placeholder="Phone number or email to look up"
          className="flex-1 rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange"
        />
        <button
          onClick={runLookup}
          disabled={loading || !query.trim()}
          className="rounded-lg bg-orange px-4 py-2 text-xs font-semibold text-navy disabled:opacity-50"
        >
          {loading ? 'Looking up…' : 'Look up'}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-red">{error}</p>}

      {lookup && (
        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <p className="text-sm">
            <span className="text-muted">{lookup.queryType === 'phone' ? 'Phone' : 'Email'}: </span>
            <span className="font-semibold">{lookup.queryValue}</span>
          </p>
          {lookup.updatedBy && (
            <p className="mt-1 text-xs text-muted">
              Last override edit by {lookup.updatedBy}
              {lookup.updatedAt ? ` on ${new Date(lookup.updatedAt).toLocaleString()}` : ''}
            </p>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Real (from filed reports)</th>
                  <th className="pb-2">Manual override (added on top)</th>
                </tr>
              </thead>
              <tbody>
                {SCAM_TYPES.map((category) => (
                  <tr key={category} className="border-t border-border">
                    <td className="py-2 pr-4">{category}</td>
                    <td className="py-2 pr-4 text-muted">{lookup.computedCounts[category] ?? 0}</td>
                    <td className="py-2">
                      <input
                        type="number"
                        min={0}
                        value={drafts[category] ?? ''}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [category]: e.target.value }))
                        }
                        className="w-20 rounded-lg border border-border bg-navy px-2 py-1 text-sm outline-none focus:border-orange"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="mt-4 block text-xs">
            <span className="mb-1 block text-muted">
              Internal notes (why this override exists -- staff only, never shown to subscribers)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange"
            />
          </label>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-navy disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save override'}
            </button>
            {saveMsg && <span className="text-xs text-muted">{saveMsg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
