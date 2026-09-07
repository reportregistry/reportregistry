import Link from 'next/link';
import { currentUser } from '@clerk/nextjs/server';

// One-time landing spot for brand-new accounts -- see the
// forceRedirectUrl on <SignUp /> in app/sign-up/[[...sign-up]]/page.tsx.
// Signing back in later goes straight to /dashboard as usual; this page
// only ever shows up right after account creation. No DB flag needed to
// track "has this user seen onboarding" -- Clerk itself only fires this
// redirect on genuine sign-up, never on sign-in, so a returning user can
// never land back here by accident.
export default async function WelcomePage() {
  const user = await currentUser();
  const firstName = user?.firstName;

  return (
    <main className="min-h-screen px-6 py-24 text-center">
      <span className="inline-block rounded-full border border-orange/40 bg-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange">
        Welcome
      </span>
      <h1 className="mx-auto mt-4 max-w-xl text-3xl font-extrabold sm:text-4xl">
        {firstName ? `You're in, ${firstName}.` : "You're in."}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-muted">
        Here's how ReportRegistry works, in three parts.
      </p>

      <div className="mx-auto mt-10 max-w-lg space-y-4 text-left">
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-orange">1. Reporting is always free</p>
          <p className="mt-2 text-sm text-muted">
            Anyone can file a report on a scammer, spam caller, or no-show
            -- no subscription required. Every report is reviewed before it
            shows up in search, and your own contact info is never shown to
            subscribers or the public.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-[#5aa9e6]">
            2. Searching a number needs a subscription
          </p>
          <p className="mt-2 text-sm text-muted">
            Checking a phone number, email, or social tag against the
            registry before you deal with someone is what subscribing
            unlocks -- plus the ability to watch a number for future
            reports and request a deeper look on one that matters.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-[#a78bfa]">
            3. My Reports keeps track of what you've filed
          </p>
          <p className="mt-2 text-sm text-muted">
            Every report you file while signed in shows up there with its
            status, and you'll see a badge in the nav the moment one gets
            reviewed.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/dashboard"
          className="w-full rounded-lg bg-gradient-to-br from-red to-orange px-6 py-3 text-center font-semibold text-white shadow-sm transition hover:opacity-90 sm:w-auto"
        >
          Go to Search
        </Link>
        <a
          href="/report"
          className="w-full rounded-lg border border-white/20 px-6 py-3 text-center font-semibold text-white/80 transition hover:border-white/40 hover:text-white sm:w-auto"
        >
          File a report
        </a>
      </div>
    </main>
  );
}
