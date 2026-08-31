import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';
import { normalizePhone } from '@/lib/phone';
import { SCAM_TYPES } from '@/lib/scamTypes';

// Applies the SAME manual category-count override to a whole list of
// phone numbers or emails at once -- e.g. a batch of numbers you already
// have documented incident counts for from another source, rather than
// looking each one up individually in the single-lookup tool above it.
// Still additive on top of real filed reports, same as the single
// version (see api/admin/profile-override/route.ts) -- this is a
// convenience for applying the same known counts to many identifiers in
// one submission, not a different mechanism.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  let body: {
    queryType?: string;
    values?: string[];
    categoryCounts?: Record<string, number>;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const queryType = body.queryType === 'email' ? 'email' : body.queryType === 'phone' ? 'phone' : null;
  if (!queryType) {
    return NextResponse.json({ error: 'queryType must be "phone" or "email".' }, { status: 400 });
  }
  if (!Array.isArray(body.values) || body.values.length === 0) {
    return NextResponse.json({ error: 'Provide at least one value.' }, { status: 400 });
  }
  if (body.values.length > 500) {
    return NextResponse.json({ error: 'Max 500 values per bulk submission.' }, { status: 400 });
  }

  const incoming = body.categoryCounts || {};
  const categoryCounts: Record<string, number> = {};
  for (const category of SCAM_TYPES) {
    const n = Number(incoming[category]);
    if (Number.isFinite(n) && n > 0) categoryCounts[category] = Math.floor(n);
  }
  if (Object.keys(categoryCounts).length === 0) {
    return NextResponse.json({ error: 'Provide at least one category count above 0.' }, { status: 400 });
  }

  const notes = (body.notes || '').trim().slice(0, 500) || null;

  const normalized = Array.from(
    new Set(
      body.values
        .map((v) =>
          queryType === 'phone' ? normalizePhone(v) : (v || '').trim().toLowerCase()
        )
        .filter((v): v is string => Boolean(v))
    )
  );

  if (normalized.length === 0) {
    return NextResponse.json({ error: "None of the values provided were usable." }, { status: 400 });
  }

  const rows = normalized.map((value) => ({
    query_type: queryType,
    query_value: value,
    category_counts: categoryCounts,
    notes,
    updated_by: email,
    updated_at: new Date().toISOString(),
  }));

  const supabase = getServiceClient();
  const { error } = await supabase
    .from('profile_overrides')
    .upsert(rows, { onConflict: 'query_type,query_value' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, applied: normalized.length, skipped: body.values.length - normalized.length });
}
