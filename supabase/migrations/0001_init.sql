-- NAUKA — initial schema. Apply with `supabase db push` (or paste into the SQL editor).
create extension if not exists "pgcrypto";

-- ---------- enums ----------
do $$ begin
  create type public.stage as enum ('podstawowa','liceum','studia','inne');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.plan as enum ('free','pro');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.generation_status as enum ('queued','running','done','failed');
exception when duplicate_object then null; end $$;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  stage public.stage not null default 'liceum',
  plan public.plan not null default 'free',
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''),'@',1)))
  on conflict (id) do nothing;
  insert into public.user_meta (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- subjects (user's containers: Matematyka, Biologia…) ----------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text not null default '📘',
  category text not null default 'inne',
  stage public.stage not null default 'liceum',
  accent text not null default 'linear-gradient(135deg,#ff2d95,#a855f7,#22d3ee)',
  accent2 text not null default '#22d3ee',
  exam_date date,
  exam_label text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subjects_owner on public.subjects (owner_id, position);

-- ---------- topics (AI-generated learning units inside a subject) ----------
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text not null default '📘',
  source text not null default 'materials', -- materials | prompt
  content jsonb not null,
  generation_id uuid,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists topics_subject on public.topics (subject_id, position);
create index if not exists topics_owner on public.topics (owner_id);

-- ---------- materials (uploaded files) ----------
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  mime text not null,
  size_bytes bigint not null default 0,
  name text,
  created_at timestamptz not null default now()
);
create index if not exists materials_owner on public.materials (owner_id);

-- ---------- generations (AI jobs) ----------
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  status public.generation_status not null default 'queued',
  stage public.stage not null,
  hint text,
  options jsonb not null default '{}'::jsonb,
  material_ids uuid[] not null default '{}',
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  error text,
  model text,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists generations_owner on public.generations (owner_id, created_at desc);

-- ---------- progress ----------
create table if not exists public.progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  xp int not null default 0,
  levels jsonb not null default '{}'::jsonb,
  weak jsonb not null default '{}'::jsonb, -- levelId → wrong question indices
  best_exam int,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create table if not exists public.srs_cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  card_key text not null,
  state jsonb not null,
  due timestamptz not null default now(),
  primary key (user_id, topic_id, card_key)
);

-- daily activity log (for calendar / streak repair / stats)
create table if not exists public.activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  xp int not null default 0,
  minutes int not null default 0,
  primary key (user_id, day)
);
create index if not exists srs_due on public.srs_cards (user_id, due);

create table if not exists public.user_meta (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak int not null default 0,
  best int not null default 0,
  last_day date,
  total_xp int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- billing ----------
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_subscription_id text unique,
  status text,
  price_id text,
  interval text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null, -- YYYY-MM (UTC)
  generations int not null default 0,
  tutor_messages int not null default 0,
  primary key (user_id, month)
);

-- ---------- updated_at ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','subjects','topics','progress','user_meta','subscriptions'] loop
    execute format('drop trigger if exists touch_%I on public.%I', t, t);
    execute format('create trigger touch_%I before update on public.%I for each row execute procedure public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.activity enable row level security;
alter table public.materials enable row level security;
alter table public.generations enable row level security;
alter table public.progress enable row level security;
alter table public.srs_cards enable row level security;
alter table public.user_meta enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage enable row level security;

drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and plan = (select p.plan from public.profiles p where p.id = auth.uid()) and stripe_customer_id is not distinct from (select p.stripe_customer_id from public.profiles p where p.id = auth.uid()));

drop policy if exists "subjects own" on public.subjects;
create policy "subjects own" on public.subjects for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "topics own" on public.topics;
create policy "topics own" on public.topics for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "activity own" on public.activity;
create policy "activity own" on public.activity for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "materials own" on public.materials;
create policy "materials own" on public.materials for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "generations read own" on public.generations;
create policy "generations read own" on public.generations for select using (owner_id = auth.uid());

drop policy if exists "progress own" on public.progress;
create policy "progress own" on public.progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "srs own" on public.srs_cards;
create policy "srs own" on public.srs_cards for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "meta own" on public.user_meta;
create policy "meta own" on public.user_meta for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "subs read own" on public.subscriptions;
create policy "subs read own" on public.subscriptions for select using (user_id = auth.uid());
drop policy if exists "usage read own" on public.usage;
create policy "usage read own" on public.usage for select using (user_id = auth.uid());

-- ---------- storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 26214400, array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','text/markdown'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "materials storage own" on storage.objects;
create policy "materials storage own" on storage.objects for all
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- RPCs ----------
-- atomically count a generation; returns the new monthly total
create or replace function public.increment_usage(p_user uuid, p_month text, p_field text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_field = 'generations' then
    insert into public.usage (user_id, month, generations) values (p_user, p_month, 1)
      on conflict (user_id, month) do update set generations = usage.generations + 1
      returning generations into n;
  else
    insert into public.usage (user_id, month, tutor_messages) values (p_user, p_month, 1)
      on conflict (user_id, month) do update set tutor_messages = usage.tutor_messages + 1
      returning tutor_messages into n;
  end if;
  return n;
end $$;
revoke all on function public.increment_usage(uuid, text, text) from public, anon, authenticated;

-- total xp per user
create or replace function public.my_total_xp() returns int language sql security invoker as $$
  select coalesce(sum(xp),0)::int from public.progress where user_id = auth.uid();
$$;

-- log today's activity (xp + minutes) atomically
create or replace function public.log_activity(p_xp int, p_minutes int) returns void language sql security invoker as $$
  insert into public.activity (user_id, day, xp, minutes) values (auth.uid(), current_date, p_xp, p_minutes)
  on conflict (user_id, day) do update set xp = activity.xp + excluded.xp, minutes = activity.minutes + excluded.minutes;
$$;
