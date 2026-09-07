import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy">
      {/* forceRedirectUrl (not the NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL env
          var) sends every brand-new account to the one-time /welcome
          walkthrough instead of straight to /dashboard, regardless of
          what that env var is set to. Signing BACK in later goes through
          /sign-in instead, which still lands on /dashboard as normal --
          this only fires once, right after account creation. */}
      <SignUp forceRedirectUrl="/welcome" />
    </div>
  );
}
