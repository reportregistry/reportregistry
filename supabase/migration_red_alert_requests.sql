-- Red Alert requests: lets a reporter ask, when filing, for their report
-- to be sent out as a Red Alert. Admins review the request in /admin and
-- decide; nothing is sent automatically. Run once in Supabase:
-- Project > SQL Editor > New query > paste > Run. Safe to re-run.
alter table reports add column if not exists red_alert_requested boolean not null default false;
alter table reports add column if not exists red_alert_reason text check (char_length(red_alert_reason) <= 500);
