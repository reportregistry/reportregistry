'use client';

import { useState } from 'react';

type DeepDive = {
  id: string;
  clerk_user_id: string;
  query_type: string;
  query_value: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

export default function AdminDeepDiveList({ initialRequests }: { initialRequests: DeepDive[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  async function complete(id: string) {
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, admin_notes: notes[id] || '' }),
      });
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: 'completed', admin_notes: notes[id] || null } : r))
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
        {visible.map((r) => (
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
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  placeholder="Notes on what you found (optional)"
                  value={notes[r.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className="flex-1 rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange"
                />
                <button
                  disabled={busyId === r.id}
                  onClick={() => complete(r.id)}
                  className="rounded-lg bg-[#5aa9e6] px-3 py-2 text-xs font-semibold text-navy disabled:opacity-50"
                >
                  Mark completed
                </button>
              </div>
            ) : (
              r.admin_notes && (
                <p className="mt-2 rounded-lg bg-navy p-2 text-xs text-muted">{r.admin_notes}</p>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
