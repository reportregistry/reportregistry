import { Suspense } from 'react';
import Link from 'next/link';
import ReportForm from './ReportForm';

// Filing a report is free and doesn't require an account -- middleware.ts
// deliberately leaves /report and /api/report unprotected. Signed-in
// users get their reporter contact info from their Clerk session
// server-side; anonymous filers type it in manually on the form (see
// ReportForm.tsx's "Your info" section and app/api/report/route.ts).
//
// ReportForm is wrapped in Suspense because it reads the phone/email
// query params (via useSearchParams) to pre-fill the form when someone
// arrives here from a "report this number" link on a clean search
// result -- Next.js requires that wrapper for any client component using
// useSearchParams.
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
        <p className="mt-4 text-xs text-muted">
          Already filed a report?{' '}
          <Link href="/report/status" className="text-orange underline">
            Check its status
          </Link>
          .
        </p>
      </div>
      <div className="mt-10">
        <Suspense fallback={null}>
          <ReportForm />
        </Suspense>
      </div>
    </main>
  );
}
