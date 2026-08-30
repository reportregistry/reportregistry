import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { normalizePhone } from '@/lib/phone';
import { SCAM_TYPES } from '@/lib/scamTypes';

async function requireAdmin(): Promise<string | null> {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  return isAdminEmail(email) ? email! : null;
}

function resolveIdentifier(rawPhone: string | null, rawEmail: string | null) {
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  const email = rawEmail ? rawEmail.trim().toLowerCase() : null;
  if (phone) return { queryType: 'phone' as const, queryValue: phone };
  if (email) return { queryType: 'email' as const, queryValue: email };
  return null;
}

// Looks up a phone/email's REAL, computed-from-reports category counts
// (the same search_category_counts() the subscriber search API uses),
// plus any existing manual override row for it. The two are shown
// separately in the admin UI so it's always clear what's a real filed
// report vs. what an admin added by hand.
export async function GET(req: NextRequest) {
  const email = await requireAdmin();
  if (!email) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const identifier = resolveIdentifier(
    req.nextUrl.searchParams.get('phone'),
    req.nextUrl.searchParams.get('email')
  );
  if (!identifier) {
    return NextResponse.json({ error: 'Provide a phone number or email.' }, { status: 400 });
  }
  const { queryType, queryValue } = identifier;

  const supabase = getServiceClient();

  const { data: rows, error: countError } = await supabase.rpc('search_category_counts', {
    p_phone: queryType === 'phone' ? queryValue : null,
    p_email: queryType === 'email' ? queryValue : null,
  });
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const computedCounts: Record<string, number> = {};
  for (const row of rows || []) computedCounts[row.category] = Number(row.report_count);

  const { data: overrideRow, error: overrideError } = await supabase
    .from('profile_overrides')
    .select('category_counts, notes, updated_by, updated_at')
    .eq('query_type', queryType)
    .eq('query_value', queryValue)
    .maybeSingle();

  if (overrideError) {
    return NextResponse.json({ error: overrideError.message }, { status: 500 });
  }

  return NextResponse.json({
    queryType,
    queryValue,
    computedCounts,
    overrideCounts: overrideRow?.category_counts || {},
    notes: overrideRow?.notes || '',
    updatedBy: overrideRow?.updated_by || null,
    updatedAt: overrideRow?.updated_at || null,
  });
}

// Sets (or clears) the manual override row for a phone/email. Overrides
// ADD to the real report-derived counts at search time -- see
// search_category_counts usage in /api/search -- they never replace or
// hide real reports. Submitting all-zero counts and a blank note deletes
// the override row entirely rather than storing an empty one.
export async function POST(req: NextRequest) {
  const email = await requireAdmin();
  if (!email) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  let body: {
    phone?: string;
    email?: string;
    categoryCounts?: Record<string, number>;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const identifier = resolveIdentifier(body.phone || null, body.email || null);
  if (!identifier) {
    return NextResponse.json({ error: 'Provide a phone number or email.' }, { status: 400 });
  }
  const { queryType, queryValue } = identifier;

  const incoming = body.categoryCounts || {};
  const categoryCounts: Record<string, number> = {};
  for (const category of SCAM_TYPES) {
    const n = Number(incoming[category]);
    if (Number.isFinite(n) && n > 0) categoryCounts[category] = Math.floor(n);
  }

  const notes = (body.notes || '').trim().slice(0, 500);
  const supabase = getServiceClient();
  const hasCounts = Object.keys(categoryCounts).length > 0;

  if (!hasCounts && !notes) {
    const { error } = await supabase
      .from('profile_overrides')
      .delete()
      .eq('query_type', queryType)
      .eq('query_value', queryValue);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, cleared: true });
  }

  const { error } = await supabase.from('profile_overrides').upsert(
    {
      query_type: queryType,
      query_value: queryValue,
      category_counts: categoryCounts,
      notes: notes || null,
      updated_by: email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'query_type,query_value' }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
