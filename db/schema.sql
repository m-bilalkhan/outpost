-- Outpost schema. Paste into Supabase -> SQL Editor -> New query -> Run.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- contacts
create table if not exists contacts (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  first_name   text,
  last_name    text,
  company      text,
  role         text,
  notes        text,
  tags         text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- --------------------------------------------------------------- templates
create table if not exists templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  subject_tpl  text not null,
  body_tpl     text not null,
  default_vars jsonb not null default '{}'::jsonb,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- at most one default template
create unique index if not exists templates_one_default
  on templates ((true)) where is_default;

-- ---------------------------------------------------------------- messages
-- content only. scheduling lives in jobs.
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid references contacts(id) on delete set null,
  template_id     uuid references templates(id) on delete set null,
  to_email        text not null,
  to_name         text,
  subject         text not null default '',
  body_html       text not null default '',
  body_text       text not null default '',
  status          text not null default 'draft'
                  check (status in ('draft','scheduled','sent','failed','cancelled')),
  sent_at         timestamptz,
  smtp_message_id text,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists messages_status_idx on messages (status, created_at desc);

-- -------------------------------------------------------------------- jobs
-- THE table. every future module (reminders, posts, follow-ups) writes here.
create table if not exists jobs (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null,
  payload       jsonb not null default '{}'::jsonb,
  run_at        timestamptz not null,
  status        text not null default 'pending'
                check (status in ('pending','running','done','failed','cancelled')),
  attempts      int not null default 0,
  max_attempts  int not null default 3,
  locked_at     timestamptz,
  last_error    text,
  result        jsonb,
  dedupe_key    text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- the index the claim query rides on
create index if not exists jobs_due_idx on jobs (status, run_at)
  where status in ('pending','running');

-- ------------------------------------------------------------- job_events
-- append-only. the thing you read at 2am when something did not send.
create table if not exists job_events (
  id       bigserial primary key,
  job_id   uuid not null references jobs(id) on delete cascade,
  at       timestamptz not null default now(),
  level    text not null default 'info' check (level in ('info','warn','error')),
  message  text not null,
  meta     jsonb
);
create index if not exists job_events_job_idx on job_events (job_id, at desc);

-- -------------------------------------------------------------- seed data
insert into templates (name, subject_tpl, body_tpl, is_default)
select
  'Default outreach',
  'Quick question, {{first_name}}',
  E'Hi {{first_name}},\n\nI came across {{company}} and wanted to reach out.\n\n[ your pitch here ]\n\nBest,\n{{my_name}}',
  true
where not exists (select 1 from templates);
