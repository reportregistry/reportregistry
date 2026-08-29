import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { normalizePhone } from '@/lib/phone';

// Spends 1 priority-search credit to ask an admin to manually dig into a
// number/email that came back with no report on file. Doesn't do anything
// automated -- it just queues a request that shows up in /admin.
export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  let body: { phone?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const phone = normalizePhone(body.phone || null);
  const email = body.email?.trim().toLowerCase();
  if (!phone && !email) {
    return NextResponse.json({ error: 'A phone number or email is required.' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: subscriber } = await supabase
    .from('subscribers')
    .select('status')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (subscriber?.status !== 'active') {
    return NextResponse.json({ error: 'An active subscription is required.' }, { status: 403 });
  }

  // Atomic spend -- see use_search_credit in supabase/schema.sql. Only
  // succeeds (returns true) if there was at least 1 credit to take.
  const { data: spent, error: spendError } = await supabase.rpc('use_search_credit', {
    p_clerk_user_id: userId,
  });

  if (spendError) {
    return NextResponse.json({ error: spendError.message }, { status: 500 });
  }
  if (!spent) {
    return NextResponse.json(
      { error: 'No priority search credits left. Buy a 50-pack to request a deep dive.' },
      { status: 402 }
    );
  }

  const { error: insertError } = await supabase.from('deep_dive_requests').insert({
    clerk_user_id: userId,
    query_type: phone ? 'phone' : 'email',
    query_value: phone || email,
    status: 'pending',
  });

  if (insertError) {
    // Credit was already spent -- refund it rather than silently eating it.
    // Refunds always go to the purchased pool (simpler than tracking which
    // of the two pools use_search_credit drew from, and it never expires
    // so the refund isn't at risk of being wiped by the monthly reset).
    await supabase.rpc('increment_purchased_credits', { p_clerk_user_id: userId, p_amount: 1 });
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
