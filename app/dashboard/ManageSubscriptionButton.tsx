'use client';

import { useState } from 'react';

// Hits the already-existing /api/stripe/portal route (it was built but
// never had a button calling it) to send the subscriber to Stripe's
// hosted billing portal -- update card, switch monthly/annual, cancel,
// see invoices. Safe to render for anyone signed in regardless of
// current status: if there's no Stripe customer on file yet, the API
// just returns a 404 and this shows a friendly message instead of
// erroring.
export default function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLoading(false);
        setError(data.error || 'Could not open billing portal. Try again.');
      }
    } catch {
      setLoading(false);
      setError('Could not open billing portal. Try again.');
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-xs text-muted underline decoration-dotted hover:text-white disabled:opacity-60"
      >
        {loading ? 'Redirecting…' : 'Manage billing'}
      </button>
      {error && <p className="mt-1 text-xs text-red">{error}</p>}
    </div>
  );
}
