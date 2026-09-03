'use client';

import { useState } from 'react';

type Result = { inserted: number; skipped: { line: number; reason: string }[] } | null;

const PLACEHOLDER = `Paste your list here, one entry per line, any format, e.g.:

+1 (555) 123-4567, John, asked for gift cards then vanished
scammer@fake.com, took a deposit and ghosted
555-987-6543`;

export default function BulkReportForm() {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!text.trim()) {
      setError('Paste at least one row first.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/report/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        if (data.skipped) setResult({ inserted: 0, skipped: data.skipped });
      } else {
        setResult(data);
        setText('');
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 text-left">
      <p className="mb-2 text-sm text-muted">
        Just paste your list, one entry per line, no set format. We'll
        pull out any phone numbers and emails automatically; whatever else
        is on the line becomes the report notes. Each line needs at least
        one phone number or email to be counted.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={10}
          className="w-full rounded-lg border border-border bg-navy px-4 py-3 font-mono text-xs outline-none focus:border-orange"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-gradient-to-br from-red to-orange px-6 py-3 font-semibold text-white disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit Reports'}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-red bg-red/10 p-3 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-orange bg-orange/10 p-4 text-sm">
          <p className="font-semibold">
            Submitted {result.inserted} report{result.inserted === 1 ? '' : 's'}.
          </p>
          {result.skipped.length > 0 && (
            <div className="mt-2 text-xs text-muted">
              <p>Skipped {result.skipped.length} row(s):</p>
              <ul className="mt-1 list-disc pl-4">
                {result.skipped.slice(0, 10).map((s) => (
                  <li key={s.line}>
                    Line {s.line}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
