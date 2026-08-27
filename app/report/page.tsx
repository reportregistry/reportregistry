import ReportForm from './ReportForm';

// A free account is required to file a report (enforced by middleware.ts,
// which redirects signed-out visitors to /sign-in before this ever
// renders). Reporting itself stays free -- this just means no anonymous
// submissions. Because they're always signed in here, the reporter's
// contact info comes from their Clerk account server-side (see
// app/api/report/route.ts) rather than a manual form field.
export default function ReportPage() {
  return (
    <main className="min-h-screen px-4 py-14 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-3xl font-extrabold">File a Report</h1>
        <p className="mt-3 text-muted">
          Always free. Help warn the next person about a scam or spam
          number.
        </p>
        <div className="mt-6 rounded-lg border border-orange/40 bg-orange/10 p-4 text-left text-sm text-muted">
          <strong className="text-white">Scope:</strong> This registry is
          strictly for reporting spam callers and people who scam, defraud,
          or no-show on a scheduled appointment or service. It is not a
          general dispute or complaint board, and reports outside this
          scope will be removed.
        </div>
      </div>
      <div className="mt-10">
        <ReportForm />
      </div>
    </main>
  );
}
