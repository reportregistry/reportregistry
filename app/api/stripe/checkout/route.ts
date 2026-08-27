import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';

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

  let body: { plan?: string } = {};
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

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: plan === 'credits' ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId,
      success_url: `${baseUrl}/dashboard?${plan === 'credits' ? 'credits=1' : 'subscribed=1'}`,
      cancel_url: `${baseUrl}/dashboard`,
      metadata: { clerk_user_id: userId, plan },
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
