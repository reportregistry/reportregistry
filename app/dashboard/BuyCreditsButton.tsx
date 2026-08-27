'use client';

import { useState } from 'react';

export default function BuyCreditsButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'credits' }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLoading(false);
        alert(data.error || 'Could not start checkout. Try again.');
      }
    } catch {
      setLoading(false);
      alert('Could not start checkout. Try again.');
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-full border border-orange/40 px-3 py-1 text-xs font-medium text-orange transition hover:bg-orange/10 disabled:opacity-60"
    >
      {loading ? 'Redirecting…' : '+ Buy 50 priority searches — $10'}
    </button>
  );
}
