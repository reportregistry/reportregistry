export type RedAlert = {
  id: string;
  phone_numbers: string[] | null;
  subject_emails: string[] | null;
  subject_first_name: string | null;
  scam_type: string[] | null;
  alert_message: string | null;
  alert_sent_at: string;
};

const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// "Latest Red Alerts" panel shown above the dashboard tabs for every
// active subscriber. Shows exactly what the Red Alert email already sends
// (contact, first name, categories, and the admin-written message), never
// the reporter's description. Fed by getRedAlerts() in page.tsx, which
// only returns APPROVED reports that have had an alert sent -- so if a
// report is reset to pending, removed, or deleted, its alert disappears
// from every subscriber's panel on their next page load automatically.
export default function RedAlerts({ alerts }: { alerts: RedAlert[] }) {
  if (alerts.length === 0) return null;

  const now = Date.now();
  const newCount = alerts.filter((a) => now - new Date(a.alert_sent_at).getTime() < NEW_WINDOW_MS).length;

  return (
    <section className="mx-auto mt-8 max-w-2xl rounded-xl border border-red/50 bg-red/5 p-5 text-left">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-red">⚠️ Latest Red Alerts</h2>
        {newCount > 0 && (
          <span className="rounded-full bg-red px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            {newCount} new this week
          </span>
        )}
      </div>
      <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
        {alerts.map((a) => {
          const contacts = [...(a.phone_numbers || []), ...(a.subject_emails || [])].join(', ');
          const isNew = now - new Date(a.alert_sent_at).getTime() < NEW_WINDOW_MS;
          return (
            <div
              key={a.id}
              className={`rounded-lg border p-3 ${isNew ? 'border-red/60 bg-navy' : 'border-border bg-card'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0 break-words text-sm font-semibold text-white">{contacts || '—'}</span>
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
    </section>
  );
}
