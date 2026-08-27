import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';

export default function HomePage() {
  return (
    <main className="min-h-screen">
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
    </main>
  );
}
