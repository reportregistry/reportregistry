import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { getServiceClient } from '@/lib/supabase';

// Stripe needs the raw body to verify the signature, so this route must
// not be parsed as JSON by Next.js. App Router route handlers already
// give us req.text() unparsed, which is what we need here.
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  const supabase = getServiceClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const clerkUserId = session.client_reference_id || session.metadata?.clerk_user_id;
      const plan = session.metadata?.plan;

      if (!clerkUserId) break;

      if (session.mode === 'payment' && plan === 'credits') {
        // One-time $10 pack -> +50 priority-search credits, added to the
        // "purchased" pool (never wiped by the monthly free-credit reset).
        // Uses the atomic SQL function (supabase/schema.sql) instead of a
        // plain update so this can't race with a simultaneous purchase.
        await supabase.rpc('increment_purchased_credits', {
          p_clerk_user_id: clerkUserId,
          p_amount: 50,
        });
        break;
      }

      // New/renewed subscription checkout. search_credits is the "free"
      // monthly pool -- set to 20 here (first subscribe) and reset back to
      // 20 every month by the /api/cron/reset-credits job, regardless of
      // what was left unused. purchased_credits (from the $10 pack or a
      // manual admin top-up) is untouched by that reset and only changes
      // via increment_purchased_credits.
      await supabase.from('subscribers').upsert(
        {
          clerk_user_id: clerkUserId,
          email: session.customer_details?.email || session.customer_email || null,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          status: 'active',
          plan: plan || null,
          search_credits: 20,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'clerk_user_id' }
      );
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const clerkUserId = subscription.metadata?.clerk_user_id;
      const status =
        event.type === 'customer.subscription.deleted'
          ? 'canceled'
          : subscription.status === 'active'
          ? 'active'
          : subscription.status === 'past_due'
          ? 'past_due'
          : 'inactive';

      if (clerkUserId) {
        await supabase
          .from('subscribers')
          .update({
            status,
            current_period_end: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('clerk_user_id', clerkUserId);
      } else {
        // Fallback: match by stripe subscription id if metadata is missing.
        await supabase
          .from('subscribers')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscription.id);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
