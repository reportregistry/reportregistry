'use client';

import { useState } from 'react';

export default function SubscribeButton() {
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'annual' | null>(null);

  async function handleClick(plan: 'monthly' | 'annual') {
    setLoadingPlan(plan);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLoadingPlan(null);
        alert(data.error || 'Could not start checkout. Try again.');
      }
    } catch {
      setLoadingPlan(null);
      alert('Could not start checkout. Try again.');
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        onClick={() => handleClick('monthly')}
        disabled={loadingPlan !== null}
        className="flex-1 rounded-lg bg-gradient-to-br from-red to-orange px-6 py-3 font-semibold text-white disabled:opacity-60"
      >
        {loadingPlan === 'monthly' ? 'Redirecting…' : '$7.99/month'}
      </button>
      <button
        onClick={() => handleClick('annual')}
        disabled={loadingPlan !== null}
        className="flex-1 rounded-lg border border-orange px-6 py-3 font-semibold text-orange disabled:opacity-60"
      >
        {loadingPlan === 'annual' ? 'Redirecting…' : '$74.99/year'}
      </button>
    </div>
  );
}
