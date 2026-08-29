import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

// Runs on a schedule (see vercel.json -- 1st of every month) and resets
// every active subscriber's free monthly credit pool (search_credits)
// back to exactly 20, no rollover: whatever was unused is wiped.
// purchased_credits (from the $10 pack or a manual admin top-up) is a
// completely separate column and is never touched here.
//
// Protected by CRON_SECRET so this can't be triggered by a random
// request -- set CRON_SECRET in Vercel's env vars to any random string,
// Vercel automatically sends it as "Authorization: Bearer <value>" when
// it calls scheduled routes.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { error, count } = await supabase
    .from('subscribers')
    .update(
      { search_credits: 20, updated_at: new Date().toISOString() },
      { count: 'exact' }
    )
    .eq('status', 'active');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, resetCount: count ?? null });
}
