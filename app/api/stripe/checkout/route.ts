import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { getServiceClient } from '@/lib/supabase';

// Three things can be bought here:
//  - "monthly" / "annual": the recurring subscription that unlocks search
//  - "credits": a one-time $10 pack of 50 priority-search credits (spent
//    one at a time to request an admin deep-dive on a number/email that
//    came back with no report on file). Subscribers only -- checked below.
const PRICE_ENV: Record<string, string | undefined> = {
  monthly: process.env.STRIPE_PRICE_ID_MONTHLY,
  annual: process.env.STRIPE_PRICE_ID_ANNUAL,
  credits: process.env.STRIPE_PRICE_ID_CREDITS,
};

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  let body: { plan?: string; referral_code?: string } = {};
  try {
    body = await req.json();
  } catch {
    // No body at all defaults to "monthly" so the original single-button
    // Subscribe flow still works without changes.
  }
  const plan = body.plan === 'annual' || body.plan === 'credits' ? body.plan : 'monthly';

  const priceId = PRICE_ENV[plan];
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price for "${plan}" isn't configured yet.` },
      { status: 500 }
    );
  }

  // Referral-code gate: only applies to actually subscribing (monthly /
  // annual), not the one-time credits pack -- if you're already an active
  // subscriber buying more credits, you already passed this gate once.
  // This is an app-level access control, separate from Stripe's own
  // allow_promotion_codes below (that's a discount, this is a yes/no gate
  // that Stripe never sees). See referral_codes in supabase/schema.sql.
  const referralCode = (body.referral_code || '').trim().toUpperCase();
  if (plan !== 'credits') {
    if (!referralCode) {
      return NextResponse.json(
        { error: 'A referral code is required to subscribe.' },
        { status: 400 }
      );
    }
    const supabase = getServiceClient();
    const { data: code } = await supabase
      .from('referral_codes')
      .select('code, active, max_uses, uses_count')
      .eq('code', referralCode)
      .maybeSingle();

    if (!code || !code.active || (code.max_uses !== null && code.uses_count >= code.max_uses)) {
      return NextResponse.json(
        { error: "That referral code isn't valid or has already been fully used." },
        { status: 400 }
      );
    }
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: plan === 'credits' ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId,
      allow_promotion_codes: true,
      success_url: `${baseUrl}/dashboard?${plan === 'credits' ? 'credits=1' : 'subscribed=1'}`,
      cancel_url: `${baseUrl}/dashboard`,
      metadata: { clerk_user_id: userId, plan, referral_code: referralCode },
      ...(plan !== 'credits' && {
        subscription_data: { metadata: { clerk_user_id: userId, plan } },
      }),
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Could not start checkout.' },
      { status: 500 }
    );
  }
}
