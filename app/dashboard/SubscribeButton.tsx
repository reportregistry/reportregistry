'use client';

import { useState } from 'react';

export default function SubscribeButton() {
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'annual' | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');

  async function handleClick(plan: 'monthly' | 'annual') {
    if (!referralCode.trim()) {
      setError('A referral code is required to subscribe.');
      return;
    }
    setError('');
    setLoadingPlan(plan);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, referral_code: referralCode.trim() }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLoadingPlan(null);
        setError(data.error || 'Could not start checkout. Try again.');
      }
    } catch {
      setLoadingPlan(null);
      setError('Could not start checkout. Try again.');
    }
  }

  return (
    <div>
      <label className="mb-2 block text-left text-xs text-muted">
        Referral code (required to subscribe)
      </label>
      <input
        type="text"
        value={referralCode}
        onChange={(e) => {
          setReferralCode(e.target.value);
          setError('');
        }}
        placeholder="Enter your referral code"
        className="mb-3 w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange"
      />
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
      {error && <p className="mt-2 text-xs text-red">{error}</p>}
    </div>
  );
}
