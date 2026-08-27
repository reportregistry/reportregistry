import { createClient } from '@supabase/supabase-js';

// Server-only client using the service role key. Never import this into
// client components — it bypasses row-level security by design so our API
// routes are the only gatekeepers for reads/writes.
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Lets pages check before querying, so a Supabase-less local run (e.g.
// testing Clerk alone) shows a friendly "not set up yet" message instead
// of crashing the page.
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
