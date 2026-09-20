-- Recall — gamification v2: economy (gems, hearts), daily goal, quests, achievements, leaderboard, chests.
alter table public.user_meta
  add column if not exists gems int not null default 0 check (gems >= 0),
  add column if not exists hearts int not null default 5 check (hearts between 0 and 5),
  add column if not exists hearts_updated_at timestamptz not null default now(),
  add column if not exists daily_goal int not null default 50 check (daily_goal in (20, 50, 100)),
  add column if not exists streak_freezes int not null default 0 check (streak_freezes between 0 and 5),
  add column if not exists sound_on boolean not null default true,
  add column if not exists stats jsonb not null default '{}'::jsonb;

alter table public.profiles add column if not exists show_on_leaderboard boolean not null default true;
alter table public.progress add column if not exists chests int[] not null default '{}';

create table if not exists public.quests_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  quests jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create table if not exists public.achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.quests_daily enable row level security;
alter table public.achievements enable row level security;
drop policy if exists "quests own" on public.quests_daily;
create policy "quests own" on public.quests_daily for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "achievements own" on public.achievements;
create policy "achievements own" on public.achievements for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists activity_day on public.activity (day, user_id);

-- profiles: allow the user to toggle leaderboard visibility (plan / stripe id stay locked)
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and plan = (select p.plan from public.profiles p where p.id = auth.uid()) and stripe_customer_id is not distinct from (select p.stripe_customer_id from public.profiles p where p.id = auth.uid()));

-- log_activity now takes the client's local day (keeps the goal ring and the streak on the same calendar)
drop function if exists public.log_activity(int, int);
create or replace function public.log_activity(p_xp int, p_minutes int, p_day date default current_date) returns void
language sql security invoker as $$
  insert into public.activity (user_id, day, xp, minutes) values (auth.uid(), p_day, greatest(p_xp, 0), greatest(p_minutes, 0))
  on conflict (user_id, day) do update set xp = activity.xp + excluded.xp, minutes = activity.minutes + excluded.minutes;
$$;

-- weekly leaderboard: security definer, exposes display_name + xp only, never ids/emails
create or replace function public.weekly_leaderboard(p_limit int default 50)
returns table (rank int, display_name text, xp int, is_me boolean)
language sql security definer stable set search_path = public as $$
  with w as (
    select a.user_id, sum(a.xp)::int as xp
    from public.activity a
    join public.profiles p on p.id = a.user_id and p.show_on_leaderboard
    where a.day >= date_trunc('week', current_date)::date
    group by a.user_id
  )
  select (rank() over (order by w.xp desc))::int, coalesce(nullif(p.display_name, ''), 'Anonim'), w.xp, w.user_id = auth.uid()
  from w join public.profiles p on p.id = w.user_id
  order by w.xp desc, p.display_name
  limit least(greatest(p_limit, 1), 100);
$$;
revoke all on function public.weekly_leaderboard(int) from public, anon;
grant execute on function public.weekly_leaderboard(int) to authenticated;

create or replace function public.my_weekly_rank()
returns table (rank int, xp int, total int)
language sql security definer stable set search_path = public as $$
  with w as (
    select a.user_id, sum(a.xp)::int as xp
    from public.activity a
    join public.profiles p on p.id = a.user_id and p.show_on_leaderboard
    where a.day >= date_trunc('week', current_date)::date
    group by a.user_id
  ), r as (select user_id, xp, (rank() over (order by xp desc))::int as rank from w)
  select r.rank, r.xp, (select count(*)::int from w) from r where r.user_id = auth.uid();
$$;
revoke all on function public.my_weekly_rank() from public, anon;
grant execute on function public.my_weekly_rank() to authenticated;
