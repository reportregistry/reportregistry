import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';
import { normalizePhone } from '@/lib/phone';

// Subscriber-only. Returns per-category report counts (via the
// search_category_counts SQL function) plus a derived isScam/totalReports
// summary -- but NEVER the underlying report text, reporter info, or
// evidence. Categories are the only detail search exposes; a report's
// free-text description and who filed it stay admin-only regardless of
// how many categories are shown here.
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

  // search_category_counts (supabase/schema.sql) unnests scam_type across
  // every approved report matching this phone/email and returns a count
  // per category -- a report with two categories counts once toward EACH
  // category, so summing categoryCounts is NOT the same as the number of
  // reports. totalReports below is the real, non-duplicated report count,
  // fetched separately (same array-contains match as before).
  const { data: rows, error: categoryError } = await supabase.rpc('search_category_counts', {
    p_phone: phone || null,
    p_email: email || null,
  });

  if (categoryError) {
    return NextResponse.json({ error: categoryError.message }, { status: 500 });
  }

  let countQuery = supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved');
  if (phone && email) {
    countQuery = countQuery.or(`phone_numbers.cs.{${phone}},subject_emails.cs.{${email}}`);
  } else if (phone) {
    countQuery = countQuery.contains('phone_numbers', [phone]);
  } else if (email) {
    countQuery = countQuery.contains('subject_emails', [email]);
  }

  const { count: totalReports, error: countError } = await countQuery;
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const categoryCounts: Record<string, number> = {};
  for (const row of rows || []) {
    categoryCounts[row.category] = Number(row.report_count);
  }

  // Manual admin overrides (set in /admin > Manual profile overrides) add
  // ON TOP of the real, filed-report counts above -- they never replace
  // or hide a real report. There's still no persistent "profile" row for
  // a phone/email; this is a per-identifier lookup against
  // profile_overrides, the one place outside the reports table that
  // contributes to what search shows.
  const { data: overrideRow } = await supabase
    .from('profile_overrides')
    .select('category_counts')
    .eq('query_type', phone ? 'phone' : 'email')
    .eq('query_value', phone || email)
    .maybeSingle();

  let overrideTotal = 0;
  if (overrideRow?.category_counts) {
    for (const [category, value] of Object.entries(
      overrideRow.category_counts as Record<string, number>
    )) {
      const n = Number(value) || 0;
      categoryCounts[category] = (categoryCounts[category] ?? 0) + n;
      overrideTotal += n;
    }
  }

  const combinedTotalReports = (totalReports ?? 0) + overrideTotal;

  // Public snippets: up to 5 most recent approved reports on this
  // phone/email with a short blurb to show. Two sources feed this, same
  // display slot either way: an admin_summary (staff-written, opt-in per
  // report) OR a reporter_public_note the reporter wrote themselves AND
  // an admin has specifically approved via public_note_approved (see
  // supabase/schema.sql) -- the reporter's raw description is never
  // eligible regardless. subject_first_name and scam_type are included
  // the same way they always were; reporter identity is never selected
  // here either way.
  let snippetQuery = supabase
    .from('reports')
    .select('subject_first_name, scam_type, admin_summary, reporter_public_note, public_note_approved, created_at')
    .eq('status', 'approved')
    .or('admin_summary.not.is.null,public_note_approved.eq.true')
    .order('created_at', { ascending: false })
    .limit(5);
  if (phone && email) {
    snippetQuery = snippetQuery.or(`phone_numbers.cs.{${phone}},subject_emails.cs.{${email}}`);
  } else if (phone) {
    snippetQuery = snippetQuery.contains('phone_numbers', [phone]);
  } else if (email) {
    snippetQuery = snippetQuery.contains('subject_emails', [email]);
  }

  const { data: snippetRows, error: snippetError } = await snippetQuery;
  if (snippetError) {
    return NextResponse.json({ error: snippetError.message }, { status: 500 });
  }

  const snippets = (snippetRows || []).map((r) => ({
    firstName: r.subject_first_name,
    categories: r.scam_type || [],
    // Prefer the staff-written summary if one exists; otherwise fall back
    // to the reporter's own approved note. Never both, and never the raw
    // (unapproved) reporter_public_note or description.
    summary: r.admin_summary || (r.public_note_approved ? r.reporter_public_note : null),
    reportedAt: r.created_at,
  }));

  // Log this search for the "Recent searches" list on the dashboard.
  // Best-effort -- a failure here shouldn't break the actual search
  // result the subscriber is waiting on.
  await supabase.from('search_history').insert({
    clerk_user_id: userId,
    query_type: phone ? 'phone' : 'email',
    query_value: phone || email,
    total_reports: combinedTotalReports,
    category_counts: categoryCounts,
  });

  return NextResponse.json({
    isScam: combinedTotalReports > 0,
    totalReports: combinedTotalReports,
    categoryCounts,
    snippets,
  });
}
