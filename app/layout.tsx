import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/next';
import SiteHeader from './components/SiteHeader';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReportRegistry.com: Report Scammers, Spam & Fraud',
  description:
    'A searchable registry for scam and spam phone numbers. Search requires a subscription, reporting is always free.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <SiteHeader />
          {children}
          <Analytics />
          <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted">
            <p className="mb-3">
              Questions or a removal request?{' '}
              <a
                href="mailto:reportregistry@proton.me"
                className="text-orange hover:underline"
              >
                reportregistry@proton.me
              </a>
            </p>
            <a href="/terms" className="hover:text-white">
              Terms &amp; Conditions
            </a>
            <span className="mx-3">·</span>
            <a href="/privacy" className="hover:text-white">
              Privacy Policy
            </a>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
