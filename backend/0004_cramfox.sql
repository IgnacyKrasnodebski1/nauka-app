-- Cramfox (klient iOS/vanilla) — migracja 0004 do projektu Supabase „nauka” (zhgxhdsnizujzygpcyfl).
-- Idempotentna: można wgrać ponownie. Wgranie: npx supabase db query --linked -f backend/0004_cramfox.sql (albo SQL Editor → Run).
-- Opiera się na 0001–0003 z gałęzi origin/claude/peaceful-hamilton-jy11e3 (profiles, subscriptions, usage, generations, touch_updated_at, typy plan/stage).

-- 1) Postępy Cramfoxa jako jeden blob na konto (PROGRESS + META silnika).
--    rev nadaje serwer przy każdym zapisie — klient zapisuje tylko wtedy, gdy zna aktualny rev (inaczej najpierw pobiera i scala).
create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  client_ts bigint,
  rev bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint app_state_size check (pg_column_size(progress) + pg_column_size(meta) < 2000000)
);
alter table public.app_state add column if not exists rev bigint not null default 1;
alter table public.app_state enable row level security;
drop policy if exists "app_state own" on public.app_state;
create policy "app_state own" on public.app_state for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create or replace function public.app_state_bump() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.rev := 1; else new.rev := old.rev + 1; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists touch_app_state on public.app_state;
drop trigger if exists bump_app_state on public.app_state;
create trigger bump_app_state before insert or update on public.app_state for each row execute procedure public.app_state_bump();

-- 2) Usunięcie konta z poziomu aplikacji (App Store 5.1.1(v)). Klient: najpierw p_dry_run => true (sprawdzenie, nic nie kasuje),
--    potem usuwa swoje pliki przez Storage API (bezpośredni DELETE ze storage.objects jest w Supabase zablokowany), na końcu p_dry_run => false.
--    Reszta danych znika kaskadą z auth.users. Aktywna subskrypcja z weba blokuje usunięcie (Stripe dalej by pobierał).
drop function if exists public.delete_my_account();
create or replace function public.delete_my_account(p_dry_run boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.subscriptions s where s.user_id = uid and s.status in ('active','trialing','past_due')) then
    raise exception 'active_subscription';
  end if;
  if p_dry_run then return; end if;
  if exists (select 1 from storage.objects o where o.bucket_id = 'materials' and (storage.foldername(o.name))[1] = uid::text) then
    raise exception 'files_remaining';
  end if;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_my_account(boolean) from public, anon;
grant execute on function public.delete_my_account(boolean) to authenticated;

-- 3) Miesiąc za darmo: konto założone w Cramfoxie (raw_user_meta_data.client = 'cramfox') dostaje plan Pro na 30 dni, potem free (3 generacje/mies.).
--    Konta z weba bez zmian. API na Vercelu czyta tylko profiles.plan, więc zmiana nie wymaga wdrożenia.
alter table public.profiles add column if not exists trial_until timestamptz;
-- użytkownik nie może sam zmienić planu, klienta Stripe ani końca okresu próbnego
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update using (auth.uid() = id)
  with check (auth.uid() = id
    and plan = (select p.plan from public.profiles p where p.id = auth.uid())
    and stripe_customer_id is not distinct from (select p.stripe_customer_id from public.profiles p where p.id = auth.uid())
    and trial_until is not distinct from (select p.trial_until from public.profiles p where p.id = auth.uid()));
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare cf boolean := coalesce(new.raw_user_meta_data->>'client', '') = 'cramfox';
begin
  insert into public.profiles (id, email, display_name, plan, trial_until)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''),'@',1)),
          case when cf then 'pro'::public.plan else 'free'::public.plan end,
          case when cf then now() + interval '30 days' end)
  on conflict (id) do nothing;
  insert into public.user_meta (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create or replace function public.end_trials() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.profiles p set plan = 'free'
   where p.plan = 'pro' and p.trial_until is not null and p.trial_until < now()
     and not exists (select 1 from public.subscriptions s where s.user_id = p.id and s.status in ('active','trialing','past_due'));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.end_trials() from public, anon, authenticated;
create extension if not exists pg_cron;
do $$ begin
  perform cron.unschedule('cramfox-end-trials') where exists (select 1 from cron.job where jobname = 'cramfox-end-trials');
  perform cron.schedule('cramfox-end-trials', '15 * * * *', 'select public.end_trials()');
end $$;

-- 4) Bezpieczniki kosztów (konta bez potwierdzania maila da się mnożyć).
--    Generacje: maks. 20 na konto na dobę i 300 globalnie na dobę. Po przekroczeniu zwracamy liczbę większą od każdego limitu →
--    API odpowiada 402 limit_reached z used = zwrócone - 1 (999999 = limit dzienny konta, 1999999 = limit serwera), licznik się nie zmienia.
--    Tutor: konto na okresie próbnym (plan pro bez subskrypcji) ma ten sam dzienny limit co free (30/dzień) — inaczej miałoby go bez limitu.
--    Stara apka web/mobile (Recall) nie zna tych progów: pokaże „Wykorzystano 999999/150” zamiast limitu dziennego, a tutor przy 'tutor_cap' dostanie 500.
--    Dotyczy tylko kont przy limicie dziennym/serwera albo kont z Cramfoxa używających tutora na webie — do poprawy w API, jeśli web zostaje.
create index if not exists generations_created_at on public.generations (created_at);
create or replace function public.increment_usage(p_user uuid, p_month text, p_field text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_field = 'generations' then
    if (select count(*) from public.generations g where g.owner_id = p_user and g.created_at > now() - interval '1 day') >= 20 then
      return 1000000;
    end if;
    if (select count(*) from public.generations g where g.created_at > now() - interval '1 day') >= 300 then
      return 2000000;
    end if;
    insert into public.usage (user_id, month, generations) values (p_user, p_month, 1)
      on conflict (user_id, month) do update set generations = usage.generations + 1
      returning generations into n;
  else
    if exists (select 1 from public.profiles p where p.id = p_user and p.trial_until is not null and p.trial_until > now()
               and not exists (select 1 from public.subscriptions s where s.user_id = p_user and s.status in ('active','trialing','past_due')))
       and coalesce((select u.tutor_messages from public.usage u where u.user_id = p_user and u.month = p_month), 0) >= 30 * extract(day from now())::int then
      raise exception 'tutor_cap';
    end if;
    insert into public.usage (user_id, month, tutor_messages) values (p_user, p_month, 1)
      on conflict (user_id, month) do update set tutor_messages = usage.tutor_messages + 1
      returning tutor_messages into n;
  end if;
  return n;
end $$;
revoke all on function public.increment_usage(uuid, text, text) from public, anon, authenticated;

-- 5) IDOR: API pobiera pliki z uprawnieniami serwisu, więc ścieżka musi być dokładnie „<owner_id>/<uuid>.<ext>” (bez „..”, „//”, „%”).
--    NOT VALID = stare wiersze z weba zostają, sprawdzane są tylko nowe.
alter table public.materials drop constraint if exists materials_path_owner;
alter table public.materials add constraint materials_path_owner
  check (storage_path ~* ('^' || owner_id::text || '/[0-9a-f-]{36}\.[a-z0-9]{1,10}$')) not valid;
