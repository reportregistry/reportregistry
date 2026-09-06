// Unused -- the referral-code-required-to-subscribe feature was scrapped
// per request. Nothing imports this route anymore (see app/admin/page.tsx
// and app/dashboard/SubscribeButton.tsx, both reverted). Left as a stub
// file rather than deleted since deleting files isn't available here;
// safe to delete manually later.
import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json({ error: 'Not available.' }, { status: 404 });
}
export async function PATCH() {
  return NextResponse.json({ error: 'Not available.' }, { status: 404 });
}
