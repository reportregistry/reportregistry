'use client';

import { useState } from 'react';

type Subscriber = {
  id: string;
  clerk_user_id: string;
  email: string | null;
  status: string;
  plan: string | null;
  search_credits: number;
  purchased_credits: number;
  current_period_end: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  active: 'border-[#5aa9e6]/40 bg-[#5aa9e6]/10 text-[#5aa9e6]',
  past_due: 'border-orange/40 bg-orange/10 text-orange',
  canceled: 'border-red/40 bg-red/10 text-red',
  inactive: 'border-border bg-navy text-muted',
};

export default function AdminSubscriberList({
  initialSubscribers,
}: {
  initialSubscribers: Subscriber[];
}) {
  const [subscribers, setSubscribers] = useState(initialSubscribers);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});

  async function addCredits(clerkUserId: string) {
    const raw = amounts[clerkUserId];
    const amount = Number(raw);
    if (!raw || !Number.isFinite(amount) || amount === 0) {
      setError((prev) => ({ ...prev, [clerkUserId]: 'Enter a non-zero number.' }));
      return;
    }
    setError((prev) => ({ ...prev, [clerkUserId]: '' }));
    setBusyId(clerkUserId);
    try {
      const res = await fetch('/api/admin/subscriber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerk_user_id: clerkUserId, amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((prev) => ({ ...prev, [clerkUserId]: data.error || 'Failed.' }));
        return;
      }
      setSubscribers((prev) =>
        prev.map((s) =>
          s.clerk_user_id === clerkUserId
            ? { ...s, purchased_credits: s.purchased_credits + Math.round(amount) }
            : s
        )
      );
      setAmounts((prev) => ({ ...prev, [clerkUserId]: '' }));
    } finally {
      setBusyId(null);
    }
  }

  if (subscribers.length === 0) {
    return <p className="text-sm text-muted">No subscribers yet.</p>;
  }

  return (
    <div className="space-y-3">
      {subscribers.map((s) => (
        <div key={s.id} className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="font-semibold">{s.email || s.clerk_user_id}</span>
              {s.plan && <span className="ml-2 text-xs capitalize text-muted">{s.plan}</span>}
              <span className="ml-3 text-xs text-muted">
                Since {new Date(s.created_at).toLocaleDateString()}
              </span>
            </div>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                STATUS_STYLES[s.status] || STATUS_STYLES.inactive
              }`}
            >
              {s.status}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <p>
              <span className="text-muted">Free (resets monthly): </span>
              {s.search_credits}
            </p>
            <p>
              <span className="text-muted">Purchased/added: </span>
              {s.purchased_credits}
            </p>
            <p>
              <span className="text-muted">Total: </span>
              {s.search_credits + s.purchased_credits}
            </p>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="number"
              placeholder="e.g. 25 or -10"
              value={amounts[s.clerk_user_id] || ''}
              onChange={(e) =>
                setAmounts((prev) => ({ ...prev, [s.clerk_user_id]: e.target.value }))
              }
              className="w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange sm:w-40"
            />
            <button
              disabled={busyId === s.clerk_user_id}
              onClick={() => addCredits(s.clerk_user_id)}
              className="rounded-lg bg-orange px-3 py-2 text-xs font-semibold text-navy disabled:opacity-50"
            >
              Add to purchased credits
            </button>
            {error[s.clerk_user_id] && (
              <span className="text-xs text-red">{error[s.clerk_user_id]}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
