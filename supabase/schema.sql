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
-- free-text explanation when scam_type is 'Other') and is NEVER exposed
-- by the search API -- subscribers and the public only ever see a yes/no
-- verdict. It's for admin/moderation eyes only.
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  phone_numbers text[] default '{}',
  subject_emails text[] default '{}',
  subject_first_name text,
  scam_type text, -- Scammer/Spam Caller | Fake Email/Link | Flake-No Show | Threats/Dangerous | Fake Payment | Other
  description text not null,
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
-- Search access is gated on status = 'active'. search_credits is the
-- "priority search" balance -- spent one at a time to request an admin
-- deep-dive on a number/email that came back with no report on file (see
-- deep_dive_requests below). plan is informational only (monthly vs
-- annual) and doesn't gate anything by itself.
create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive', -- active | past_due | canceled | inactive
  plan text, -- monthly | annual
  search_credits integer not null default 0,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscribers_clerk on subscribers (clerk_user_id);

-- Deep-dive requests: a subscriber spends 1 priority-search credit to ask
-- an admin to manually dig into a phone number or email that came back
-- with no report on file. Reviewed and resolved by hand in /admin --
-- this is a request queue, not an automated process.
create table if not exists deep_dive_requests (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  query_type text not null, -- phone | email
  query_value text not null,
  status text not null default 'pending', -- pending | completed
  admin_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_deep_dive_status on deep_dive_requests (status);
create index if not exists idx_deep_dive_clerk on deep_dive_requests (clerk_user_id);

-- Locks tables down to service-role access only (the app never queries
-- these with the anon/public key, so this closes off the public
-- PostgREST API entirely -- no policies needed on top of this).
alter table reports enable row level security;
alter table subscribers enable row level security;
alter table deep_dive_requests enable row level security;

-- Atomic credit helpers, called via supabase.rpc(...) instead of a plain
-- update, so two near-simultaneous requests can't both succeed off the
-- same last credit (a plain "read balance, then update" from the API
-- layer would have that race).
create or replace function increment_search_credits(p_clerk_user_id text, p_amount integer)
returns void
language sql
as $$
  update subscribers
  set search_credits = search_credits + p_amount,
      updated_at = now()
  where clerk_user_id = p_clerk_user_id;
$$;

create or replace function use_search_credit(p_clerk_user_id text)
returns boolean
language plpgsql
as $$
declare
  remaining integer;
begin
  update subscribers
  set search_credits = search_credits - 1,
      updated_at = now()
  where clerk_user_id = p_clerk_user_id and search_credits > 0
  returning search_credits into remaining;

  return remaining is not null;
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
