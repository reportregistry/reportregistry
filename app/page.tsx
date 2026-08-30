import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';

// Homepage is intentionally more than just a hero + CTA -- it needs to
// clearly explain what the product is, what it costs, and how it works
// for both visitors AND for payment processor review (Stripe's
// underwriting looks at the live site to confirm what's actually being
// sold before approving card payments; a bare hero with no pricing or
// description reads as suspicious/incomplete to that review).
export default function HomePage() {
  return (
    <main>
      <section className="px-4 py-16 text-center sm:px-6 sm:py-24">
        <h1 className="mx-auto max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Know who you&apos;re dealing with{' '}
          <span className="bg-gradient-to-br from-red to-orange bg-clip-text text-transparent">
            before
          </span>{' '}
          they get you.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-muted sm:text-lg">
          Search any phone number and get a clear scam verdict, subscribers
          only. Filing a report is always free and helps protect the next
          person.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <SignedOut>
            <Link
              href="/sign-up"
              className="w-full max-w-xs rounded-lg bg-gradient-to-br from-red to-orange px-6 py-3 font-semibold text-white sm:w-auto"
            >
              Subscribe to Search
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="w-full max-w-xs rounded-lg bg-gradient-to-br from-red to-orange px-6 py-3 font-semibold text-white sm:w-auto"
            >
              Search Now
            </Link>
          </SignedIn>
          <Link
            href="/report"
            className="w-full max-w-xs rounded-lg border border-border px-6 py-3 font-semibold text-white sm:w-auto"
          >
            File a Free Report
          </Link>
        </div>
      </section>

      {/* What it is */}
      <section className="border-t border-border bg-navy2 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-orange">
            What it is
          </p>
          <h2 className="mx-auto max-w-2xl text-center text-2xl font-extrabold sm:text-3xl">
            A registry built for one specific problem
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted">
            ReportRegistry is strictly for spam callers and people who scam,
            defraud, or fail to show up for a scheduled appointment or
            service. It is not a general dispute board, a background check
            tool, or a place to air personal grievances.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-2 font-bold">Search &amp; verify</h3>
              <p className="text-sm text-muted">
                Subscribers look up a phone number and see whether it's been
                flagged, broken down by category (scam, spam, missed
                appointment, threats). We only reveal those counts, never the underlying
                report text or who filed it, to protect everyone involved.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-2 font-bold">Report it, free</h3>
              <p className="text-sm text-muted">
                Anyone can file a report at no cost, with or without an
                account. Filing without an account just requires your own
                name and a phone number or email so the report is
                traceable, not anonymous.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-2 font-bold">Moderated &amp; deletable</h3>
              <p className="text-sm text-muted">
                Every report is reviewed by our staff before it affects
                search results. False or bad faith reports get removed, and
                anyone named in a report can request review or removal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-orange">
            Pricing
          </p>
          <h2 className="mx-auto max-w-2xl text-center text-2xl font-extrabold sm:text-3xl">
            Free to report, paid to search
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted">
            Filing a report never costs anything. Searching the registry
            requires an active subscription. All plans include unlimited
            yes/no searches.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Monthly</p>
              <p className="mt-2 text-3xl font-extrabold">
                $7.99<span className="text-base font-medium text-muted">/mo</span>
              </p>
              <p className="mt-3 text-sm text-muted">
                Unlimited yes/no searches, plus 20 priority search credits
                every month for numbers that come back with no report on
                file.
              </p>
            </div>
            <div className="rounded-xl border border-orange bg-orange/5 p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-orange">Annual</p>
              <p className="mt-2 text-3xl font-extrabold">
                $74.99<span className="text-base font-medium text-muted">/yr</span>
              </p>
              <p className="mt-3 text-sm text-muted">
                Same unlimited searches and 20 monthly priority search
                credits, billed once a year instead of monthly.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Priority searches
              </p>
              <p className="mt-2 text-3xl font-extrabold">
                $10<span className="text-base font-medium text-muted"> / 50 credits</span>
              </p>
              <p className="mt-3 text-sm text-muted">
                Optional top up for subscribers. Spend 1 credit to request a
                manual deep dive when a search comes back with nothing on
                file. Never expires.
              </p>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-muted">
            Subscriptions renew automatically and can be canceled anytime
            from your dashboard. Questions about a charge? Reach us at{' '}
            <a href="mailto:reportregistry@proton.me" className="text-orange hover:underline">
              reportregistry@proton.me
            </a>
            .
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-navy2 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-orange">
            How it works
          </p>
          <h2 className="text-center text-2xl font-extrabold sm:text-3xl">
            Simple, searchable, self cleaning
          </h2>
          <div className="mt-10 space-y-6">
            {[
              {
                n: '1',
                t: 'Search a phone number',
                d: 'Before you answer, call back, or wire money, check ReportRegistry to verify the number.',
              },
              {
                n: '2',
                t: 'Get a clear verdict',
                d: "We tell you if it's been flagged, and how many reports fall into each category. No exposed personal details, no public dossier.",
              },
              {
                n: '3',
                t: 'Report it, for free',
                d: "Got scammed, spammed, or stood up for an appointment? Filing a report costs nothing, ever.",
              },
              {
                n: '4',
                t: 'Request removal anytime',
                d: "Any report, yours or about you, can be flagged for review and fully deleted if it doesn't belong.",
              },
            ].map((step) => (
              <div key={step.n} className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-sm font-extrabold text-orange">
                  {step.n}
                </div>
                <div>
                  <h3 className="font-bold">{step.t}</h3>
                  <p className="mt-1 text-sm text-muted">{step.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our commitment */}
      <section className="border-t border-border px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-orange">
            Our commitment
          </p>
          <h2 className="text-center text-2xl font-extrabold sm:text-3xl">
            Built to be fair, not reckless
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-2 font-bold">No illegal content</h3>
              <p className="text-sm text-muted">
                No private legal identifiers, no illegal material of any
                kind. Reports stick to first names, numbers, emails, and the
                scam/spam behavior itself.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-2 font-bold">Fully deletable</h3>
              <p className="text-sm text-muted">
                Every report and every piece of evidence can be removed on
                request. Nothing is permanent by design.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-2 font-bold">Moderated by staff</h3>
              <p className="text-sm text-muted">
                A human reviews every report before it counts in search
                results. False reports are removed, and knowingly false
                reports may be referred to law enforcement.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-2 font-bold">Real support</h3>
              <p className="text-sm text-muted">
                Billing questions, removal requests, or anything else:{' '}
                <a href="mailto:reportregistry@proton.me" className="text-orange hover:underline">
                  reportregistry@proton.me
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
