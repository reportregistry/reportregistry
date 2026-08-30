-- Run this in Supabase: Project > SQL Editor > New query > Run
--
-- If you already ran an earlier version of this file, drop and recreate
-- instead of trying to patch it (no real data has been imported yet, so
-- this is safe):
--
--   drop table if exists reports;
--   -- then run the create table statement below.

-- Reports: free to submit. A phone number or email only counts as
-- "flagged" once a report on it has been reviewed and marked 'approved'
-- (see moderation note below). Either identifier can hold more than one
-- value (a scammer often uses more than one number or address), so both
-- are arrays. At least one entry across the two is required.
--
-- `description` is written by the reporter (what happened, plus the
-- free-text explanation when scam_type includes 'Other') and is NEVER
-- exposed by the search API -- it's for admin/moderation eyes only,
-- always. `admin_summary` is a DIFFERENT field: an optional, short
-- (<=500 char) blurb an admin writes themselves after reviewing a
-- report, which IS shown to subscribers on search (alongside
-- subject_first_name and scam_type) once the report is approved AND an
-- admin has filled this in -- it's opt-in per report, admin-authored,
-- and never just the reporter's raw text copied over.
--
-- scam_type is an array (not a single value) because a reporter can pick
-- more than one category on a single report -- e.g. someone who
-- no-showed AND was threatening gets both 'Flake-No Show' and
-- 'Threats/Dangerous' on the same row, rather than forcing two separate
-- submissions. search_category_counts() below unnests this array to
-- produce the per-category totals shown to subscribers.
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  phone_numbers text[] default '{}',
  subject_emails text[] default '{}',
  subject_first_name text,
  scam_type text[] default '{}', -- any of: Scammer/Spam Caller | Fake Email/Link | Flake-No Show | Threats/Dangerous | Fake Payment | Other
  description text not null,
  admin_summary text check (char_length(admin_summary) <= 500),
  reporter_name text,
  reporter_email text,
  reporter_phone text,
  evidence_urls text[] default '{}',
  status text not null default 'pending', -- pending | approved | removed
  created_at timestamptz not null default now(),
  constraint reports_has_identifier check (
    coalesce(array_length(phone_numbers, 1), 0) > 0
    or coalesce(array_length(subject_emails, 1), 0) > 0
  )
);

-- GIN indexes for fast "does this array contain X" lookups (used by the
-- search API's phone/email matching).
create index if not exists idx_reports_phone_numbers on reports using gin (phone_numbers);
create index if not exists idx_reports_subject_emails on reports using gin (subject_emails);
create index if not exists idx_reports_status on reports (status);

-- Subscribers: one row per Clerk user, kept in sync by the Stripe webhook.
-- Search access is gated on status = 'active'. Priority-search credits are
-- split into two pools so they can be reset independently:
--   - search_credits: the free monthly allowance. Set to 20 the moment
--     someone subscribes, then reset back to exactly 20 every month by
--     the /api/cron/reset-credits job -- NOT additive, whatever's unused
--     is wiped, no rollover.
--   - purchased_credits: from the $10/50-credit pack or a manual admin
--     top-up in /admin. Never touched by the monthly reset, only ever
--     increased via increment_purchased_credits and spent via
--     use_search_credit (which draws from search_credits first, then
--     this pool).
-- plan is informational only (monthly vs annual) and doesn't gate
-- anything by itself. email is captured from Stripe checkout purely so
-- the admin subscriber list has something human-readable to show.
create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  email text,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive', -- active | past_due | canceled | inactive
  plan text, -- monthly | annual
  search_credits integer not null default 0,
  purchased_credits integer not null default 0,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscribers_clerk on subscribers (clerk_user_id);

-- Deep-dive requests: a subscriber spends 1 priority-search credit to ask
-- an admin to manually dig into a phone number or email that came back
-- with no report on file. Reviewed and resolved by hand in /admin --
-- this is a request queue, not an automated process.
--
-- admin_notes is internal-only (staff eyes, never shown to the
-- subscriber). category_counts and summary are the subscriber-facing
-- "Enhanced Report" result: category_counts is a jsonb map like
-- {"Threats/Dangerous": 2} that the admin fills in by hand based on
-- their research, and summary is a short (<=500 char) write-up the
-- subscriber sees on their Enhanced Reports page once status flips to
-- 'completed'.
create table if not exists deep_dive_requests (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  query_type text not null, -- phone | email
  query_value text not null,
  status text not null default 'pending', -- pending | completed
  admin_notes text,
  category_counts jsonb not null default '{}'::jsonb,
  summary text check (char_length(summary) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_deep_dive_status on deep_dive_requests (status);
create index if not exists idx_deep_dive_clerk on deep_dive_requests (clerk_user_id);

-- Search history: last N searches per subscriber, shown on their
-- dashboard with a "search again" shortcut. Purely a convenience
-- feature -- doesn't gate anything and isn't visible to anyone but the
-- subscriber who ran the search.
create table if not exists search_history (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  query_type text not null, -- phone | email
  query_value text not null,
  total_reports integer not null default 0,
  searched_at timestamptz not null default now()
);

create index if not exists idx_search_history_clerk on search_history (clerk_user_id, searched_at desc);

-- Search's core aggregation: for a given phone and/or email, count how
-- many approved reports include each category. A report with two
-- categories (e.g. Flake-No Show + Threats/Dangerous) counts once toward
-- each, not once total. Reports with no category picked count under
-- 'Unspecified' rather than being dropped, so the counts always sum to
-- the total number of matching reports. Called via supabase.rpc(...)
-- from /api/search -- this is the ONLY thing search ever reveals about a
-- report; the description, evidence, and reporter identity never leave
-- this function.
create or replace function search_category_counts(p_phone text, p_email text)
returns table(category text, report_count bigint)
language sql
stable
as $$
  select
    coalesce(t, 'Unspecified') as category,
    count(*) as report_count
  from reports r
  left join lateral unnest(
    case when coalesce(array_length(r.scam_type, 1), 0) > 0
      then r.scam_type
      else array['Unspecified']
    end
  ) as t on true
  where r.status = 'approved'
    and (
      (p_phone is not null and r.phone_numbers @> array[p_phone])
      or (p_email is not null and r.subject_emails @> array[p_email])
    )
  group by coalesce(t, 'Unspecified')
  order by report_count desc;
$$;

-- Locks tables down to service-role access only (the app never queries
-- these with the anon/public key, so this closes off the public
-- PostgREST API entirely -- no policies needed on top of this).
alter table reports enable row level security;
alter table subscribers enable row level security;
alter table deep_dive_requests enable row level security;
alter table search_history enable row level security;

-- Atomic credit helpers, called via supabase.rpc(...) instead of a plain
-- update, so two near-simultaneous requests can't both succeed off the
-- same last credit (a plain "read balance, then update" from the API
-- layer would have that race).

-- Adds to the "purchased" pool (from the $10/50 pack or a manual admin
-- top-up in /admin) -- this pool is never touched by the monthly free
-- credit reset, unlike search_credits.
create or replace function increment_purchased_credits(p_clerk_user_id text, p_amount integer)
returns void
language sql
as $$
  update subscribers
  set purchased_credits = purchased_credits + p_amount,
      updated_at = now()
  where clerk_user_id = p_clerk_user_id;
$$;

-- Spends one credit, drawing from the free monthly pool (search_credits)
-- first since that one resets to 20 every month anyway (use it or lose
-- it), then falling back to purchased_credits (which never expires) if
-- the free pool is empty.
create or replace function use_search_credit(p_clerk_user_id text)
returns boolean
language plpgsql
as $$
declare
  free_remaining integer;
  purchased_remaining integer;
begin
  update subscribers
  set search_credits = search_credits - 1,
      updated_at = now()
  where clerk_user_id = p_clerk_user_id and search_credits > 0
  returning search_credits into free_remaining;

  if free_remaining is not null then
    return true;
  end if;

  update subscribers
  set purchased_credits = purchased_credits - 1,
      updated_at = now()
  where clerk_user_id = p_clerk_user_id and purchased_credits > 0
  returning purchased_credits into purchased_remaining;

  return purchased_remaining is not null;
end;
$$;

-- ---------------------------------------------------------------------
-- Manual step (not SQL): in Supabase > Storage, create a bucket named
-- "evidence" and make it public. That's where report screenshots/photos
-- get uploaded. Deleting a report (see moderation below) should also
-- delete its files from this bucket to keep the "fully deletable" promise.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Moderation & deletion:
-- Reports and deep-dive requests can be reviewed and actioned from the
-- app's own /admin page (gated by the ADMIN_EMAILS allowlist in
-- .env.local), or directly in Supabase > Table Editor if you'd rather
-- work there:
--   - reports.status: pending -> approved (counts in search) or removed.
--   - deep_dive_requests.status: pending -> completed once you've looked
--     into it (add findings to admin_notes, and file a new report the
--     normal way if it turns out to be a real scam).
-- ---------------------------------------------------------------------
