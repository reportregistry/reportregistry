import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

// Manual credit top-up from /admin. Gated by the admin-email allowlist,
// same as the report moderation route. Added credits go to the
// "purchased" pool (never wiped by the monthly free-credit reset), same
// bucket a $10 pack purchase would land in.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  let body: { clerk_user_id?: string; amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!body.clerk_user_id || !Number.isFinite(amount) || amount === 0) {
    return NextResponse.json(
      { error: 'A clerk_user_id and a non-zero amount are required.' },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();
  const { error } = await supabase.rpc('increment_purchased_credits', {
    p_clerk_user_id: body.clerk_user_id,
    p_amount: Math.round(amount),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
