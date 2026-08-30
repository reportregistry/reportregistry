'use client';

import { useState } from 'react';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending review', className: 'border-orange/40 bg-orange/10 text-orange' },
  approved: {
    label: 'Approved -- live in search results',
    className: 'border-[#5aa9e6]/40 bg-[#5aa9e6]/10 text-[#5aa9e6]',
  },
  removed: { label: 'Removed', className: 'border-red/40 bg-red/10 text-red' },
};

// Public, no account needed -- the counterpart to the tracking code shown
// after filing a report anonymously (see app/report/ReportForm.tsx). A
// signed-in filer has the fuller "My reports" list instead, at
// /dashboard/my-reports.
export default function ReportStatusPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ status: string; createdAt: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`/api/report/status?code=${encodeURIComponent(code.trim())}`);
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

  const statusInfo = result ? STATUS_LABELS[result.status] : null;

  return (
    <main className="min-h-screen px-4 py-14 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-3xl font-extrabold">Check Report Status</h1>
        <p className="mt-3 text-muted">
          Enter the tracking code you were given when you filed a report to
          see whether it's been reviewed yet.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex gap-2">
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. A1B2C3D4"
            className="flex-1 rounded-lg border border-border bg-card px-4 py-3 uppercase tracking-wide text-white outline-none focus:border-orange"
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
          <div className="mt-4 rounded-lg border border-red bg-red/10 p-4 text-left text-sm">
            {error}
          </div>
        )}

        {result && statusInfo && (
          <div className="mt-4 rounded-xl border border-border bg-card p-6 text-left">
            <span
              className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold ${statusInfo.className}`}
            >
              {statusInfo.label}
            </span>
            <p className="mt-3 text-sm text-muted">
              Filed on {new Date(result.createdAt).toLocaleDateString()}.
            </p>
            {result.status === 'pending' && (
              <p className="mt-2 text-xs text-muted">
                Reports are reviewed by hand and usually don't take long.
                Check back later if you don't see a change.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
