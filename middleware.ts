import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Routes that require a signed-in user. Filing a report ("/report",
// "/api/report") is deliberately NOT gated here -- anyone can file for
// free without an account, they just have to manually provide their own
// name + phone/email in the form instead of it coming from a Clerk
// session. Signed-in subscribers get that part auto-filled instead (see
// ReportForm.tsx / api/report/route.ts). The paywall (subscription
// status) is checked separately inside /dashboard and the search routes.
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/admin(.*)',
  '/api/search(.*)',
  '/api/admin(.*)',
  '/api/stripe/checkout(.*)',
  '/api/stripe/portal(.*)',
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    const { userId } = auth();
    if (!userId) {
      if (req.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }
  }
});

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
};
