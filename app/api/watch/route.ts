import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { normalizePhone } from '@/lib/phone';

// Watching a number/email is a search-adjacent feature -- gated the same
// way search itself is (active subscriber only), since it only makes
// sense as a follow-up to a search someone already ran.
async function requireActiveSubscriber(): Promise<string | NextResponse> {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const supabase = getServiceClient();
  const { data: subscriber } = await supabase
    .from('subscribers')
    .select('status')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  if (subscriber?.status !== 'active') {
    return NextResponse.json(
      { error: 'An active subscription is required.' },
      { status: 403 }
    );
  }
  return userId;
}

function resolveIdentifier(rawPhone: string | null, rawEmail: string | null) {
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  const email = rawEmail ? rawEmail.trim().toLowerCase() : null;
  if (phone) return { queryType: 'phone' as const, queryValue: phone };
  if (email) return { queryType: 'email' as const, queryValue: email };
  return null;
}

// Whether the current user is already watching this phone/email --
// SearchBox uses this to show "Watching" vs "Watch this number" on a
// result.
export async function GET(req: NextRequest) {
  const userIdOrResponse = await requireActiveSubscriber();
  if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
  const userId = userIdOrResponse;

  const identifier = resolveIdentifier(
    req.nextUrl.searchParams.get('phone'),
    req.nextUrl.searchParams.get('email')
  );
  if (!identifier) {
    return NextResponse.json({ error: 'Provide a phone number or email.' }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data } = await supabase
    .from('watches')
    .select('id')
    .eq('clerk_user_id', userId)
    .eq('query_type', identifier.queryType)
    .eq('query_value', identifier.queryValue)
    .maybeSingle();

  return NextResponse.json({ watching: Boolean(data) });
}

// Start watching a phone/email -- upsert-safe, so toggling it twice is
// harmless rather than erroring on the unique constraint.
export async function POST(req: NextRequest) {
  const userIdOrResponse = await requireActiveSubscriber();
  if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
  const userId = userIdOrResponse;

  let body: { phone?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const identifier = resolveIdentifier(body.phone || null, body.email || null);
  if (!identifier) {
    return NextResponse.json({ error: 'Provide a phone number or email.' }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { error } = await supabase.from('watches').upsert(
    {
      clerk_user_id: userId,
      query_type: identifier.queryType,
      query_value: identifier.queryValue,
    },
    { onConflict: 'clerk_user_id,query_type,query_value', ignoreDuplicates: true }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Stop watching a phone/email.
export async function DELETE(req: NextRequest) {
  const userIdOrResponse = await requireActiveSubscriber();
  if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
  const userId = userIdOrResponse;

  let body: { phone?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const identifier = resolveIdentifier(body.phone || null, body.email || null);
  if (!identifier) {
    return NextResponse.json({ error: 'Provide a phone number or email.' }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { error } = await supabase
    .from('watches')
    .delete()
    .eq('clerk_user_id', userId)
    .eq('query_type', identifier.queryType)
    .eq('query_value', identifier.queryValue);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
