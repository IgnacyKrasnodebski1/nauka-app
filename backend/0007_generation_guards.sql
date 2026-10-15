-- Cramfox — migracja 0007 (ADDYTYWNA): bezpieczniki kosztów generacji. AUDYT §6.1 A, pozycje P0-1, P1-3, P1-4.
--
-- KOLEJNOŚĆ WGRYWANIA (Build 7):
--   1. 0007 (ten plik)                — przed wdrożeniem backendu; nic nie zabiera, build 6 i obecny backend działają bez zmian
--   2. wdrożenie backendu z Build 7   — nowy /api/generate WYMAGA tej migracji (reserve_generation, finish_generation, kolumny)
--   3. 0008_account_limits.sql        — zaostrzenia; dopiero po wdrożeniu backendu i sprawdzeniu, że build 6 dalej działa
--   4. build 7 apki
-- Idempotentna: można wgrać ponownie. Opiera się na 0001 (generations, usage, topics, subjects) i 0004 (pg_cron, indeksy).
-- Wgranie: supabase db query --linked -f backend/0007_generation_guards.sql
--
-- Zgodność z buildem 6: kształt odpowiedzi /api/generate się nie zmienia; wiersz `generations` powstaje z tymi samymi
-- polami (status running, subject_id, material_ids, options), więc odzyskiwanie w kliencie (recoverJob) działa jak dotąd.

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

-- 1b) Licznik rezerwacji BEZ powiązania z kontem — do limitu globalnego (300/dobę). Wiersze generations znikają razem
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

-- 2) Rezerwacja generacji w JEDNEJ transakcji (P0-1). Zastępuje increment_usage + osobny INSERT w route.ts, między którymi
--    równoległe żądania omijały limit dzienny (20/konto) i globalny (300/serwer): wszystkie widziały licznik 0.
--    Kolejność: blokada doradcza konta → blokada globalna (zawsze w tej kolejności, więc bez zakleszczeń) → busy →
--    limit dzienny → globalny → miesięczny (wszystkie PRZED podbiciem licznika) → wiersz generations (running) →
--    wpis w generation_ledger → usage + 1.
--    busy = świeża generacja queued/running młodsza niż 5,5 min: żądanie żyje najwyżej 300 s (maxDuration Vercela), a wiersz
--    powstaje już po jego starcie, więc 330 s od created_at obejmuje całe żądanie i kończy się razem z werdyktem „lost”
--    Cramfoxa (330 s) — ponowna próba po nim nie trafia na „busy”. Martwe wiersze zamyka sprzątacz po 8 min.
--    Odmowa niczego nie zmienia. Odpowiedź: {ok:true, generation_id, used, limit} albo {ok:false, reason, used?, limit?},
--    reason ∈ busy | daily | global | monthly. API mapuje daily/global na 402 limit_reached z used 999999 / 1999999 (jak dotąd).
--    Limit miesięczny podaje serwer z PLANS (@nauka/shared). Tylko service role.
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
  v_used int;
  v_id uuid;
begin
  if p_user is null or p_month is null or p_monthly_limit is null or p_stage is null then
    raise exception 'reserve_generation: missing arguments';
  end if;
  perform pg_advisory_xact_lock(hashtext('cramfox:generation:user'), hashtext(p_user::text));
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
  -- 300 na cały serwer w kroczącej dobie: większa z liczb — wiersze generations (także sprzed tej migracji) albo licznik
  -- generation_ledger (przeżywa usunięcie konta)
  if greatest((select count(*) from public.generations g where g.created_at > now() - interval '1 day'),
              (select count(*) from public.generation_ledger l where l.created_at > now() - interval '1 day')) >= 300 then
    return jsonb_build_object('ok', false, 'reason', 'global', 'limit', 300);
  end if;
  -- miesięczny limit planu, sprawdzany przed podbiciem (koniec z licznikiem 4/3 po odmowie)
  select u.generations into v_used from public.usage u where u.user_id = p_user and u.month = p_month;
  v_used := coalesce(v_used, 0);
  if v_used >= p_monthly_limit then
    return jsonb_build_object('ok', false, 'reason', 'monthly', 'used', v_used, 'limit', p_monthly_limit);
  end if;

  insert into public.generations (owner_id, status, stage, hint, options, material_ids, subject_id)
  values (p_user, 'running', p_stage::public.stage, p_hint, coalesce(p_options, '{}'::jsonb), coalesce(p_material_ids, '{}'::uuid[]), p_subject_id)
  returning id into v_id;
  insert into public.generation_ledger default values;
  delete from public.generation_ledger l where l.created_at < now() - interval '2 days';

  insert into public.usage as u (user_id, month, generations) values (p_user, p_month, 1)
  on conflict (user_id, month) do update set generations = u.generations + 1
  returning u.generations into v_used;

  return jsonb_build_object('ok', true, 'generation_id', v_id, 'used', v_used, 'limit', p_monthly_limit);
end $$;
revoke all on function public.reserve_generation(uuid, text, int, uuid, text, text, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.reserve_generation(uuid, text, int, uuid, text, text, jsonb, uuid[]) to service_role;

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
  -- limit: usage.generations - 1 w miesiącu wiersza + kolumna generations.refunded. Bez zwrotu przy odmowie i too_long.
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
