'use client';

import { useState } from 'react';
import { SCAM_TYPES } from '@/lib/scamTypes';

type DeepDive = {
  id: string;
  clerk_user_id: string;
  query_type: string;
  query_value: string;
  status: string;
  admin_notes: string | null;
  category_counts: Record<string, number> | null;
  summary: string | null;
  created_at: string;
};

type Draft = {
  notes: string;
  summary: string;
  counts: Record<string, string>;
};

function emptyDraft(): Draft {
  return { notes: '', summary: '', counts: {} };
}

// Quick-fill buttons for the subscriber-facing summary -- covers the most
// common outcomes so staff aren't retyping the same few sentences on
// every deep dive. Clicking one fills the textarea; it's still a normal
// editable field afterward, so these are a starting point, not a lock-in.
// The "Clean" preset pairs with the green styling on the subscriber's
// Enhanced Reports page (see EnhancedReportsList.tsx), which colors the
// summary green whenever category_counts ends up empty -- so as long as
// you leave all the counts at 0 for a clean result, it'll render green
// regardless of which preset (or custom text) you use here.
const SUMMARY_PRESETS = [
  { label: 'Clean', text: 'Clean! Nothing to report on this one.' },
  { label: 'Confirmed scammer', text: 'Confirmed: this matches patterns from other reports on file.' },
  { label: 'Inconclusive', text: "Inconclusive. We didn't find strong evidence either way." },
  { label: 'Red flags found', text: 'Multiple red flags found. Proceed with caution.' },
];

export default function AdminDeepDiveList({ initialRequests }: { initialRequests: DeepDive[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  function draftFor(id: string): Draft {
    return drafts[id] || emptyDraft();
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...draftFor(id), ...patch } }));
  }

  async function complete(id: string) {
    const draft = draftFor(id);
    const category_counts: Record<string, number> = {};
    for (const t of SCAM_TYPES) {
      const n = Number(draft.counts[t]);
      if (Number.isFinite(n) && n > 0) category_counts[t] = Math.round(n);
    }

    setBusyId(id);
    try {
      const res = await fetch('/api/admin/deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          admin_notes: draft.notes || '',
          summary: draft.summary || '',
          category_counts,
        }),
      });
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, status: 'completed', admin_notes: draft.notes || null, summary: draft.summary || null, category_counts }
              : r
          )
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  const visible = requests.filter((r) => (showCompleted ? true : r.status === 'pending'));
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">{pendingCount} pending deep-dive request(s)</p>
        <button
          onClick={() => setShowCompleted((s) => !s)}
          className="text-xs text-muted hover:text-white"
        >
          {showCompleted ? 'Hide completed' : 'Show completed'}
        </button>
      </div>

      {visible.length === 0 && <p className="text-sm text-muted">Nothing here right now.</p>}

      <div className="space-y-3">
        {visible.map((r) => {
          const draft = draftFor(r.id);
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-semibold capitalize">{r.query_type}:</span>{' '}
                  {r.query_value}
                  <span className="ml-3 text-xs text-muted">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                    r.status === 'pending'
                      ? 'border-orange/40 bg-orange/10 text-orange'
                      : 'border-[#5aa9e6]/40 bg-[#5aa9e6]/10 text-[#5aa9e6]'
                  }`}
                >
                  {r.status}
                </span>
              </div>

              {r.status === 'pending' ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs text-muted">
                      Category counts (what your research found -- leave any at 0 that don't apply)
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {SCAM_TYPES.map((t) => (
                        <div key={t} className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={draft.counts[t] || ''}
                            onChange={(e) =>
                              updateDraft(r.id, { counts: { ...draft.counts, [t]: e.target.value } })
                            }
                            className="w-14 rounded-lg border border-border bg-navy px-2 py-1.5 text-xs outline-none focus:border-[#5aa9e6]"
                          />
                          <span className="text-xs text-muted">{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-muted">
                      Summary shown to the subscriber (max 500 chars, optional)
                    </label>
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      {SUMMARY_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => updateDraft(r.id, { summary: preset.text })}
                          className="rounded-full border border-border px-2.5 py-1 text-xs text-muted transition hover:border-[#5aa9e6]/50 hover:text-white"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={draft.summary}
                      onChange={(e) => updateDraft(r.id, { summary: e.target.value })}
                      maxLength={500}
                      rows={2}
                      className="w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-[#5aa9e6]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-muted">
                      Internal notes (staff only, never shown to the subscriber)
                    </label>
                    <input
                      type="text"
                      value={draft.notes}
                      onChange={(e) => updateDraft(r.id, { notes: e.target.value })}
                      className="w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange"
                    />
                  </div>

                  <button
                    disabled={busyId === r.id}
                    onClick={() => complete(r.id)}
                    className="rounded-lg bg-[#5aa9e6] px-3 py-2 text-xs font-semibold text-navy disabled:opacity-50"
                  >
                    Mark completed
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {r.category_counts && Object.keys(r.category_counts).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(r.category_counts).map(([cat, count]) => (
                        <span
                          key={cat}
                          className="rounded-full border border-[#5aa9e6]/40 bg-[#5aa9e6]/10 px-2.5 py-0.5 text-xs text-[#5aa9e6]"
                        >
                          {cat}: {count}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.summary && (
                    <p
                      className={`rounded-lg bg-navy p-2 text-xs ${
                        r.category_counts && Object.keys(r.category_counts).length > 0
                          ? 'text-white'
                          : 'text-green-400'
                      }`}
                    >
                      {r.summary}
                    </p>
                  )}
                  {r.admin_notes && (
                    <p className="rounded-lg bg-navy p-2 text-xs text-muted">
                      Internal note: {r.admin_notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
