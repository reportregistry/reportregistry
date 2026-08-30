'use client';

import { useState } from 'react';
import { SCAM_TYPES } from '@/lib/scamTypes';

type Report = {
  id: string;
  phone_numbers: string[] | null;
  subject_emails: string[] | null;
  subject_first_name: string | null;
  scam_type: string[] | null;
  description: string | null;
  admin_summary: string | null;
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

type EditDraft = {
  phone_numbers: string;
  subject_emails: string;
  subject_first_name: string;
  scam_type: string[];
  description: string;
};

function draftFromReport(r: Report): EditDraft {
  return {
    phone_numbers: (r.phone_numbers || []).join(', '),
    subject_emails: (r.subject_emails || []).join(', '),
    subject_first_name: r.subject_first_name || '',
    scam_type: r.scam_type || [],
    description: r.description || '',
  };
}

export default function AdminReportList({ initialReports }: { initialReports: Report[] }) {
  const [reports, setReports] = useState(initialReports);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('pending');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [summaryDrafts, setSummaryDrafts] = useState<Record<string, string>>({});
  const [summaryError, setSummaryError] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});
  const [editError, setEditError] = useState<Record<string, string>>({});

  function startEdit(r: Report) {
    setEditingId(r.id);
    setEditError((prev) => ({ ...prev, [r.id]: '' }));
    setEditDrafts((prev) => ({ ...prev, [r.id]: prev[r.id] || draftFromReport(r) }));
  }

  function updateDraft(id: string, patch: Partial<EditDraft>) {
    setEditDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] as EditDraft), ...patch } }));
  }

  function toggleDraftCategory(id: string, category: string) {
    setEditDrafts((prev) => {
      const current = prev[id];
      const has = current.scam_type.includes(category);
      return {
        ...prev,
        [id]: {
          ...current,
          scam_type: has
            ? current.scam_type.filter((c) => c !== category)
            : [...current.scam_type, category],
        },
      };
    });
  }

  async function saveEdit(report: Report) {
    const draft = editDrafts[report.id];
    if (!draft) return;

    const phone_numbers = draft.phone_numbers
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const subject_emails = draft.subject_emails
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (phone_numbers.length === 0 && subject_emails.length === 0) {
      setEditError((prev) => ({ ...prev, [report.id]: 'At least one phone number or email is required.' }));
      return;
    }
    if (!draft.description.trim()) {
      setEditError((prev) => ({ ...prev, [report.id]: 'Description cannot be blank.' }));
      return;
    }

    setEditError((prev) => ({ ...prev, [report.id]: '' }));
    setBusyId(report.id);
    try {
      const res = await fetch('/api/admin/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: report.id,
          status: report.status,
          phone_numbers,
          subject_emails,
          subject_first_name: draft.subject_first_name,
          scam_type: draft.scam_type,
          description: draft.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError((prev) => ({ ...prev, [report.id]: data.error || 'Failed to save.' }));
        return;
      }
      // Server returns the normalized row -- sync local state to it
      // exactly rather than the raw (unnormalized) draft values.
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, ...data.report } : r)));
      setEditDrafts((prev) => {
        const next = { ...prev };
        delete next[report.id];
        return next;
      });
      setEditingId(null);
    } finally {
      setBusyId(null);
    }
  }

  function cancelEdit(id: string) {
    setEditingId(null);
    setEditError((prev) => ({ ...prev, [id]: '' }));
    setEditDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

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

  async function saveSummary(report: Report) {
    const draft = summaryDrafts[report.id] ?? report.admin_summary ?? '';
    if (draft.length > 500) {
      setSummaryError((prev) => ({ ...prev, [report.id]: 'Must be 500 characters or fewer.' }));
      return;
    }
    setSummaryError((prev) => ({ ...prev, [report.id]: '' }));
    setBusyId(report.id);
    try {
      const res = await fetch('/api/admin/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id, status: report.status, admin_summary: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSummaryError((prev) => ({ ...prev, [report.id]: data.error || 'Failed to save.' }));
        return;
      }
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, admin_summary: draft.trim() || null } : r))
      );
    } finally {
      setBusyId(null);
    }
  }

  const byStatus = filter === 'all' ? reports : reports.filter((r) => r.status === filter);
  const searchTerm = search.trim().toLowerCase();
  const visible = searchTerm
    ? byStatus.filter((r) => {
        const haystack = [
          ...(r.phone_numbers || []),
          ...(r.subject_emails || []),
          r.subject_first_name,
          r.reporter_name,
          r.reporter_email,
          r.reporter_phone,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(searchTerm);
      })
    : byStatus;

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by phone, email, subject name, or reporter -- this is the full audit trail, no cap"
          className="w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange"
        />
      </div>

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
        <p className="text-sm text-muted">
          {searchTerm ? `No matches for "${search}" in "${filter}".` : `Nothing in "${filter}" right now.`}
        </p>
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
                {editingId === r.id ? (
                  <button
                    onClick={() => cancelEdit(r.id)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted"
                  >
                    Cancel edit
                  </button>
                ) : (
                  <button
                    onClick={() => startEdit(r)}
                    className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-white/50"
                  >
                    Edit details
                  </button>
                )}
              </div>
            </div>

            {editingId === r.id ? (
              <div className="mt-4 space-y-3 rounded-lg border border-white/20 bg-navy p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs">
                    <span className="mb-1 block text-muted">Phone number(s), comma separated</span>
                    <input
                      type="text"
                      value={editDrafts[r.id]?.phone_numbers ?? ''}
                      onChange={(e) => updateDraft(r.id, { phone_numbers: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-orange"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block text-muted">Email(s), comma separated</span>
                    <input
                      type="text"
                      value={editDrafts[r.id]?.subject_emails ?? ''}
                      onChange={(e) => updateDraft(r.id, { subject_emails: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-orange"
                    />
                  </label>
                </div>
                <label className="block text-xs">
                  <span className="mb-1 block text-muted">Subject first name</span>
                  <input
                    type="text"
                    value={editDrafts[r.id]?.subject_first_name ?? ''}
                    onChange={(e) => updateDraft(r.id, { subject_first_name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-orange sm:w-64"
                  />
                </label>
                <div>
                  <span className="mb-1.5 block text-xs text-muted">Categories</span>
                  <div className="flex flex-wrap gap-2">
                    {SCAM_TYPES.map((category) => {
                      const active = editDrafts[r.id]?.scam_type.includes(category);
                      return (
                        <button
                          key={category}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleDraftCategory(r.id, category)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                            active
                              ? 'border-[#a78bfa] bg-[#a78bfa]/20 text-[#a78bfa]'
                              : 'border-border text-muted hover:text-white'
                          }`}
                        >
                          {category}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="block text-xs">
                  <span className="mb-1 block text-muted">Description (admin/moderation only, never shown to subscribers)</span>
                  <textarea
                    value={editDrafts[r.id]?.description ?? ''}
                    onChange={(e) => updateDraft(r.id, { description: e.target.value })}
                    rows={4}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-orange"
                  />
                </label>
                {editError[r.id] && <p className="text-xs text-red">{editError[r.id]}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => cancelEdit(r.id)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => saveEdit(r)}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-navy disabled:opacity-50"
                  >
                    Save details
                  </button>
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}

            <div className="mt-3 rounded-lg border border-orange/30 bg-orange/5 p-3">
              <label className="mb-1.5 block text-xs font-semibold text-orange">
                Public summary (shown to subscribers on search -- optional, admin-written only)
              </label>
              <textarea
                value={summaryDrafts[r.id] ?? r.admin_summary ?? ''}
                onChange={(e) =>
                  setSummaryDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))
                }
                maxLength={500}
                rows={3}
                placeholder="Leave blank to keep this report's details admin-only."
                className="w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-muted">
                  {(summaryDrafts[r.id] ?? r.admin_summary ?? '').length}/500
                </span>
                <button
                  disabled={busyId === r.id}
                  onClick={() => saveSummary(r)}
                  className="rounded-lg bg-orange px-3 py-1.5 text-xs font-semibold text-navy disabled:opacity-50"
                >
                  Save summary
                </button>
              </div>
              {summaryError[r.id] && (
                <p className="mt-1 text-xs text-red">{summaryError[r.id]}</p>
              )}
            </div>

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
