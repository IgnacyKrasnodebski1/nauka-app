-- Cramfox — migracja 0009: zwrot limitu za awarię AI po naszej stronie (ai_unavailable). Incydent z 2026-10-16.
--
-- Co się stało: klucz ANTHROPIC_API_KEY w Vercelu przestał działać. Generacja dostała od AI „401 authentication_error
-- invalid x-api-key”, wiersz generations był już naliczony (reserve_generation), a apka (build 7) pokazała „Plik jest za
-- duży albo zabezpieczony … Ta próba liczy się do miesięcznego limitu” — zły powód, zła rada i limit zjedzony przez nas.
-- Backend (nauka-backend, @nauka/ai) rozpoznaje teraz błędy po naszej stronie — 401/403, 404, 408, 429, 529, 5xx, rozliczenia
-- konta, zerwane połączenie, termin bez żadnej odpowiedzi AI — jako kod `ai_unavailable` (HTTP 503). Gdy AI nie wyprodukowało
-- NIC (żadne wywołanie nie zaczęło odpowiadać), trasa woła release_generation (niżej) i odpowiada `charged: false`.
-- Błędy materiału (400 o obrazie / PDF, za długi materiał) i porażki po wyprodukowaniu treści — bez zmian (naliczone).
--
-- KOLEJNOŚĆ WGRYWANIA:
--   0007 (wgrane na produkcji 2026-10-16) → 0009 (ten plik) → wdrożenie backendu, który woła release_generation.
--   0009 może iść przed albo po 0008 (nie dotykają tych samych obiektów; db-test sprawdza obie kolejności).
--   Backend bez 0009: wywołanie release_generation się nie uda → odpowiedź `charged: true`, naliczenie zostaje (jak dziś).
--   0009 bez nowego backendu: nic się nie zmienia (nowe kolumny puste, funkcja nieużywana).
-- Idempotentna: można wgrać ponownie. Ponowne wgranie 0007 przywraca jego wersje generations_last_day,
-- free_generations_last_day i backfill_free_generation_ledger (zwrócone generacje znów liczyłyby się do limitu globalnego)
-- — po nim zawsze wgraj ponownie 0009.
-- Wgranie: supabase db query --linked -f backend/0009_release_generation.sql
--
-- Zwrot (D4, AUDYT P1-33) — tylko ten jeden przypadek: awaria po naszej stronie, zanim AI cokolwiek wyprodukowało (koszt ≈ 0).
-- Zwrot NIE obejmuje: limitu 20 generacji konta na dobę (reserve_generation liczy wiersze generations, także zwrócone —
-- bezpiecznik przed nadużyciem zostaje), odmowy AI, too_long, błędów zapisu, terminu po rozpoczęciu odpowiedzi, sprzątacza.

-- 1) Znaczniki zwrotu. generations.refunded_at — kiedy zwrócono; generation_ledger.voided_at — wpis nie liczy się do limitu
--    globalnego; free_generation_ledger.refunded_at — zwrot (w odróżnieniu od resetu testera: reset_free_generations ustawia
--    tylko voided_at, a pula free w limicie globalnym dalej liczy takie wiersze, bo koszt był poniesiony; zwrot — nie).
--    Klienci nie czytają refunded_at (0008 daje im tylko wybrane kolumny generations); stan zwrotu widać w `error`
--    (prefiks „released:”), który klient czyta przy odzyskiwaniu przerwanej generacji.
alter table public.generations add column if not exists refunded_at timestamptz;
alter table public.generation_ledger add column if not exists voided_at timestamptz;
alter table public.free_generation_ledger add column if not exists refunded_at timestamptz;

-- 2) Liczniki kroczącej doby (0007, 1e) bez zwróconych generacji: awaria AI z ponawianymi próbami nie wyczerpie limitu
--    globalnego (domyślnie 30) na całą dobę po naprawie.
create or replace function public.generations_last_day() returns bigint
language sql stable security definer set search_path = '' as $$
  select greatest((select count(*) from public.generations g where g.created_at > now() - interval '1 day' and g.refunded_at is null),
                  (select count(*) from public.generation_ledger l where l.created_at > now() - interval '1 day' and l.voided_at is null))
$$;
revoke all on function public.generations_last_day() from public, anon, authenticated;

create or replace function public.free_generations_last_day() returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from public.free_generation_ledger l where l.created_at > now() - interval '1 day' and l.refunded_at is null
$$;
revoke all on function public.free_generations_last_day() from public, anon, authenticated;

-- 3) Backfill z 0007 (2d; 0008 woła go drugi raz) pomija zwrócone generacje (konto, które było pro i wróciło na free, nie
--    dostaje ich w historii). Poza tym bez zmian.
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
     and g.refunded_at is null
     and not exists (select 1 from public.free_generation_ledger l where l.generation_id = g.id)
  on conflict (generation_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.backfill_free_generation_ledger() from public, anon, authenticated;

-- 4) Zwrot jednej generacji w JEDNEJ transakcji (odwrotność reserve_generation):
--      generations → failed, finished_at, refunded_at, error z prefiksem „released:<powód>”;
--      usage.generations − 1 w miesiącu (UTC) utworzenia wiersza (reserve_generation podbija usage dla każdego planu);
--      free_generation_ledger: wiersz tej generacji unieważniony (voided_at) i oznaczony zwrotem (refunded_at) — darmowa
--        lekcja wraca, a pula free w limicie globalnym jej nie liczy;
--      generation_ledger: jeden wpis z chwili rezerwacji unieważniony (voided_at). Wpis nie ma id generacji (celowo: licznik
--        bez powiązania z kontem), ale reserve_generation wstawia go w tej samej transakcji co wiersz generations, więc oba
--        mają ten sam created_at (now() transakcji); unieważniany jest jeden taki wpis.
--    Blokada doradcza konta jak w reserve_generation (pierwsza w tej samej kolejności, więc bez zakleszczeń): zwrot i nowa
--    rezerwacja tego konta idą po kolei. Idempotentna: drugi raz → {ok:true, already:true} i nic się nie zmienia.
--    Odmawia generacji `done` (albo z tematem): {ok:false, reason:'done'}; brak wiersza: {ok:false, reason:'not_found'}.
--    Odpowiedź po zwrocie: {ok:true, generation_id, usage, free_ledger, ledger} (ile wierszy zmieniono, 0 albo 1).
--    Woła ją tylko /api/generate (service role) przy ai_unavailable przed jakąkolwiek odpowiedzią AI — ZAMIAST oznaczania
--    porażki (wiersz jest jeszcze `running`; powód = „ai_unavailable: <oryginalny błąd>”), więc klient odzyskujący przerwaną
--    generację nie zobaczy wiersza `failed`, który jeszcze nie jest zwrócony. Dopiero gdy zwrot się nie uda, trasa oznacza
--    wiersz `failed` z błędem „ai_unavailable: …” (naliczone). Działa też na wierszu już `failed`. Właściciel może też
--    zwrócić pojedynczą nieudaną generację ręcznie (SQL Editor):  select public.release_generation('<id>', 'powód');
create or replace function public.release_generation(p_generation_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  g public.generations%rowtype;
  v_reason text := left(btrim(coalesce(p_reason, ''), E' \t\r\n'), 200);
  v_month text;
  v_usage int := 0;
  v_free int := 0;
  v_ledger int := 0;
begin
  if p_generation_id is null or v_reason = '' then
    raise exception 'release_generation: missing arguments';
  end if;
  select x.owner_id into v_owner from public.generations x where x.id = p_generation_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  perform pg_advisory_xact_lock(hashtext('cramfox:generation:user'), hashtext(v_owner::text));
  select * into g from public.generations x where x.id = p_generation_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if g.refunded_at is not null then
    return jsonb_build_object('ok', true, 'already', true, 'generation_id', g.id);
  end if;
  if g.status = 'done' or g.topic_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'done');
  end if;

  update public.generations x
     set status = 'failed',
         finished_at = coalesce(x.finished_at, now()),
         refunded_at = now(),
         error = left('released:' || v_reason || coalesce(' | ' || x.error, ''), 2000)
   where x.id = g.id;

  v_month := to_char(g.created_at at time zone 'UTC', 'YYYY-MM');
  update public.usage u set generations = u.generations - 1
   where u.user_id = g.owner_id and u.month = v_month and u.generations > 0;
  get diagnostics v_usage = row_count;

  update public.free_generation_ledger l
     set voided_at = coalesce(l.voided_at, now()), refunded_at = now()
   where l.generation_id = g.id and l.refunded_at is null;
  get diagnostics v_free = row_count;

  update public.generation_ledger l set voided_at = now()
   where l.id = (select l2.id from public.generation_ledger l2
                  where l2.created_at = g.created_at and l2.voided_at is null
                  order by l2.id limit 1);
  get diagnostics v_ledger = row_count;

  return jsonb_build_object('ok', true, 'generation_id', g.id, 'usage', v_usage, 'free_ledger', v_free, 'ledger', v_ledger);
end $$;
revoke all on function public.release_generation(uuid, text) from public, anon, authenticated;
grant execute on function public.release_generation(uuid, text) to service_role;
