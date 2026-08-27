import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Routes that require a signed-in user. A free account is required for
// everything on the site, including filing a report -- it's still free
// (no payment), just not anonymous. The separate paywall (subscription
// status) is checked inside /dashboard and the search/bulk-report routes.
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/report(.*)',
  '/admin(.*)',
  '/api/search(.*)',
  '/api/report(.*)',
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
