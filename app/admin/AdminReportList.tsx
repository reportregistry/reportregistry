'use client';

import { useState } from 'react';

type Report = {
  id: string;
  phone_numbers: string[] | null;
  subject_emails: string[] | null;
  subject_first_name: string | null;
  scam_type: string[] | null;
  description: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  reporter_phone: string | null;
  evidence_urls: string[] | null;
  status: string;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'border-orange/40 bg-orange/10 text-orange',
  approved: 'border-[#5aa9e6]/40 bg-[#5aa9e6]/10 text-[#5aa9e6]',
  removed: 'border-red/40 bg-red/10 text-red',
};

const FILTERS = ['pending', 'approved', 'removed', 'all'] as const;

export default function AdminReportList({ initialReports }: { initialReports: Report[] }) {
  const [reports, setReports] = useState(initialReports);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function updateStatus(id: string, status: string) {
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      }
    } finally {
      setBusyId(null);
    }
  }

  const visible = filter === 'all' ? reports : reports.filter((r) => r.status === filter);

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
              filter === f
                ? 'border-white bg-white text-navy'
                : 'border-border text-muted hover:text-white'
            }`}
          >
            {f} ({f === 'all' ? reports.length : reports.filter((r) => r.status === f).length})
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-muted">Nothing in "{filter}" right now.</p>
      )}

      <div className="space-y-4">
        {visible.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span
                  className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[r.status] || ''}`}
                >
                  {r.status}
                </span>
                <span className="ml-2 text-xs text-muted">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex gap-2">
                {r.status !== 'approved' && (
                  <button
                    disabled={busyId === r.id}
                    onClick={() => updateStatus(r.id, 'approved')}
                    className="rounded-lg bg-[#5aa9e6] px-3 py-1.5 text-xs font-semibold text-navy disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                {r.status !== 'removed' && (
                  <button
                    disabled={busyId === r.id}
                    onClick={() => updateStatus(r.id, 'removed')}
                    className="rounded-lg border border-red px-3 py-1.5 text-xs font-semibold text-red disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
                {r.status !== 'pending' && (
                  <button
                    disabled={busyId === r.id}
                    onClick={() => updateStatus(r.id, 'pending')}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted disabled:opacity-50"
                  >
                    Reset to pending
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted">Phone(s): </span>
                {r.phone_numbers?.length ? r.phone_numbers.join(', ') : '—'}
              </p>
              <p>
                <span className="text-muted">Email(s): </span>
                {r.subject_emails?.length ? r.subject_emails.join(', ') : '—'}
              </p>
              <p>
                <span className="text-muted">First name: </span>
                {r.subject_first_name || '—'}
              </p>
              <p>
                <span className="text-muted">Type: </span>
                {r.scam_type?.length ? r.scam_type.join(', ') : '—'}
              </p>
              <p>
                <span className="text-muted">Reporter: </span>
                {[r.reporter_name, r.reporter_email || r.reporter_phone]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </p>
            </div>

            {r.description && (
              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-navy p-3 text-sm text-muted">
                {r.description}
              </p>
            )}

            {r.evidence_urls && r.evidence_urls.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.evidence_urls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-orange underline"
                  >
                    View evidence
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
