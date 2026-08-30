// Public page -- this is the URL you paste into Clerk Dashboard > Configure
// > Legal compliance as the "Privacy Policy" link, alongside /terms.
//
// Draft only, not legal advice -- have an attorney review before launch.
export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated: August 26, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted">
          <section>
            <h2 className="mb-2 text-base font-bold text-white">1. What we collect</h2>
            <p>
              When you create an account, our authentication provider (Clerk)
              collects your email address and, optionally, a phone number. When
              you file a report, we store the phone number(s), email(s), and
              first name (no last name) of the person you're reporting, the
              report details, and any screenshot you upload as evidence. Your
              own contact info is attached to a report privately, for
              follow-up only.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-white">2. Who can see what</h2>
            <p>
              Paying subscribers who search a number or email see whether it
              has any approved reports on file and, if so, a count broken
              down by category (for example, how many "Threats/Dangerous"
              vs. "Flake-No Show" reports). They never see the reporter's
              identity or the reporter's own written description. For some
              approved reports, our staff may choose to publish a short,
              staff-written summary (500 characters or fewer) alongside the
              subject's first name; this only happens when an admin has
              specifically written and approved it. Full report details,
              including the reporter's identity and description, remain
              visible only to site administrators.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-white">3. Law enforcement requests</h2>
            <p>
              We may disclose account and submission information in response to
              a valid legal request from law enforcement (such as a subpoena or
              court order), including in cases where a report is suspected to
              be false. See our{' '}
              <a href="/terms" className="text-orange">
                Terms &amp; Conditions
              </a>{' '}
              for details.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-white">4. Payment information</h2>
            <p>
              Subscription payments are processed by Stripe. We do not store
              your card details on our servers.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-white">5. Data removal</h2>
            <p>
              You can request deletion of your account or a report at{' '}
              <a href="mailto:reportregistry@proton.me" className="text-orange">
                reportregistry@proton.me
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-white">6. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Continued use of
              ReportRegistry after a change means you accept the update.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
