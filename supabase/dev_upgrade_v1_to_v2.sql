-- ONE-OFF for the dev project created before the subjects→topics restructure. Fresh projects: run migrations/0001_init.sql only.
-- one-off in-place upgrade of the dev project from schema v1 (subject=content) to v2 (subjects→topics)
delete from public.subjects where owner_id is null; -- 7 legacy seed subjects
drop policy if exists "subjects read" on public.subjects; drop policy if exists "subjects insert" on public.subjects;
drop policy if exists "subjects update" on public.subjects; drop policy if exists "subjects delete" on public.subjects;
drop table if exists public.library;
alter table public.subjects
  drop column if exists slug, drop column if exists is_public, drop column if exists content, drop column if exists generation_id,
  add column if not exists emoji text not null default '📘',
  add column if not exists accent text not null default 'linear-gradient(135deg,#ff2d95,#a855f7,#22d3ee)',
  add column if not exists accent2 text not null default '#22d3ee',
  add column if not exists exam_date date, add column if not exists exam_label text,
  add column if not exists position int not null default 0;
alter table public.subjects alter column category set default 'inne', alter column category set not null, alter column stage set default 'liceum', alter column owner_id set not null;
drop index if exists public.subjects_public_slug; drop index if exists public.subjects_public;
create index if not exists subjects_owner_pos on public.subjects (owner_id, position);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null, emoji text not null default '📘', source text not null default 'materials',
  content jsonb not null, generation_id uuid, position int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists topics_subject on public.topics (subject_id, position);
create index if not exists topics_owner on public.topics (owner_id);

alter table public.generations add column if not exists topic_id uuid references public.topics(id) on delete set null;

alter table public.progress drop constraint if exists progress_subject_id_fkey;
alter table public.progress rename column subject_id to topic_id;
alter table public.progress add constraint progress_topic_id_fkey foreign key (topic_id) references public.topics(id) on delete cascade;
alter table public.progress add column if not exists weak jsonb not null default '{}'::jsonb;

alter table public.srs_cards drop constraint if exists srs_cards_subject_id_fkey;
alter table public.srs_cards rename column subject_id to topic_id;
alter table public.srs_cards add constraint srs_cards_topic_id_fkey foreign key (topic_id) references public.topics(id) on delete cascade;

create table if not exists public.activity (
  user_id uuid not null references auth.users(id) on delete cascade, day date not null,
  xp int not null default 0, minutes int not null default 0, primary key (user_id, day));

alter table public.topics enable row level security; alter table public.activity enable row level security;
drop policy if exists "subjects read" on public.subjects; drop policy if exists "subjects insert" on public.subjects;
drop policy if exists "subjects update" on public.subjects; drop policy if exists "subjects delete" on public.subjects;
drop policy if exists "subjects own" on public.subjects;
create policy "subjects own" on public.subjects for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "topics own" on public.topics;
create policy "topics own" on public.topics for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "activity own" on public.activity;
create policy "activity own" on public.activity for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop trigger if exists touch_topics on public.topics;
create trigger touch_topics before update on public.topics for each row execute procedure public.touch_updated_at();

create or replace function public.log_activity(p_xp int, p_minutes int) returns void language sql security invoker as $$
  insert into public.activity (user_id, day, xp, minutes) values (auth.uid(), current_date, p_xp, p_minutes)
  on conflict (user_id, day) do update set xp = activity.xp + excluded.xp, minutes = activity.minutes + excluded.minutes;
$$;
