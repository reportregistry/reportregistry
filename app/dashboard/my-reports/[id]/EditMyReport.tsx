'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SCAM_TYPES } from '@/lib/scamTypes';

type Editable = {
  id: string;
  status: string;
  phone_numbers: string[] | null;
  subject_emails: string[] | null;
  social_handles: string[] | null;
  subject_first_name: string | null;
  scam_type: string[] | null;
  description: string | null;
};

const splitList = (v: string) =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Reporter-side editing for a report they filed (see
// app/api/report/mine/route.ts). Any save sends the report back to
// 'pending' for a fresh admin review -- for an already-approved report
// that means it drops out of search until re-approved, which the confirm
// step spells out before saving.
export default function EditMyReport({ report }: { report: Editable }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phones, setPhones] = useState((report.phone_numbers || []).join(', '));
  const [emails, setEmails] = useState((report.subject_emails || []).join(', '));
  const [socials, setSocials] = useState((report.social_handles || []).join(', '));
  const [firstName, setFirstName] = useState(report.subject_first_name || '');
  const [types, setTypes] = useState<string[]>(report.scam_type || []);
  const [description, setDescription] = useState(report.description || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // The "Edit" link on each My Reports card lands here with #edit, which
  // opens the form straight away.
  useEffect(() => {
    if (window.location.hash === '#edit') setOpen(true);
  }, []);

  if (report.status === 'removed') return null;

  const isApproved = report.status === 'approved';

  function toggleType(t: string) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function save() {
    if (
      isApproved &&
      !window.confirm(
        'Saving changes sends this report back for review. It will be hidden from search until an admin approves it again. Continue?'
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/report/mine', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: report.id,
          phone_numbers: splitList(phones),
          subject_emails: splitList(emails),
          social_handles: splitList(socials),
          subject_first_name: firstName,
          scam_type: types,
          description,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save your changes.');
        return;
      }
      setOpen(false);
      setSaved('Changes saved. Your report is now pending review.');
      router.refresh();
    } catch {
      setError('Could not save your changes. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-5">
        {saved && <p className="mb-2 text-xs text-[#5aa9e6]">{saved}</p>}
        <button
          onClick={() => {
            setSaved(null);
            setOpen(true);
          }}
          className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-white/50"
        >
          Edit report
        </button>
      </div>
    );
  }

  const input =
    'w-full rounded-lg border border-border bg-navy px-3 py-2 text-sm outline-none focus:border-orange';

  return (
    <div className="mt-5 space-y-3 rounded-lg border border-white/20 bg-navy p-4">
      {isApproved && (
        <p className="rounded-lg border border-orange/40 bg-orange/10 p-2 text-xs text-orange">
          This report is approved. Saving changes sends it back for review, and it will be hidden
          from search until an admin approves it again.
        </p>
      )}
      <label className="block text-xs">
        <span className="mb-1 block text-muted">Phone number(s), comma separated</span>
        <input className={input} value={phones} onChange={(e) => setPhones(e.target.value)} />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">Email(s), comma separated</span>
        <input className={input} value={emails} onChange={(e) => setEmails(e.target.value)} />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">Social tag/username</span>
        <input className={input} value={socials} onChange={(e) => setSocials(e.target.value)} />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">Their first name (optional)</span>
        <input className={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </label>
      <div className="text-xs">
        <span className="mb-1 block text-muted">Category</span>
        <div className="flex flex-wrap gap-2">
          {SCAM_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                types.includes(t)
                  ? 'border-orange bg-orange/15 text-orange'
                  : 'border-border text-muted hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">What happened</span>
        <textarea
          className={`${input} min-h-[120px]`}
          value={description}
          maxLength={5000}
          onChange={(e) => setDescription(e.target.value)}
        />
        <span className="mt-1 block text-right text-muted">
          {Math.min(description.length, 500)}/500 publishable
        </span>
      </label>
      {error && <p className="text-xs text-red">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted"
        >
          Cancel
        </button>
        <button
          disabled={busy}
          onClick={save}
          className="rounded-lg bg-orange px-3 py-1.5 text-xs font-semibold text-navy disabled:opacity-50"
        >
          {busy ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
