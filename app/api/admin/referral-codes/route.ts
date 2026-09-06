import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

async function requireAdmin() {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  return isAdminEmail(email);
}

// Create a new referral/invite code (see supabase/schema.sql for how it
// gates checkout). Codes are typed by hand and stored uppercase so
// lookups in app/api/stripe/checkout/route.ts are case-insensitive
// without needing a citext column.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  let body: { code?: string; max_uses?: number | null; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const code = (body.code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code) {
    return NextResponse.json({ error: 'A code is required.' }, { status: 400 });
  }

  const maxUses =
    body.max_uses === null || body.max_uses === undefined || Number(body.max_uses) <= 0
      ? null
      : Math.floor(Number(body.max_uses));

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('referral_codes')
    .insert({ code, max_uses: maxUses, note: (body.note || '').trim() || null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, code: data });
}

// Toggle active/inactive -- inactive codes fail the checkout gate but
// stay in the table so the uses_count history isn't lost.
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  let body: { code?: string; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.code || typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'code and active are required.' }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { error } = await supabase
    .from('referral_codes')
    .update({ active: body.active })
    .eq('code', body.code);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
