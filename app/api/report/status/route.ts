import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

// Public, no sign-in required (not in middleware.ts's protected list) --
// this is how an anonymous filer checks on their own report without an
// account, using the tracking_code they were shown on submission (see
// ReportForm.tsx). Returns only status + submission date, nothing else:
// no phone/email/description/reporter identity, so even if a code leaked
// somehow it wouldn't expose anything sensitive beyond "here's what
// happened to one report."
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: 'Provide a tracking code.' }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('reports')
    .select('status, created_at')
    .eq('tracking_code', code)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "No report found with that code. Double-check it and try again." },
      { status: 404 }
    );
  }

  return NextResponse.json({ status: data.status, createdAt: data.created_at });
}
