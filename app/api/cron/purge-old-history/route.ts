// Disabled -- removed from vercel.json's cron schedule per request, so
// this route no longer runs automatically. Search history and completed
// deep-dive requests are kept indefinitely for now. Left as a stub file
// (rather than deleted) since deleting files isn't available here; safe
// to delete manually later, or repurpose if 90-day retention comes back.
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true, disabled: true });
}
