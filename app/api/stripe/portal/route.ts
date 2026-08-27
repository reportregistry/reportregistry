import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { getServiceClient } from '@/lib/supabase';

// Lets a subscriber manage or cancel their subscription via Stripe's
// hosted billing portal.
export async function POST() {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { data: subscriber } = await supabase
    .from('subscribers')
    .select('stripe_customer_id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!subscriber?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription found.' }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const session = await stripe.billingPortal.sessions.create({
    customer: subscriber.stripe_customer_id,
    return_url: `${baseUrl}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}
