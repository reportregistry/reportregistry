import Link from 'next/link';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';

// Shared across every page via app/layout.tsx, so there's always a way
// back home and consistent branding/nav -- previously this only existed
// on the homepage itself, which meant /report, /sign-in, /sign-up, etc.
// had no header at all.
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-navy/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-base font-extrabold sm:text-lg">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-orange" />
          ReportRegistry
        </Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-3">
          <Link
            href="/report"
            className="hidden whitespace-nowrap px-2 py-1.5 text-muted transition hover:text-white sm:inline"
          >
            Report Free
          </Link>
          <SignedOut>
            <Link
              href="/sign-in"
              className="whitespace-nowrap rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/40 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="whitespace-nowrap rounded-lg bg-gradient-to-br from-red to-orange px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 sm:px-4 sm:py-2 sm:text-sm"
            >
              Subscribe
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard/my-reports"
              className="hidden whitespace-nowrap px-2 py-1.5 text-muted transition hover:text-white sm:inline"
            >
              My Reports
            </Link>
            <Link
              href="/dashboard"
              className="whitespace-nowrap rounded-lg bg-gradient-to-br from-red to-orange px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 sm:px-4 sm:py-2 sm:text-sm"
            >
              Go to Search
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </nav>
      </div>
    </header>
  );
}
