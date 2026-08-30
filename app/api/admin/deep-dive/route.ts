import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin';

// Marks a deep-dive request completed, optionally with a note on what was
// found. Doesn't touch the reports table -- if the admin's manual digging
// turns up a real scam, file a normal report for it separately so it goes
// through the same moderation flow as everything else.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  let body: {
    id?: string;
    admin_notes?: string;
    category_counts?: Record<string, number>;
    summary?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: 'An id is required.' }, { status: 400 });
  }

  const trimmedSummary = body.summary?.trim();
  if (trimmedSummary && trimmedSummary.length > 500) {
    return NextResponse.json({ error: 'Summary must be 500 characters or fewer.' }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { error } = await supabase
    .from('deep_dive_requests')
    .update({
      status: 'completed',
      admin_notes: body.admin_notes || null,
      category_counts: body.category_counts || {},
      summary: trimmedSummary || null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
