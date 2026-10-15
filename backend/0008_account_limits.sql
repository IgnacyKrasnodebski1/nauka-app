-- Cramfox — migracja 0008 (ZAOSTRZAJĄCA): limity Storage i bazy na jedno konto. AUDYT §6.1 A7, pozycja P1-5.
--
-- KOLEJNOŚĆ WGRYWANIA (Build 7):
--   1. 0007_generation_guards.sql
--   2. wdrożenie backendu z Build 7
--   3. 0008 (ten plik) — po sprawdzeniu, że build 6 działa z nowym backendem (AUDYT §6.1: najpierw addytywne, potem zaostrzenia)
--   4. build 7 apki
-- Idempotentna: można wgrać ponownie. Nie zależy od kodu backendu (działa i ze starym, i z nowym).
-- Wgranie: supabase db query --linked -f backend/0008_account_limits.sql
-- Polityka na storage.objects jest celowo OSTATNIA. Gdy CLI jej odmówi (storage.objects należy do supabase_storage_admin),
-- wklej CAŁY plik w SQL Editor — jest idempotentny, więc to, co już weszło, się nie zdubluje, a to, co CLI cofnęło
-- (jedna transakcja), wejdzie — i sprawdź WSZYSTKIE sekcje zapytaniami z docs/DEPLOY.md (nie tylko politykę).
--
-- Bez tego jedno konto skryptem (sam klucz anon) zapełnia 1 GB bucketu albo 500 MB bazy — bez dotykania API i limitu
-- generacji — i wysyłka albo synchronizacja staje wszystkim. Progi są wysoko ponad normalnym użyciem buildu 6
-- (free: 2 generacje na zawsze × 5 plików — od 0007; pro: 20/dobę × 20 plików, ale realnie kilka materiałów dziennie).
-- Build 6 przy przekroczeniu pokaże ogólny błąd wysyłki („Nie udało się wysłać pliku … Limit się nie zmienił”) albo
-- zapisu przedmiotu — build 7 może mapować te odpowiedzi (patrz docs/API.md w nauka-backend).
--
-- Progi (zmiana = nowa migracja z create or replace):
--   Storage, bucket materials: najwyżej 100 nowych obiektów i 500 MB na konto w kroczącej dobie (liczą się pliki,
--     które nadal istnieją: sprzątanie po nieudanej próbie zwalnia limit). Dzienny, a nie łączny, bo dopóki pliki zostają
--     na zawsze (decyzja D9), aktywny uczeń przekroczyłby każdy rozsądny limit łączny.
--   materials (wiersze): najwyżej 100 nowych na konto w kroczącej dobie.
--   subjects: najwyżej 200 przedmiotów na konto (bezpiecznik przed nadużyciem, NIE limit planu free = 5 — to decyzja produktowa).
--   topics: najwyżej 50 nowych na konto w kroczącej dobie (serwer robi najwyżej 20 generacji na dobę) i content < 1 MB.

-- 0) Darmowe generacje na zawsze (0007, sekcja 2d): drugie, idempotentne doliczenie historii — łapie generacje kont free,
--    które stary backend zrobił między wgraniem 0007 a wdrożeniem Build 7 (stary backend nie pisze free_generation_ledger).
--    Wymaga 0007. Zwraca liczbę dopisanych wierszy (zwykle 0). Wierszy unieważnionych (reset_free_generations) nie odtwarza.
--    Start wszystkich kont od zera = usunąć to wywołanie I ostatnią linię sekcji 2d w 0007.
select public.backfill_free_generation_ledger();

-- 1) topics.content < 1 MB (serwer zapisuje ok. 5–10 kB na poziom, maks. 6 poziomów). NOT VALID: stare wiersze nie są
--    sprawdzane, nowe i zmieniane — tak. Po sprawdzeniu maksimum na produkcji można zrobić VALIDATE (docs/DEPLOY.md).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'topics_content_size' and conrelid = 'public.topics'::regclass) then
    alter table public.topics add constraint topics_content_size check (pg_column_size(content) < 1000000) not valid;
  end if;
end $$;

-- 2) Limity wierszy na właściciela: jeden trigger BEFORE INSERT na subjects, materials i topics. Blokada doradcza na
--    (tabela, właściciel), więc równoległe INSERT-y nie przeskoczą progu. Błąd 23514 (check_violation) → PostgREST 400.
create or replace function public.enforce_owner_caps() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
  if new.owner_id is null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('cramfox:owner-cap:' || tg_table_name), hashtext(new.owner_id::text));
  if tg_table_name = 'subjects' then
    select count(*) into n from public.subjects s where s.owner_id = new.owner_id;
    if n >= 200 then
      raise exception 'subject_limit' using errcode = '23514', detail = 'Najwyżej 200 przedmiotów na konto.';
    end if;
  elsif tg_table_name = 'materials' then
    select count(*) into n from public.materials m where m.owner_id = new.owner_id and m.created_at > now() - interval '24 hours';
    if n >= 100 then
      raise exception 'materials_daily_limit' using errcode = '23514', detail = 'Najwyżej 100 nowych materiałów na dobę.';
    end if;
  elsif tg_table_name = 'topics' then
    select count(*) into n from public.topics t where t.owner_id = new.owner_id and t.created_at > now() - interval '24 hours';
    if n >= 50 then
      raise exception 'topics_daily_limit' using errcode = '23514', detail = 'Najwyżej 50 nowych tematów na dobę.';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.enforce_owner_caps() from public, anon, authenticated;

drop trigger if exists cap_owner_rows on public.subjects;
create trigger cap_owner_rows before insert on public.subjects for each row execute function public.enforce_owner_caps();
drop trigger if exists cap_owner_rows on public.materials;
create trigger cap_owner_rows before insert on public.materials for each row execute function public.enforce_owner_caps();
drop trigger if exists cap_owner_rows on public.topics;
create trigger cap_owner_rows before insert on public.topics for each row execute function public.enforce_owner_caps();

-- 3) Kolumny kosztu i jakości z 0007 (cost_usd, quality, opus_*, review_*) oraz model i tokeny — tylko dla serwera.
--    Polityka „generations read own” (0001) pokazuje właścicielowi jego wiersze w całości; widok dziennego kosztu jest
--    ukryty, a bez tego klient czytałby to samo wprost z tabeli. Klienci wybierają zawsze konkretne kolumny (Cramfox
--    build 6 i 7: id, status, topic_id, error, created_at, filtry subject_id, material_ids; GET /api/generate: status,
--    topic_id, error), więc dostają je dalej. select=* z kluczem użytkownika przestaje działać (nikt go nie używa).
revoke select on public.generations from anon, authenticated;
grant select (id, owner_id, status, stage, hint, options, material_ids, subject_id, topic_id, error, created_at, finished_at)
  on public.generations to authenticated;

-- 4) Storage: polityka RESTRICTIVE (zwykła PERMISSIVE sumowałaby się z "materials storage own" FOR ALL i niczego by nie
--    ograniczała). Liczenie przez funkcję security definer, bo użytkownik nie musi widzieć metadanych wszystkich obiektów.
--    Rozmiar nowego pliku nie jest jeszcze znany przy sprawdzaniu uprawnień — limit 50 MB na plik (0005) ogranicza nadmiar.
--    Funkcja czyta storage.objects jako jej właściciel (w Supabase: postgres, nie superuser) — potrzebuje prawa SELECT
--    na storage.objects; RLS jej nie przeszkadza, bo liczy tylko folder wywołującego, a „materials storage own” obejmuje
--    wszystkie role. Sprawdzenie po wgraniu: docs/DEPLOY.md.
create or replace function public.materials_upload_allowed() returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_n bigint;
  v_bytes bigint;
begin
  if v_uid is null then return false; end if;
  select count(*),
         coalesce(sum(case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 0 end), 0)
    into v_n, v_bytes
    from storage.objects o
   where o.bucket_id = 'materials'
     and o.name like v_uid::text || '/%'
     and o.created_at > now() - interval '24 hours';
  return v_n < 100 and v_bytes < 500::bigint * 1024 * 1024;
end $$;
revoke all on function public.materials_upload_allowed() from public;
-- polityka wywołuje funkcję w imieniu roli żądania
grant execute on function public.materials_upload_allowed() to anon, authenticated, service_role;

drop policy if exists "materials upload daily cap" on storage.objects;
create policy "materials upload daily cap" on storage.objects as restrictive for insert
  with check (bucket_id <> 'materials' or public.materials_upload_allowed());
