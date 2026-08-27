import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { normalizePhone } from '@/lib/phone';

// Subscriber-only. Deliberately returns ONLY { isScam: boolean } — never the
// underlying report text, reporter info, or evidence — per the product
// decision to keep search a yes/no verdict, not a public dossier.
export async function GET(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const phone = normalizePhone(req.nextUrl.searchParams.get('phone'));
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!phone && !email) {
    return NextResponse.json(
      { error: 'Provide a phone number or email to search.' },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  const { data: subscriber } = await supabase
    .from('subscribers')
    .select('status')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (subscriber?.status !== 'active') {
    return NextResponse.json(
      { error: 'An active subscription is required to search.' },
      { status: 403 }
    );
  }

  // phone_numbers / subject_emails are arrays (a scammer can have more
  // than one on file), so matching uses Postgres array "contains" (@>)
  // rather than equality.
  let query = supabase.from('reports').select('id').eq('status', 'approved');
  if (phone && email) {
    query = query.or(`phone_numbers.cs.{${phone}},subject_emails.cs.{${email}}`);
  } else if (phone) {
    query = query.contains('phone_numbers', [phone]);
  } else if (email) {
    query = query.contains('subject_emails', [email]);
  }

  const { data: reports, error } = await query.limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ isScam: (reports?.length ?? 0) > 0 });
}
