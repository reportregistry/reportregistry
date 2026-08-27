import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-navy/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2 text-base font-extrabold sm:text-lg">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-orange" />
            ReportRegistry
          </div>
          <nav className="flex items-center gap-3 text-sm text-muted sm:gap-6">
            <Link href="/report" className="hidden hover:text-white sm:inline">
              Report Free
            </Link>
            <SignedOut>
              <Link href="/sign-in" className="hover:text-white">
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="whitespace-nowrap rounded-lg bg-gradient-to-br from-red to-orange px-3 py-1.5 text-xs font-semibold text-white sm:px-4 sm:py-2 sm:text-sm"
              >
                Subscribe
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="whitespace-nowrap rounded-lg bg-gradient-to-br from-red to-orange px-3 py-1.5 text-xs font-semibold text-white sm:px-4 sm:py-2 sm:text-sm"
              >
                Go to Search
              </Link>
            </SignedIn>
          </nav>
        </div>
      </header>

      <section className="px-4 py-16 text-center sm:px-6 sm:py-24">
        <h1 className="mx-auto max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Know who you&apos;re dealing with{' '}
          <span className="bg-gradient-to-br from-red to-orange bg-clip-text text-transparent">
            before
          </span>{' '}
          they get you.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-muted sm:text-lg">
          Search any phone number and get a clear scam verdict — subscribers
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
    </main>
  );
}
