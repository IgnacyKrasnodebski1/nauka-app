-- Cramfox — migracja 0007: bezpieczniki kosztów generacji. AUDYT §6.1 A, pozycje P0-1, P0-2, P1-3, P1-4, decyzja D3.
--
-- KOLEJNOŚĆ WGRYWANIA (Build 7):
--   1. 0007 (ten plik)                — przed wdrożeniem backendu; build 6 i obecny backend działają dalej (zmiany niżej)
--   2. wdrożenie backendu z Build 7   — nowy /api/generate i /api/me WYMAGAJĄ tej migracji (reserve_generation,
--                                       generation_quota, finish_generation, kolumny)
--   3. 0008_account_limits.sql        — zaostrzenia; dopiero po wdrożeniu backendu i sprawdzeniu, że build 6 dalej działa
--   4. build 7 apki
-- Idempotentna: można wgrać ponownie (wartości w app_config, które właściciel zmienił, zostają). Opiera się na 0001
-- (generations, usage, topics, subjects, profiles, touch_updated_at) i 0004 (pg_cron, indeksy, trial_until, end_trials).
-- Wgranie: supabase db query --linked -f backend/0007_generation_guards.sql
-- Po ponownym wgraniu 0004 (np. po przypadkowym 0001) wgraj ponownie TEN plik: 0004 przywraca trial dla nowych kont
-- i globalny limit 300 w increment_usage.
--
-- Decyzja właściciela z 2026-10-15 (zastępuje trial z 0004 i miesięczne 3 generacje planu free):
--   - plan free = 2 generacje („tworzenia lekcji”) NA ZAWSZE, bez odnawiania; liczy się każde naliczenie (udane albo nie),
--     niezależnie od liczby plików; licznik jest przypisany do skrótu adresu e-mail i przeżywa usunięcie konta
--     (nowe konto z tym samym adresem dziedziczy zużycie) — sekcja 1c;
--   - nowe konta NIE dostają triala (dowolny klient) — sekcja 1d; konta z trial_until w przyszłości zostają na pro do
--     końca triala, potem cron end_trials (0004) przenosi je na free. Generacje z triala NIE liczą się do darmowych 2
--     (liczone są tylko naliczenia na planie free) — to celowy wybór: uczeń z kończącym się trialem dostaje pełne 2;
--   - plan pro bez zmian (miesięczny limit z PLANS w @nauka/shared; przyszłe pakiety IAP będą mapowane na pro);
--   - limit globalny i limit darmowych generacji w tabeli app_config — zmiana bez migracji (sekcja 0);
--   - osobna pula dla planu free w limicie globalnym (domyślnie 20 z 30 na dobę): konta free (zakładane bez potwierdzania
--     adresu) nie zajmą całej doby kontom pro / z trialem / z przyszłymi pakietami. Równa limitowi globalnemu = bez puli.
--
-- Zgodność z buildem 6: kształt odpowiedzi /api/generate się nie zmienia; wiersz `generations` powstaje z tymi samymi
-- polami (status running, subject_id, material_ids, options), więc odzyskiwanie w kliencie (recoverJob) działa jak dotąd.
-- Obecny (stary) backend do czasu wdrożenia: increment_usage dostaje limit globalny z app_config (domyślnie 30), nowe
-- konta są free bez triala (stary backend liczy im 3 na miesiąc — generacje z tego okna dolicza backfill z 0008).

-- 0) Konfiguracja bez migracji (D3, „limit globalny konfigurowalny”). Tylko serwer: RLS bez polityk, rolom API odebrane.
--    Zmiana (SQL Editor jako właściciel):  update public.app_config set value = '50' where key = 'generation_global_daily_cap';
--    Działa od następnej rezerwacji, bez wdrożenia. Wartość musi być liczbą całkowitą ≥ 0 (JSON 50 albo "50");
--    inna (albo brak wiersza) = wartość domyślna z kodu SQL. 0 w generation_global_daily_cap wstrzymuje tworzenie lekcji.
--    free_global_daily_cap = ile z limitu globalnego mogą zająć konta free (liczy się free_generation_ledger z doby, także
--    wiersze unieważnione — koszt już poniesiony); wartość ≥ limitu globalnego wyłącza osobną pulę.
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  note text,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
revoke all on public.app_config from public, anon, authenticated;
grant select on public.app_config to service_role;
drop trigger if exists touch_app_config on public.app_config;
create trigger touch_app_config before update on public.app_config for each row execute procedure public.touch_updated_at();
-- on conflict do nothing: ponowne wgranie nie nadpisuje wartości zmienionych przez właściciela
insert into public.app_config (key, value, note) values
  ('generation_global_daily_cap', '30'::jsonb,
   'Najwyżej tyle generacji (naliczeń) na cały serwer w kroczącej dobie, wszystkie konta razem. 0 = tworzenie lekcji wstrzymane.'),
  ('free_lifetime_generations', '2'::jsonb,
   'Plan free: tyle generacji na całe życie adresu e-mail (bez odnawiania). Zmiana działa od razu, także dla istniejących kont.'),
  ('free_global_daily_cap', '20'::jsonb,
   'Ile z limitu globalnego mogą zająć konta free w kroczącej dobie (reszta zostaje dla pro). Wartość >= limitu globalnego = bez osobnej puli.')
on conflict (key) do nothing;

-- liczba całkowita ≥ 0 z app_config albo wartość domyślna (brak wiersza, ułamek, liczba ujemna, tekst)
create or replace function public.app_config_int(p_key text, p_default int) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select case when c.value #>> '{}' ~ '^[0-9]{1,9}$' then (c.value #>> '{}')::int end from public.app_config c where c.key = p_key),
    p_default)
$$;
revoke all on function public.app_config_int(text, int) from public, anon, authenticated;

-- 1) Koszt i jakość generacji (P1-3). Tokeny modelu generującego rozbite na klasy cenowe, review osobno, koszt w USD
--    liczony w @nauka/ai (cost.ts) z modelu, który faktycznie odpowiedział. Zapisywane także przy `failed`.
alter table public.generations add column if not exists opus_input int;
alter table public.generations add column if not exists opus_cache_write int;
alter table public.generations add column if not exists opus_cache_read int;
alter table public.generations add column if not exists opus_output int;
alter table public.generations add column if not exists review_input int;
alter table public.generations add column if not exists review_output int;
alter table public.generations add column if not exists cost_usd numeric(8,4);
alter table public.generations add column if not exists quality jsonb;

-- trwające generacje konta (busy w reserve_generation, sweeper)
create index if not exists generations_active on public.generations (owner_id, created_at) where status in ('queued', 'running');

-- 1b) Licznik rezerwacji BEZ powiązania z kontem — do limitu globalnego (app_config, domyślnie 30/dobę). Wiersze generations znikają razem
--     z kontem (on delete cascade z 0001, delete_my_account z 0004), więc samo ich liczenie pozwalało wyzerować limit
--     globalny: skrypt zakłada konta (bez potwierdzania maila), robi generacje i usuwa konta. Tylko serwer (RLS bez
--     polityk, uprawnienia odebrane rolom API); wiersze starsze niż 2 dni kasuje reserve_generation.
create table if not exists public.generation_ledger (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);
create index if not exists generation_ledger_created on public.generation_ledger (created_at);
alter table public.generation_ledger enable row level security;
revoke all on public.generation_ledger from public, anon, authenticated;
grant select on public.generation_ledger to service_role;

-- 1c) Darmowe generacje NA ZAWSZE (plan free, D3 / P0-2). Jeden wiersz na naliczenie na planie free, przypisany do skrótu
--     adresu e-mail (sha256 z lower(trim(email)), hex) i — dopóki konto istnieje — do konta. Wiersz przeżywa usunięcie konta
--     (user_id → null), więc usunięcie konta i ponowna rejestracja tym samym adresem nie daje nowych darmowych generacji.
--     Zużycie konta = wiersze z jego skrótem adresu ALBO z jego user_id (zmiana adresu e-mail w Auth też nie zeruje licznika).
--     Adres bierzemy z auth.users (profiles.email użytkownik może zmienić sam). Konto bez adresu (np. anonimowe) dostaje
--     skrót pustego tekstu — wszystkie takie konta dzielą jedną pulę. sha256() jest wbudowane w Postgresa (≥ 11), bez pgcrypto.
--     Tylko serwer: RLS bez polityk, rolom API odebrane. Po usunięciu konta zostaje sam skrót adresu (bez adresu), data
--     i id generacji — opisane w apce („Twoje dane”, „Usuń konto”); do polityki prywatności.
--     voided_at: wiersz unieważniony (reset dla testera, przyszły zwrot za awarię po naszej stronie — D4) nie liczy się do
--     limitu konta, ale zostaje (backfill go nie odtworzy, pula free w limicie globalnym nadal go liczy). NIGDY nie kasuj
--     wierszy ręcznie — ponowne wgranie 0007/0008 (backfill) dopisałoby je z powrotem; użyj reset_free_generations (2e).
create table if not exists public.free_generation_ledger (
  id bigint generated always as identity primary key,
  email_hash text not null constraint free_generation_ledger_hash check (email_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid references auth.users(id) on delete set null,
  generation_id uuid unique, -- bez klucza obcego: wiersz generations znika razem z kontem, a ten ma zostać
  created_at timestamptz not null default now(),
  voided_at timestamptz
);
alter table public.free_generation_ledger add column if not exists voided_at timestamptz;
create index if not exists free_generation_ledger_email on public.free_generation_ledger (email_hash);
create index if not exists free_generation_ledger_user on public.free_generation_ledger (user_id) where user_id is not null;
create index if not exists free_generation_ledger_created on public.free_generation_ledger (created_at);
alter table public.free_generation_ledger enable row level security;
revoke all on public.free_generation_ledger from public, anon, authenticated;
grant select on public.free_generation_ledger to service_role;

create or replace function public.email_hash(p_email text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(lower(btrim(coalesce(p_email, ''), E' \t\r\n')), 'UTF8')), 'hex')
$$;
revoke all on function public.email_hash(text) from public, anon, authenticated;

create or replace function public.account_email_hash(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select public.email_hash((select u.email from auth.users u where u.id = p_user))
$$;
revoke all on function public.account_email_hash(uuid) from public, anon, authenticated;

create or replace function public.free_generations_used(p_user uuid, p_email_hash text) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.free_generation_ledger l
   where (l.email_hash = p_email_hash or l.user_id = p_user) and l.voided_at is null
$$;
revoke all on function public.free_generations_used(uuid, text) from public, anon, authenticated;

-- 1e) Liczniki kroczącej doby dla limitu globalnego (reserve_generation i generation_quota — ta sama definicja):
--     cały serwer = większa z liczb: wiersze generations (także sprzed 0007) albo generation_ledger (przeżywa usunięcie konta);
--     pula free = wiersze free_generation_ledger (z unieważnionymi: koszt już poniesiony).
create or replace function public.generations_last_day() returns bigint
language sql stable security definer set search_path = '' as $$
  select greatest((select count(*) from public.generations g where g.created_at > now() - interval '1 day'),
                  (select count(*) from public.generation_ledger l where l.created_at > now() - interval '1 day'))
$$;
revoke all on function public.generations_last_day() from public, anon, authenticated;
create or replace function public.free_generations_last_day() returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from public.free_generation_ledger l where l.created_at > now() - interval '1 day'
$$;
revoke all on function public.free_generations_last_day() from public, anon, authenticated;

-- 1d) Bez triala dla nowych kont (D3 / P0-2: farmienie triali). Zastępuje handle_new_user z 0004: każde nowe konto
--     (Cramfox, web, dowolne metadane klienta) dostaje plan free bez trial_until. Istniejące konta z trial_until w przyszłości
--     zostają na pro do końca triala (end_trials z 0004 bez zmian).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name, plan, trial_until)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''),'@',1)),
          'free'::public.plan, null)
  on conflict (id) do nothing;
  insert into public.user_meta (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

-- 2) Rezerwacja generacji w JEDNEJ transakcji (P0-1). Zastępuje increment_usage + osobny INSERT w route.ts, między którymi
--    równoległe żądania omijały limit dzienny (20/konto) i globalny: wszystkie widziały licznik 0.
--    Plan konta czyta sama (profiles.plan): pro → limit miesięczny p_monthly_limit (z PLANS w @nauka/shared), każdy inny →
--    darmowe generacje na zawsze (1c) z limitem z app_config (domyślnie 2); p_monthly_limit jest wtedy pomijane.
--    Blokady doradcze zawsze w tej kolejności: konto → adres e-mail (tylko free) → serwer; globalna jest ostatnia, więc bez
--    zakleszczeń. Blokada adresu łapie dwa żywe konta z tym samym adresem po normalizacji (np. różna wielkość liter).
--    Kolejność sprawdzeń: busy → limit dzienny konta (20) → limit planu (darmowe na zawsze albo miesięczny) → globalny
--    (app_config, domyślnie 30) → (free) pula free w limicie globalnym (app_config, domyślnie 20) — wszystkie PRZED
--    podbiciem licznika; limit planu przed globalnym, bo odmowa z powodu konta
--    jest trwała i ma konkretny komunikat („wykorzystano obie darmowe lekcje” zamiast „spróbuj jutro”). Potem wiersz
--    generations (running) → wpis w generation_ledger → (free) wpis w free_generation_ledger → usage + 1 (miesięcznie,
--    dla każdego planu: statystyki i limit pro).
--    busy = świeża generacja queued/running młodsza niż 5,5 min: żądanie żyje najwyżej 300 s (maxDuration Vercela), a wiersz
--    powstaje już po jego starcie, więc 330 s od created_at obejmuje całe żądanie i kończy się razem z werdyktem „lost”
--    Cramfoxa (330 s) — ponowna próba po nim nie trafia na „busy”. Martwe wiersze zamyka sprzątacz po 8 min.
--    Odmowa niczego nie zmienia. Odpowiedź: {ok:true, generation_id, used, limit, plan, scope} (used/limit = licznik planu
--    po naliczeniu: free — na zawsze, pro — w miesiącu) albo {ok:false, reason, used?, limit?, pool?},
--    reason ∈ busy | daily | global | monthly | lifetime (pula free pełna = global z pool "free" — dla API to samo).
--    API mapuje daily/global na 402 limit_reached z used 999999 / 1999999
--    (jak dotąd), monthly i lifetime na 402 limit_reached z used, limit i scope ("month" / "lifetime"). Tylko service role.
create or replace function public.reserve_generation(
  p_user uuid,
  p_month text,
  p_monthly_limit int,
  p_subject_id uuid,
  p_stage text,
  p_hint text,
  p_options jsonb,
  p_material_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_plan text;
  v_hash text;
  v_used int;
  v_limit int;
  v_month int;
  v_cap int;
  v_id uuid;
begin
  if p_user is null or p_month is null or p_monthly_limit is null or p_stage is null then
    raise exception 'reserve_generation: missing arguments';
  end if;
  perform pg_advisory_xact_lock(hashtext('cramfox:generation:user'), hashtext(p_user::text));
  select p.plan::text into v_plan from public.profiles p where p.id = p_user;
  v_plan := coalesce(v_plan, 'free');
  if v_plan <> 'pro' then
    v_plan := 'free';
    v_hash := public.account_email_hash(p_user);
    perform pg_advisory_xact_lock(hashtext('cramfox:generation:email'), hashtext(v_hash));
  end if;
  perform pg_advisory_xact_lock(hashtext('cramfox:generation:global'), 0);

  -- jedna generacja naraz na konto (świeże queued/running; martwe wiersze zamyka sweeper, a po 5,5 min i tak nie blokują)
  if exists (select 1 from public.generations g
              where g.owner_id = p_user and g.status in ('queued', 'running') and g.created_at > now() - interval '330 seconds') then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;
  -- 20 na konto w kroczącej dobie (liczą się też nieudane)
  if (select count(*) from public.generations g where g.owner_id = p_user and g.created_at > now() - interval '1 day') >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'daily', 'limit', 20);
  end if;
  -- limit planu, sprawdzany przed podbiciem (koniec z licznikiem 4/3 po odmowie)
  if v_plan = 'pro' then
    select u.generations into v_used from public.usage u where u.user_id = p_user and u.month = p_month;
    v_used := coalesce(v_used, 0);
    v_limit := p_monthly_limit;
    if v_used >= v_limit then
      return jsonb_build_object('ok', false, 'reason', 'monthly', 'used', v_used, 'limit', v_limit);
    end if;
  else
    v_used := public.free_generations_used(p_user, v_hash);
    v_limit := public.app_config_int('free_lifetime_generations', 2);
    if v_used >= v_limit then
      return jsonb_build_object('ok', false, 'reason', 'lifetime', 'used', v_used, 'limit', v_limit);
    end if;
  end if;
  -- cały serwer w kroczącej dobie (app_config, domyślnie 30): większa z liczb — wiersze generations (także sprzed tej
  -- migracji) albo licznik generation_ledger (przeżywa usunięcie konta) — 1e
  v_cap := public.app_config_int('generation_global_daily_cap', 30);
  if public.generations_last_day() >= v_cap then
    return jsonb_build_object('ok', false, 'reason', 'global', 'limit', v_cap);
  end if;
  -- pula free w limicie globalnym (app_config, domyślnie 20): reszta doby zostaje dla pro
  if v_plan = 'free' then
    v_cap := public.app_config_int('free_global_daily_cap', 20);
    if public.free_generations_last_day() >= v_cap then
      return jsonb_build_object('ok', false, 'reason', 'global', 'limit', v_cap, 'pool', 'free');
    end if;
  end if;

  insert into public.generations (owner_id, status, stage, hint, options, material_ids, subject_id)
  values (p_user, 'running', p_stage::public.stage, p_hint, coalesce(p_options, '{}'::jsonb), coalesce(p_material_ids, '{}'::uuid[]), p_subject_id)
  returning id into v_id;
  insert into public.generation_ledger default values;
  delete from public.generation_ledger l where l.created_at < now() - interval '2 days';
  if v_plan = 'free' then
    insert into public.free_generation_ledger (email_hash, user_id, generation_id) values (v_hash, p_user, v_id);
    v_used := v_used + 1;
  end if;

  insert into public.usage as u (user_id, month, generations) values (p_user, p_month, 1)
  on conflict (user_id, month) do update set generations = u.generations + 1
  returning u.generations into v_month;
  if v_plan = 'pro' then v_used := v_month; end if;

  return jsonb_build_object('ok', true, 'generation_id', v_id, 'used', v_used, 'limit', v_limit,
                            'plan', v_plan, 'scope', case when v_plan = 'pro' then 'month' else 'lifetime' end);
end $$;
revoke all on function public.reserve_generation(uuid, text, int, uuid, text, text, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.reserve_generation(uuid, text, int, uuid, text, text, jsonb, uuid[]) to service_role;

-- 2b) Stan limitu konta (tylko odczyt) dla GET /api/me i wstępnego sprawdzenia w POST /api/generate — ta sama logika planu
--     co w reserve_generation. Odpowiedź: {plan, scope, used, limit, remaining, month?, trial_until, free_limit, global_open};
--     scope "lifetime" (free: darmowe na zawsze) albo "month" (pro: p_monthly_limit w miesiącu p_month). trial_until = koniec
--     triala konta sprzed 2026-10-15 (albo null). free_limit = darmowe na zawsze z app_config (konto z trialem dostanie je
--     po jego końcu). global_open = false, gdy limit globalny (albo, dla free, pula free) jest teraz pełny — apka mówi to
--     przed aparatem, zamiast po wysłaniu plików. Tylko service role.
create or replace function public.generation_quota(p_user uuid, p_month text, p_monthly_limit int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_plan text;
  v_trial timestamptz;
  v_used int;
  v_limit int;
  v_free int;
  v_open boolean;
begin
  if p_user is null or p_month is null then raise exception 'generation_quota: missing arguments'; end if;
  select p.plan::text, p.trial_until into v_plan, v_trial from public.profiles p where p.id = p_user;
  v_free := public.app_config_int('free_lifetime_generations', 2);
  v_open := public.generations_last_day() < public.app_config_int('generation_global_daily_cap', 30);
  if v_plan = 'pro' then
    select u.generations into v_used from public.usage u where u.user_id = p_user and u.month = p_month;
    v_used := coalesce(v_used, 0);
    v_limit := greatest(coalesce(p_monthly_limit, 0), 0);
    return jsonb_build_object('plan', 'pro', 'scope', 'month', 'used', v_used, 'limit', v_limit,
                              'remaining', greatest(v_limit - v_used, 0), 'month', p_month, 'trial_until', v_trial,
                              'free_limit', v_free, 'global_open', v_open);
  end if;
  v_used := public.free_generations_used(p_user, public.account_email_hash(p_user));
  v_open := v_open and public.free_generations_last_day() < public.app_config_int('free_global_daily_cap', 20);
  return jsonb_build_object('plan', 'free', 'scope', 'lifetime', 'used', v_used, 'limit', v_free,
                            'remaining', greatest(v_free - v_used, 0), 'trial_until', v_trial,
                            'free_limit', v_free, 'global_open', v_open);
end $$;
revoke all on function public.generation_quota(uuid, text, int) from public, anon, authenticated;
grant execute on function public.generation_quota(uuid, text, int) to service_role;

-- 2c) Stary backend (do wdrożenia Build 7 i po ewentualnym wycofaniu) nalicza przez increment_usage z 0004: limit globalny
--     bierze teraz z app_config (domyślnie 30 zamiast 300) i liczy też generation_ledger. Reszta jak w 0004 (20/konto,
--     wartości 1000000 / 2000000, tutor_cap). Limitu darmowych generacji na zawsze ani puli free stary backend nie zna —
--     w tym oknie konta free mają jego miesięczne 3; backfill (2d) dolicza je w 0008.
create or replace function public.increment_usage(p_user uuid, p_month text, p_field text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_field = 'generations' then
    if (select count(*) from public.generations g where g.owner_id = p_user and g.created_at > now() - interval '1 day') >= 20 then
      return 1000000;
    end if;
    if public.generations_last_day() >= public.app_config_int('generation_global_daily_cap', 30) then
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

-- 2d) Historia: generacje kont, które są dziś na planie free, zrobione na planie free (po końcu triala albo konta bez triala)
--     liczą się do darmowych 2. Generacje z triala — nie. Idempotentne (po generation_id); wołane tu i drugi raz w 0008
--     (dolicza generacje, które stary backend zrobił między 0007 a wdrożeniem). Przybliżenie: konto, które kiedyś miało pro
--     z subskrypcji (Stripe, tylko tryb testowy) i wróciło na free, ma policzone też generacje z czasu pro. Zwraca liczbę
--     dopisanych wierszy. Tylko właściciel / SQL Editor. Wiersze unieważnione (voided_at) zostają, więc ich nie odtwarza.
--     Start wszystkich kont od zera (bez historii) = usunąć OBA wywołania: ostatnią linię tej sekcji i sekcję 0 w 0008.
create or replace function public.backfill_free_generation_ledger() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.free_generation_ledger (email_hash, user_id, generation_id, created_at)
  select public.email_hash(u.email), g.owner_id, g.id, g.created_at
    from public.generations g
    join public.profiles p on p.id = g.owner_id
    join auth.users u on u.id = g.owner_id
   where p.plan = 'free'
     and (p.trial_until is null or g.created_at >= p.trial_until)
     and not exists (select 1 from public.free_generation_ledger l where l.generation_id = g.id)
  on conflict (generation_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.backfill_free_generation_ledger() from public, anon, authenticated;
select public.backfill_free_generation_ledger();

-- 2e) Reset darmowych generacji jednego adresu (tester, wyjątek dla ucznia): unieważnia (voided_at) wiersze skrótu tego adresu
--     i kont, które mają go teraz w Auth. Wiersze zostają, więc ponowne wgranie 0007/0008 (backfill) ich nie przywróci.
--     Zwraca liczbę unieważnionych wierszy. Tylko właściciel / SQL Editor:  select public.reset_free_generations('ala@example.com');
create or replace function public.reset_free_generations(p_email text) returns int
language plpgsql security definer set search_path = '' as $$
declare h text := public.email_hash(p_email); n int;
begin
  if coalesce(btrim(p_email), '') = '' then raise exception 'reset_free_generations: empty e-mail'; end if;
  update public.free_generation_ledger l set voided_at = now()
   where l.voided_at is null
     and (l.email_hash = h or l.user_id in (select u.id from auth.users u where public.email_hash(u.email) = h));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.reset_free_generations(text) from public, anon, authenticated;

-- 3) Zapis tematu i status `done` w JEDNEJ transakcji (P1-4). Wcześniej: INSERT topics, potem osobny UPDATE generations —
--    zabicie funkcji między nimi zostawiało opłacony temat przy wierszu `running`. Zwraca wiersz tematu (jak select w route.ts).
--    Pozycja = max(position) + 1 w przedmiocie (= liczba tematów, dopóki żadnego nie usunięto). Przedmiot usunięty w trakcie
--    → wyjątek → route oznacza generację jako failed. Tylko service role.
--    p_topic: {name, emoji, source, content}; p_stats: {model, input_tokens, output_tokens, opus_*, review_*, cost_usd, quality}.
create or replace function public.finish_generation(p_generation_id uuid, p_topic jsonb, p_stats jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g public.generations%rowtype;
  t public.topics%rowtype;
begin
  select * into g from public.generations where id = p_generation_id for update;
  if not found then raise exception 'generation_not_found'; end if;
  if g.status not in ('queued', 'running') then raise exception 'generation_not_running: %', g.status; end if;
  if g.subject_id is null then raise exception 'subject_missing'; end if;
  perform 1 from public.subjects s where s.id = g.subject_id for update;
  if not found then raise exception 'subject_missing'; end if;
  if p_topic is null or p_topic->'content' is null or coalesce(p_topic->>'name', '') = '' then raise exception 'topic_missing'; end if;

  insert into public.topics (subject_id, owner_id, name, emoji, source, content, generation_id, position)
  values (g.subject_id, g.owner_id, p_topic->>'name', coalesce(nullif(p_topic->>'emoji', ''), '📘'),
          coalesce(nullif(p_topic->>'source', ''), 'materials'), p_topic->'content', g.id,
          (select coalesce(max(x.position) + 1, 0) from public.topics x where x.subject_id = g.subject_id))
  returning * into t;

  update public.generations set
    status = 'done',
    topic_id = t.id,
    finished_at = now(),
    error = null,
    model = p_stats->>'model',
    input_tokens = (p_stats->>'input_tokens')::int,
    output_tokens = (p_stats->>'output_tokens')::int,
    opus_input = (p_stats->>'opus_input')::int,
    opus_cache_write = (p_stats->>'opus_cache_write')::int,
    opus_cache_read = (p_stats->>'opus_cache_read')::int,
    opus_output = (p_stats->>'opus_output')::int,
    review_input = (p_stats->>'review_input')::int,
    review_output = (p_stats->>'review_output')::int,
    cost_usd = (p_stats->>'cost_usd')::numeric(8,4),
    quality = p_stats->'quality'
  where id = g.id;

  return to_jsonb(t);
end $$;
revoke all on function public.finish_generation(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.finish_generation(uuid, jsonb, jsonb) to service_role;

-- 4) Sprzątacz (P1-4): generacja `queued`/`running` starsza niż 8 min nie ma już procesu (Vercel zabija po 300 s,
--    wewnętrzny termin to 270 s) → `failed`. Dzięki temu wiersz nie wisi na zawsze, a busy przestaje blokować konto.
--    Limit NIE jest zwracany: zasady zwrotów (awarie po naszej stronie) czekają na decyzję D4 (AUDYT P1-33).
create or replace function public.sweep_stale_generations() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.generations g
     set status = 'failed',
         finished_at = now(),
         error = coalesce(g.error, 'stale: brak wyniku po 8 min (proces przerwany po stronie serwera)')
   where g.status in ('queued', 'running') and g.created_at < now() - interval '8 minutes';
  get diagnostics n = row_count;
  -- TODO(D4, AUDYT P1-33): po decyzji o zwrotach — tu (i w route przy api 429/5xx/529, ai_timeout, błędzie zapisu) oddać
  -- limit: usage.generations - 1 w miesiącu wiersza + kolumna generations.refunded, a na planie free także
  -- free_generation_ledger.voided_at = now() dla generation_id (inaczej nieudana próba liczy się do darmowych na zawsze).
  -- Bez zwrotu przy odmowie i too_long.
  return n;
end $$;
revoke all on function public.sweep_stale_generations() from public, anon, authenticated;
create extension if not exists pg_cron;
do $$ begin
  perform cron.unschedule('cramfox-sweep-generations') where exists (select 1 from cron.job where jobname = 'cramfox-sweep-generations');
  perform cron.schedule('cramfox-sweep-generations', '*/5 * * * *', 'select public.sweep_stale_generations()');
end $$;

-- 5) Dzienny koszt (P1-3) — tylko do odczytu dla właściciela (service role / SQL Editor). security_invoker: widok nie omija RLS.
create or replace view public.generation_cost_daily with (security_invoker = true) as
select (g.created_at at time zone 'UTC')::date as day,
       count(*) as generations,
       count(*) filter (where g.status = 'done') as done,
       count(*) filter (where g.status = 'failed') as failed,
       count(g.cost_usd) as costed,
       coalesce(sum(g.cost_usd), 0)::numeric(12,4) as cost_usd,
       round(avg(g.cost_usd), 4) as avg_cost_usd,
       round((percentile_cont(0.9) within group (order by g.cost_usd))::numeric, 4) as p90_cost_usd,
       coalesce(sum(g.opus_input), 0) as opus_input,
       coalesce(sum(g.opus_cache_write), 0) as opus_cache_write,
       coalesce(sum(g.opus_cache_read), 0) as opus_cache_read,
       coalesce(sum(g.opus_output), 0) as opus_output,
       coalesce(sum(g.review_input), 0) as review_input,
       coalesce(sum(g.review_output), 0) as review_output
  from public.generations g
 group by 1;
revoke all on public.generation_cost_daily from public, anon, authenticated;
grant select on public.generation_cost_daily to service_role;

-- 6) Rozmiar bucketu materials (P1-5, „alert rozmiaru bucketu”): do ręcznego sprawdzania albo zewnętrznego monitoringu.
create or replace function public.materials_bucket_stats()
returns table (objects bigint, bytes bigint, objects_24h bigint, bytes_24h bigint)
language sql stable security definer set search_path = '' as $$
  select count(*),
         coalesce(sum(case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint end), 0),
         count(*) filter (where o.created_at > now() - interval '24 hours'),
         coalesce(sum(case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint end)
                  filter (where o.created_at > now() - interval '24 hours'), 0)
    from storage.objects o
   where o.bucket_id = 'materials';
$$;
revoke all on function public.materials_bucket_stats() from public, anon, authenticated;
grant execute on function public.materials_bucket_stats() to service_role;
