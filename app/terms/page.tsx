// Public page -- not behind Clerk middleware. This is the URL you paste
// into Clerk Dashboard > Configure > Legal compliance as the "Terms of
// Service" link, so Clerk's own sign-up form shows a required "I agree to
// the Terms of Service" checkbox and blocks account creation until it's
// checked -- no custom code needed for the checkbox itself.
//
// IMPORTANT: this is a starting draft, not legal advice. Have an actual
// attorney review this before launch, especially the false-report and law
// enforcement sections -- publishing accusations about real people carries
// real defamation exposure, and the specifics should be checked against
// your state/country's law.
export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold">Terms &amp; Conditions</h1>
        <p className="mt-2 text-sm text-muted">Last updated: August 26, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted">
          <section>
            <h2 className="mb-2 text-base font-bold text-white">1. What ReportRegistry is for</h2>
            <p>
              ReportRegistry is a registry strictly for reporting spam callers and
              people who scam, defraud, or no-show on a scheduled appointment or
              service. It is not a general dispute board, review site, or outlet
              for personal grievances. Reports outside this scope may be removed
              without notice.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-white">2. Account required</h2>
            <p>
              You must create a free account to file a report or use the search
              tool. By creating an account, you agree to these Terms and confirm
              that any report you submit is truthful and made in good faith.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-white">3. Reports must be truthful</h2>
            <p>
              You may only submit a report about an incident you personally
              experienced. You agree not to submit a report that you know to be
              false, exaggerated, or misleading, and not to use the platform to
              harass, defame, or retaliate against another person.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-white">4. False reports and law enforcement</h2>
            <p>
              Knowingly submitting a false report is a violation of these Terms
              and may expose you to civil or criminal liability under applicable
              law. We reserve the right to remove any report we believe is false
              or made in bad faith, and to suspend or terminate the account that
              submitted it.
            </p>
            <p className="mt-2">
              If we receive a valid legal request from law enforcement, such as
              a subpoena, court order, or other lawful process, seeking
              information related to a report we have reason to believe is
              false, we will cooperate with that request. This may include
              surrendering the reporting account's identifying information (name,
              email, phone number, IP address, and submission details) to the
              requesting agency.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-white">5. What we publish</h2>
            <p>
              Reports are reviewed before they affect search results. Search
              results show whether a phone number or email has any approved
              reports on file and, if so, a count of how many reports fall
              into each category (for example, "Flake-No Show" or
              "Threats/Dangerous"). We never publish a reporter's identity,
              and the reporter's own written description is never shown
              publicly. For some approved reports, our staff may separately
              write a short (500 character or fewer) summary and choose to
              display it alongside the subject's first name; this is
              admin-authored and admin-approved, not the reporter's raw
              submission, and only happens when we've chosen to publish it.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-white">6. Removal requests</h2>
            <p>
              Anyone named in a report, or the person who filed it, may request
              review or removal at{' '}
              <a href="mailto:reportregistry@proton.me" className="text-orange">
                reportregistry@proton.me
              </a>
              . We may remove a report at our discretion, including if it's
              found to be false, unverifiable, outside the scope of this
              platform, or in violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-white">7. No warranty</h2>
            <p>
              ReportRegistry is provided "as is." A "no scam reports found"
              result is not a guarantee that a person or number is safe to deal
              with. It only reflects what has been reported to us. We make no
              warranty as to the accuracy or completeness of any report or
              search result.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-white">8. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, ReportRegistry and its
              operators are not liable for any damages arising from your use of
              the site, reliance on a search result, or the content of any
              report submitted by another user.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-white">9. Changes to these Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of
              ReportRegistry after a change means you accept the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold text-white">10. Contact</h2>
            <p>
              Questions about these Terms:{' '}
              <a href="mailto:reportregistry@proton.me" className="text-orange">
                reportregistry@proton.me
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
