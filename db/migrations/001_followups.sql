-- Follow-ups: threading on messages, and outreach/follow-up template kinds.
-- Safe to run on a live database. Idempotent -- run it twice if you like.

begin;

-- ------------------------------------------------------------- messages
alter table messages add column if not exists thread_id      uuid;
alter table messages add column if not exists parent_id      uuid references messages(id) on delete set null;
alter table messages add column if not exists in_reply_to    text;
alter table messages add column if not exists rfc_references text;

-- Every existing message becomes the root of its own thread.
update messages set thread_id = id where thread_id is null;

-- A root message threads to itself; a reply carries its parent's thread.
-- Column defaults are applied before BEFORE-row triggers fire, so new.id
-- is already populated here.
create or replace function messages_set_thread_id() returns trigger as $$
begin
  if new.thread_id is null then
    new.thread_id := new.id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists messages_thread_id_trg on messages;
create trigger messages_thread_id_trg
  before insert on messages
  for each row execute function messages_set_thread_id();

create index if not exists messages_thread_idx on messages (thread_id, created_at);
create index if not exists messages_parent_idx on messages (parent_id);

-- ------------------------------------------------------------ templates
alter table templates add column if not exists kind text not null default 'outreach';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'templates_kind_check'
  ) then
    alter table templates add constraint templates_kind_check
      check (kind in ('outreach','followup'));
  end if;
end $$;

-- One default per kind, rather than one default overall.
drop index if exists templates_one_default;
create unique index if not exists templates_one_default_per_kind
  on templates (kind) where is_default;

insert into templates (name, subject_tpl, body_tpl, kind, is_default)
select
  'Default follow-up',
  '',   -- the reply endpoint fills this with "Re: <original subject>"
  E'Hi {{first_name}},\n\nQuick follow-up on my note below — I know inboxes get busy.\n\nStill happy to talk whenever suits you.\n\nBest,\n{{my_name}}',
  'followup',
  true
where not exists (select 1 from templates where kind = 'followup');

commit;
