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
  reporter_public_note: string | null;
  public_note_approved: boolean;
  alert_message: string | null;
  alert_sent_at: string | null;
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

// Reports created via the "File a report (as admin)" tab get a
// reporter_name of "Admin" or "Admin (Name)" (see
// app/api/admin/report/create/route.ts) -- that's the marker used here to
// tell an admin-filed report apart from a normal one filed by a real
// reporter, so the "Unknown" phone/email display below only applies to the
// ones an admin actually filed, not to every report that happens to be
// missing one field.
function isAdminFiled(r: Report): boolean {
  return r.reporter_name === 'Admin' || (r.reporter_name?.startsWith('Admin (') ?? false);
}

// When a reporter picks the "Other" category, whatever they typed to
// explain it gets tucked into the private description as a
// "[Other: ...]" prefix (see app/api/report/route.ts) -- like the rest of
// description, it's admin-only by default. This just pulls that detail
// back out so it can be shown in its own labeled box with a one-click
// "use as public summary" button, rather than making the admin hunt for
// it inside the raw description text. It never gets shown to subscribers
// on its own; only the Public summary field (saved separately, below)
// does that.
function extractOtherDetail(description: string | null): string | null {
  const match = description?.match(/^\[Other: (.+?)\]/);
  return match ? match[1] : null;
}

function draftFromReport(r: Report): EditDraft {
  return {
    phone_numbers: (r.phone_numbers || []).join(', '),
    subject_emails: (r.subject_emails || []).join(', '),
    subject_first_name: r.subject_first_name || '',
    scam_type: r.scam_type || [],
    description: r.description || '',
  };
}

type AddDraft = {
  phone_numbers: string;
  subject_emails: string;
  subject_first_name: string;
  scam_type: string[];
  description: string;
  admin_summary: string;
  status: 'approved' | 'pending';
};

const EMPTY_ADD_DRAFT: AddDraft = {
  phone_numbers: '',
  subject_emails: '',
  subject_first_name: '',
  scam_type: [],
  description: '',
  admin_summary: '',
  status: 'approved',
};

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
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteError, setNoteError] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<AddDraft>(EMPTY_ADD_DRAFT);
  const [addBusy, setAddBusy] = useState(false);
  const [alertDrafts, setAlertDrafts] = useState<Record<string, string>>({});
  const [alertConfirmId, setAlertConfirmId] = useState<string | null>(null);
  const [alertBusy, setAlertBusy] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<Record<string, string>>({});
  const [alertSentCount, setAlertSentCount] = useState<Record<string, number>>({});
  const [addError, setAddError] = useState('');

  function toggleAddCategory(category: string) {
    setAddDraft((prev) => ({
      ...prev,
      scam_type: prev.scam_type.includes(category)
        ? prev.scam_type.filter((c) => c !== category)
        : [...prev.scam_type, category],
    }));
  }

  async function submitAddReport() {
    const phone_numbers = addDraft.phone_numbers
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const subject_emails = addDraft.subject_emails
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (phone_numbers.length === 0 && subject_emails.length === 0) {
      setAddError('At least one phone number or email is required.');
      return;
    }
    if (!addDraft.description.trim()) {
      setAddError('Description is required.');
      return;
    }

    setAddError('');
    setAddBusy(true);
    try {
      const res = await fetch('/api/admin/report/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_numbers,
          subject_emails,
          subject_first_name: addDraft.subject_first_name,
          scam_type: addDraft.scam_type,
          description: addDraft.description,
          admin_summary: addDraft.admin_summary,
          status: addDraft.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || 'Failed to add report.');
        return;
      }
      setReports((prev) => [data.report, ...prev]);
      setAddDraft(EMPTY_ADD_DRAFT);
      setShowAdd(false);
    } finally {
      setAddBusy(false);
    }
  }

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
    const draft =
      summaryDrafts[report.id] ??
      report.admin_summary ??
      extractOtherDetail(report.description) ??
      '';
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

  async function togglePublicNote(report: Report) {
    const next = !report.public_note_approved;
    setBusyId(report.id);
    try {
      const res = await fetch('/api/admin/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id, status: report.status, public_note_approved: next }),
      });
      if (res.ok) {
        setReports((prev) =>
          prev.map((r) => (r.id === report.id ? { ...r, public_note_approved: next } : r))
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  function startNoteEdit(r: Report) {
    setEditingNoteId(r.id);
    setNoteError((prev) => ({ ...prev, [r.id]: '' }));
    setNoteDrafts((prev) => ({ ...prev, [r.id]: prev[r.id] ?? (r.reporter_public_note || '') }));
  }

  function cancelNoteEdit(id: string) {
    setEditingNoteId(null);
    setNoteError((prev) => ({ ...prev, [id]: '' }));
    setNoteDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function saveNoteEdit(report: Report) {
    const draft = noteDrafts[report.id] ?? report.reporter_public_note ?? '';
    if (draft.length > 500) {
      setNoteError((prev) => ({ ...prev, [report.id]: 'Must be 500 characters or fewer.' }));
      return;
    }
    setNoteError((prev) => ({ ...prev, [report.id]: '' }));
    setBusyId(report.id);
    try {
      const res = await fetch('/api/admin/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: report.id,
          status: report.status,
          reporter_public_note: draft,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNoteError((prev) => ({ ...prev, [report.id]: data.error || 'Failed to save.' }));
        return;
      }
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, reporter_public_note: draft.trim() || null } : r))
      );
      setEditingNoteId(null);
      setNoteDrafts((prev) => {
        const next = { ...prev };
        delete next[report.id];
        return next;
      });
    } finally {
      setBusyId(null);
    }
  }

  async function sendRedAlert(report: Report) {
    const message = (alertDrafts[report.id] ?? report.alert_message ?? '').trim();
    if (!message) {
      setAlertError((prev) => ({ ...prev, [report.id]: 'Write a message before sending.' }));
      return;
    }
    setAlertError((prev) => ({ ...prev, [report.id]: '' }));
    setAlertBusy(report.id);
    try {
      const res = await fetch('/api/admin/report/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAlertError((prev) => ({ ...prev, [report.id]: data.error || 'Failed to send.' }));
        return;
      }
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? { ...r, alert_message: message, alert_sent_at: new Date().toISOString() }
            : r
        )
      );
      setAlertSentCount((prev) => ({ ...prev, [report.id]: data.sentCount }));
      setAlertConfirmId(null);
    } finally {
      setAlertBusy(null);
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
          placeholder="Search by phone, email, subject name, or reporter. This is the full audit trail, no cap"
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
        <button
          onClick={() => setShowAdd((v) => !v)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
            showAdd
              ? 'border-[#5aa9e6] bg-[#5aa9e6] text-navy'
              : 'border-[#5aa9e6]/40 bg-[#5aa9e6]/10 text-[#5aa9e6] hover:border-[#5aa9e6]'
          }`}
        >
          {showAdd ? 'Close' : 'File a report (as admin)'}
        </button>
      </div>

      {showAdd && (
        <div className="mb-6 space-y-3 rounded-xl border border-[#5aa9e6]/30 bg-card p-6">
          <p className="text-sm text-muted">
            Log a report yourself: an incident you know about firsthand, or
            one you're bringing in from elsewhere. It's saved as approved by
            default (you're the one reviewing it), so it counts in search
            results right away; switch it to pending if you'd rather queue
            it for a second look first. Leave phone or email blank if you
            don't have it; it'll just show as "Unknown" here in the admin
            list until you (or a future edit) fill it in.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block text-muted">Phone number(s), comma separated</span>
              <input
                type="text"
                value={addDraft.phone_numbers}
                onChange={(e) => setAddDraft((prev) => ({ ...prev, phone_numbers: e.target.value }))}
                className="w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted">Email(s), comma separated</span>
              <input
                type="text"
                value={addDraft.subject_emails}
                onChange={(e) => setAddDraft((prev) => ({ ...prev, subject_emails: e.target.value }))}
                className="w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange"
              />
            </label>
          </div>
          <label className="block text-xs">
            <span className="mb-1 block text-muted">Subject first name (optional)</span>
            <input
              type="text"
              value={addDraft.subject_first_name}
              onChange={(e) => setAddDraft((prev) => ({ ...prev, subject_first_name: e.target.value }))}
              className="w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange sm:w-64"
            />
          </label>
          <div>
            <span className="mb-1.5 block text-xs text-muted">Categories</span>
            <div className="flex flex-wrap gap-2">
              {SCAM_TYPES.map((category) => {
                const active = addDraft.scam_type.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleAddCategory(category)}
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
              value={addDraft.description}
              onChange={(e) => setAddDraft((prev) => ({ ...prev, description: e.target.value }))}
              rows={4}
              className="w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-muted">
              Public summary (shown to subscribers on search, optional, up to 500 characters)
            </span>
            <textarea
              value={addDraft.admin_summary}
              onChange={(e) => setAddDraft((prev) => ({ ...prev, admin_summary: e.target.value }))}
              maxLength={500}
              rows={2}
              className="w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange"
            />
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">Status:</span>
            <button
              type="button"
              onClick={() => setAddDraft((prev) => ({ ...prev, status: 'approved' }))}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                addDraft.status === 'approved'
                  ? 'border-[#5aa9e6]/40 bg-[#5aa9e6]/10 text-[#5aa9e6]'
                  : 'border-border text-muted'
              }`}
            >
              Approved
            </button>
            <button
              type="button"
              onClick={() => setAddDraft((prev) => ({ ...prev, status: 'pending' }))}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                addDraft.status === 'pending'
                  ? 'border-orange/40 bg-orange/10 text-orange'
                  : 'border-border text-muted'
              }`}
            >
              Pending
            </button>
          </div>
          {addError && <p className="text-xs text-red">{addError}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAdd(false);
                setAddDraft(EMPTY_ADD_DRAFT);
                setAddError('');
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted"
            >
              Cancel
            </button>
            <button
              disabled={addBusy}
              onClick={submitAddReport}
              className="rounded-lg bg-[#5aa9e6] px-3 py-1.5 text-xs font-semibold text-navy disabled:opacity-50"
            >
              Add report
            </button>
          </div>
        </div>
      )}

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
                    {r.phone_numbers?.length
                      ? r.phone_numbers.join(', ')
                      : isAdminFiled(r)
                        ? 'Unknown'
                        : '—'}
                  </p>
                  <p>
                    <span className="text-muted">Email(s): </span>
                    {r.subject_emails?.length
                      ? r.subject_emails.join(', ')
                      : isAdminFiled(r)
                        ? 'Unknown'
                        : '—'}
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
                    {/* Reporter identity (name/email/phone) is still stored
                        in the database exactly as before -- nothing here
                        gets deleted, so it's still there if a valid legal
                        request under the Terms ever needs it. It's just no
                        longer displayed in this list by default. */}
                    Unknown
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
                Public summary (shown to subscribers on search, optional, admin-written only)
              </label>
              {!r.admin_summary && extractOtherDetail(r.description) && summaryDrafts[r.id] === undefined && (
                <p className="mb-1.5 text-xs text-muted">
                  Reporter's "Other" detail, pre-filled below, still admin-only until you save it.
                </p>
              )}
              <textarea
                value={
                  summaryDrafts[r.id] ??
                  r.admin_summary ??
                  extractOtherDetail(r.description) ??
                  ''
                }
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
                  {
                    (
                      summaryDrafts[r.id] ??
                      r.admin_summary ??
                      extractOtherDetail(r.description) ??
                      ''
                    ).length
                  }
                  /500
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

            {r.reporter_public_note && (
              <div className="mt-3 rounded-lg border border-[#a78bfa]/30 bg-[#a78bfa]/5 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#a78bfa]">
                    Reporter's public note (their own words, not yours)
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                      r.public_note_approved
                        ? 'border-[#5aa9e6]/40 bg-[#5aa9e6]/10 text-[#5aa9e6]'
                        : 'border-border text-muted'
                    }`}
                  >
                    {r.public_note_approved ? 'Approved, visible on search' : 'Not approved'}
                  </span>
                </div>

                {editingNoteId === r.id ? (
                  <>
                    <textarea
                      value={noteDrafts[r.id] ?? r.reporter_public_note ?? ''}
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                      maxLength={500}
                      rows={3}
                      className="w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm text-white outline-none focus:border-[#a78bfa]"
                    />
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-muted">
                        {(noteDrafts[r.id] ?? r.reporter_public_note ?? '').length}/500
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => cancelNoteEdit(r.id)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={busyId === r.id}
                          onClick={() => saveNoteEdit(r)}
                          className="rounded-lg bg-[#a78bfa] px-3 py-1.5 text-xs font-semibold text-navy disabled:opacity-50"
                        >
                          Save note
                        </button>
                      </div>
                    </div>
                    {noteError[r.id] && <p className="mt-1 text-xs text-red">{noteError[r.id]}</p>}
                  </>
                ) : (
                  <p className="rounded-lg bg-navy p-2 text-sm text-white">{r.reporter_public_note}</p>
                )}

                <div className="mt-2 flex gap-2">
                  {editingNoteId !== r.id && (
                    <button
                      onClick={() => startNoteEdit(r)}
                      className="rounded-lg border border-[#a78bfa]/40 px-3 py-1.5 text-xs font-semibold text-[#a78bfa]"
                    >
                      Edit note
                    </button>
                  )}
                  <button
                    disabled={busyId === r.id}
                    onClick={() => togglePublicNote(r)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                      r.public_note_approved
                        ? 'border border-red text-red'
                        : 'bg-[#a78bfa] text-navy'
                    }`}
                  >
                    {r.public_note_approved ? 'Unapprove' : 'Approve to show publicly'}
                  </button>
                </div>
              </div>
            )}

            {r.status === 'approved' && (
              <div className="mt-3 rounded-lg border border-red/40 bg-red/5 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-red">
                    Red Alert: email every active subscriber about this report
                  </span>
                  {r.alert_sent_at && (
                    <span className="rounded-full border border-red/40 px-2 py-0.5 text-xs font-semibold text-red">
                      Sent {new Date(r.alert_sent_at).toLocaleString()}
                    </span>
                  )}
                </div>
                <textarea
                  value={alertDrafts[r.id] ?? r.alert_message ?? ''}
                  onChange={(e) =>
                    setAlertDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))
                  }
                  maxLength={1000}
                  rows={3}
                  placeholder="What should subscribers know, and why is it urgent? This is separate from the Public summary and goes out as an email to everyone with an active subscription."
                  className="w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-red"
                />
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-xs text-muted">
                    {(alertDrafts[r.id] ?? r.alert_message ?? '').length}/1000
                  </span>
                  {alertConfirmId === r.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">Email ALL active subscribers now?</span>
                      <button
                        onClick={() => setAlertConfirmId(null)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={alertBusy === r.id}
                        onClick={() => sendRedAlert(r)}
                        className="rounded-lg bg-red px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {alertBusy === r.id ? 'Sending...' : 'Confirm, send now'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAlertConfirmId(r.id)}
                      className="rounded-lg border border-red px-3 py-1.5 text-xs font-semibold text-red"
                    >
                      {r.alert_sent_at ? 'Send updated alert' : 'Send Red Alert'}
                    </button>
                  )}
                </div>
                {alertSentCount[r.id] !== undefined && (
                  <p className="mt-1 text-xs text-muted">
                    Last send reached {alertSentCount[r.id]} active subscriber
                    {alertSentCount[r.id] === 1 ? '' : 's'}.
                  </p>
                )}
                {alertError[r.id] && <p className="mt-1 text-xs text-red">{alertError[r.id]}</p>}
              </div>
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
