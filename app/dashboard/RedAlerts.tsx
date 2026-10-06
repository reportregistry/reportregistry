'use client';

import { useState } from 'react';
import Link from 'next/link';

export type RedAlert = {
  id: string;
  phone_numbers: string[] | null;
  subject_emails: string[] | null;
  subject_first_name: string | null;
  scam_type: string[] | null;
  alert_message: string | null;
  alert_sent_at: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_MS = 30 * DAY_MS;
const NEW_WINDOW_MS = 7 * DAY_MS;

// Red Alerts panel shown above the dashboard tabs for every active
// subscriber, always visible (with an empty state) so subscribers know the
// feature exists. "Active" = alerts sent in the last 30 days, "Past" =
// older ones. Shows exactly what the Red Alert email sends (contact, first
// name, categories, admin-written message), never the reporter's
// description. Fed by getRedAlerts() in page.tsx, which only returns
// APPROVED reports with an alert sent, so a report that is reset to
// pending, removed, or deleted drops out of every panel automatically.
export default function RedAlerts({ alerts }: { alerts: RedAlert[] }) {
  const [tab, setTab] = useState<'active' | 'past'>('active');
  const now = Date.now();
  const age = (a: RedAlert) => now - new Date(a.alert_sent_at).getTime();
  const active = alerts.filter((a) => age(a) < ACTIVE_WINDOW_MS);
  const past = alerts.filter((a) => age(a) >= ACTIVE_WINDOW_MS);
  const newCount = alerts.filter((a) => age(a) < NEW_WINDOW_MS).length;
  const shown = tab === 'active' ? active : past;

  const tabClass = (t: 'active' | 'past') =>
    `rounded-full border px-3 py-1 text-xs font-semibold transition ${
      tab === t ? 'border-red bg-red text-white' : 'border-red/40 text-red hover:border-red'
    }`;

  return (
    <section className="mx-auto mt-8 max-w-2xl rounded-xl border border-red/50 bg-red/5 p-5 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-red">⚠️ Red Alerts</h2>
        {newCount > 0 && (
          <span className="rounded-full bg-red px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            {newCount} new this week
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={() => setTab('active')} className={tabClass('active')}>
          Active ({active.length})
        </button>
        <button onClick={() => setTab('past')} className={tabClass('past')}>
          Past ({past.length})
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          {tab === 'active'
            ? 'No active Red Alerts right now. When our team flags a serious, dangerous contact, it shows up here.'
            : 'No past Red Alerts yet. Alerts move here 30 days after they were sent.'}
        </p>
      ) : (
        <div className="mt-3 max-h-96 space-y-3 overflow-y-auto pr-1">
          {shown.map((a) => {
            const contacts = [...(a.phone_numbers || []), ...(a.subject_emails || [])].join(', ');
            const isNew = age(a) < NEW_WINDOW_MS;
            return (
              <div
                key={a.id}
                className={`rounded-lg border p-3 ${isNew ? 'border-red/60 bg-navy' : 'border-border bg-card'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0 break-words text-sm font-semibold text-white">
                    {contacts || '—'}
                    {isNew && (
                      <span className="ml-2 inline-block rounded-full bg-red px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        New
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {new Date(a.alert_sent_at).toLocaleDateString()}
                  </span>
                </div>
                {(a.subject_first_name || a.scam_type?.length) && (
                  <p className="mt-1 text-xs text-muted">
                    {a.subject_first_name ? `Name on file: ${a.subject_first_name}` : ''}
                    {a.subject_first_name && a.scam_type?.length ? ' · ' : ''}
                    {a.scam_type?.length ? a.scam_type.join(', ') : ''}
                  </p>
                )}
                {a.alert_message && <p className="mt-2 whitespace-pre-wrap text-sm">{a.alert_message}</p>}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 border-t border-red/20 pt-3 text-xs text-muted">
        Know someone dangerous?{' '}
        <Link href="/report?red_alert=1" className="font-semibold text-red underline">
          File a report and request a Red Alert
        </Link>
        . Our team reviews every request before anything is sent.
      </p>
    </section>
  );
}
