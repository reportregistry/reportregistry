import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';

// Lets a subscriber wipe their own "Recent searches" list (see
// SearchBox.tsx). Only deletes search_history rows -- doesn't touch the
// underlying reports data, watches, or Enhanced Reports history, since
// those are separate lists with their own lifecycle. Scoped to the
// signed-in user's own clerk_user_id only; there's no "clear everyone's
// history" version of this.
export async function DELETE() {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { error } = await supabase.from('search_history').delete().eq('clerk_user_id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
