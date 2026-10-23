-- Cramfox — migracja 0010: rolki, podcast „Lis i Szop” i rozmowa z lisem (plan: docs/plan-media.md §3).
--
-- Co dodaje:
--   - tabelę public.media (seria rolek albo podcast jednego materiału: stan pracy, manifest plików, błąd, koszt) —
--     właściciel tylko CZYTA wybrane kolumny, pisze wyłącznie serwer (service role);
--   - osobną pulę tworzeń rolek i podcastu (NIGDY nie zużywa 2 darmowych tworzeń lekcji): free — app_config
--     free_media_lifetime (3) na całe życie konta, pro — pro_media_month (30) w miesiącu UTC; do tego bezpieczniki:
--     5 tworzeń na konto w kroczącej dobie (liczą się też nieudane i zwrócone), 60 na cały serwer w kroczącej dobie
--     (bez zwróconych) i 150 prób na cały serwer (ze zwróconymi), jedno tworzenie naraz na konto (busy, 5,5 min) —
--     wszystko liczone z media_ledger, który przeżywa usunięcie materiału, przedmiotu i konta; darmowa pula liczona
--     po skrócie adresu e-mail (jak free_generation_ledger z 0007: usunięcie konta i ponowna rejestracja jej nie zeruje);
--   - zwrot tworzenia przy porażce po naszej stronie (release_media, jak release_generation z 0009) i porażkę bez
--     zwrotu (fail_media — tylko odmowa AI);
--   - licznik wiadomości do lisa na dzień (doba = data w strefie Europe/Warsaw): free_chat_daily (30), pro_chat_daily
--     (200), chat_global_daily_cap (5000) — reserve_chat / release_chat / chat_quota;
--   - globalny budżet znaków syntezy mowy na kroczącą dobę (tts_global_daily_chars, 600 000) — tts_budget;
--   - nagrywanie rozdziałów podcastu na żądanie (claim_podcast_chapter / set_podcast_chapter / release_podcast_chapter;
--     rozdział, którego nagranie 3 razy w dobie się nie udało, czeka do jutra — „failing”; tts_refund oddaje budżetowi
--     znaki, których nie nagrano);
--   - sprzątacz (pg_cron co 5 min): tworzenie bez końca starsze niż 8 min → zwrot; rozdział „nagrywany” > 5 min → wraca;
--   - prywatny bucket Storage `media` ({uid}/{mediaId}/{plik}): właściciel czyta i usuwa swoje pliki, wgrywa tylko serwer;
--     delete_my_account (z 0004) sprawdza teraz także ten bucket.
--
-- KOLEJNOŚĆ WGRYWANIA:
--   0010 (ten plik) → wdrożenie backendu (trasy /api/media/*, /api/fox, pola media / chat / features w /api/me)
--   → build apki z centrum przedmiotu. Wymaga 0007 (app_config, app_config_int, touch_updated_at z 0001).
--   Backend bez 0010: /api/me ma media = chat = null i features wyłączone (apka ukrywa tworzenie), trasy mediów
--   odpowiadają 503 media_unavailable. 0010 bez nowego backendu: nic się nie zmienia (nowe obiekty nieużywane).
-- Idempotentna: można wgrać ponownie (wartości w app_config, które właściciel zmienił, zostają).
-- Wgranie: supabase db query --linked -f backend/0010_media.sql
-- Sekcja Storage (bucket i polityki na storage.objects) jest celowo OSTATNIA. Gdy CLI odmówi polityk na
-- storage.objects (tabela należy do supabase_storage_admin, BIBLIA 7.8 #15), wklej CAŁY plik w SQL Editor — jest
-- idempotentny — i sprawdź wszystkie sekcje.
--
-- Konfiguracja bez migracji (SQL Editor jako właściciel), działa od następnego wywołania:
--   update public.app_config set value = '5' where key = 'free_media_lifetime';
--   0 w media_global_daily_cap wstrzymuje tworzenie rolek i podcastów; 0 w chat_global_daily_cap — rozmowy z lisem.

-- 0) Wartości domyślne (on conflict do nothing: nie nadpisuje zmian właściciela).
insert into public.app_config (key, value, note) values
  ('free_media_lifetime', '3'::jsonb, 'Plan free: tyle tworzeń rolek / podcastu na całe życie konta (osobna pula, nie liczy się do lekcji).'),
  ('pro_media_month', '30'::jsonb, 'Plan pro: tyle tworzeń rolek / podcastu w miesiącu kalendarzowym (UTC).'),
  ('media_daily_per_user', '5'::jsonb, 'Bezpiecznik: najwyżej tyle tworzeń rolek / podcastu na konto w kroczącej dobie (liczą się też nieudane i zwrócone).'),
  ('media_global_daily_cap', '60'::jsonb, 'Najwyżej tyle tworzeń rolek / podcastu na cały serwer w kroczącej dobie (bez zwróconych). 0 = wstrzymane.'),
  ('media_global_daily_attempts', '150'::jsonb, 'Najwyżej tyle PRÓB tworzenia rolek / podcastu na cały serwer w kroczącej dobie (także zwróconych: koszt AI i lektora już poniesiony). 0 = wstrzymane.'),
  ('free_chat_daily', '30'::jsonb, 'Plan free: tyle wiadomości do lisa dziennie (doba w Europe/Warsaw).'),
  ('pro_chat_daily', '200'::jsonb, 'Plan pro: tyle wiadomości do lisa dziennie (doba w Europe/Warsaw).'),
  ('chat_global_daily_cap', '5000'::jsonb, 'Najwyżej tyle wiadomości do lisa dziennie na cały serwer. 0 = rozmowy wstrzymane.'),
  ('tts_global_daily_chars', '600000'::jsonb, 'Budżet znaków syntezy mowy (ElevenLabs) na cały serwer w kroczącej dobie.')
on conflict (key) do nothing;

-- 1) Tabela media. id = requestId klienta (klucz idempotencji). Kolumny klienta: patrz grant niżej (MEDIA_COLUMNS w
--    @nauka/shared). spec: o co poproszono ({types, focusPointId} dla rolek); progress: {step, done, total};
--    manifest: ReelsManifest / PodcastManifest (pliki w Storage), error: „<kod>:<szczegół>” albo „released:…” (zwrot).
create table if not exists public.media (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  kind text not null constraint media_kind check (kind in ('reels', 'podcast')),
  status text not null default 'running' constraint media_status check (status in ('running', 'ready', 'failed')),
  phase text,
  progress jsonb,
  title text,
  spec jsonb not null default '{}'::jsonb,
  manifest jsonb,
  error text,
  charged boolean not null default true,
  refunded_at timestamptz,
  model text,
  cost_usd numeric(8,4),
  tts_chars int not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint media_manifest_size check (manifest is null or pg_column_size(manifest) < 200000)
);
create index if not exists media_owner_created on public.media (owner_id, created_at);
create index if not exists media_topic on public.media (topic_id);
create index if not exists media_running on public.media (created_at) where status = 'running';
drop trigger if exists touch_media on public.media;
create trigger touch_media before update on public.media for each row execute procedure public.touch_updated_at();

alter table public.media enable row level security;
drop policy if exists "media own read" on public.media;
create policy "media own read" on public.media for select using (owner_id = auth.uid());
-- bez polityk insert / update / delete: pisze tylko serwer. Klient dostaje tylko kolumny potrzebne apce (bez kosztu,
-- modelu i znaków). select=* z kluczem użytkownika nie działa (celowo, jak generations od 0008).
revoke all on public.media from public, anon, authenticated;
grant select (id, owner_id, subject_id, topic_id, kind, status, phase, progress, title, spec, manifest, error, charged, created_at, finished_at)
  on public.media to authenticated;
grant select, insert, update, delete on public.media to service_role;

-- 2) Licznik tworzeń (pula rolek i podcastu). Jeden wiersz na rezerwację, bez klucza obcego do media: przeżywa usunięcie
--    wiersza media (kaskada z materiału / przedmiotu) i konta (user_id → null). Z niego liczone są: busy (finished_at is
--    null), dobowy bezpiecznik konta, pula planu i limity globalne — usunięcie materiału w trakcie pracy niczego nie zeruje.
--    email_hash: skrót adresu e-mail konta (public.account_email_hash z 0007) — darmowa pula na całe życie liczy wiersze
--    z tym skrótem ALBO z user_id (jak free_generations_used), więc „Usuń konto” + ponowna rejestracja jej nie odnawia.
--    scope: lifetime (free) / month (pro). finished_at: praca skończona (gotowe, porażka albo zwrot).
--    voided_at + refunded_at = tworzenie zwrócone (porażka po naszej stronie).
create table if not exists public.media_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  media_id uuid unique,
  kind text,
  scope text constraint media_ledger_scope check (scope in ('lifetime', 'month')),
  month text,
  email_hash text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  voided_at timestamptz,
  refunded_at timestamptz
);
alter table public.media_ledger add column if not exists email_hash text;
alter table public.media_ledger add column if not exists finished_at timestamptz;
create index if not exists media_ledger_user on public.media_ledger (user_id) where user_id is not null;
create index if not exists media_ledger_email on public.media_ledger (email_hash) where email_hash is not null;
create index if not exists media_ledger_created on public.media_ledger (created_at);
create index if not exists media_ledger_open on public.media_ledger (created_at) where finished_at is null;
-- wiersze sprzed tych kolumn (gdyby wcześniejsza wersja 0010 była już wgrana): skrót adresu i koniec pracy z media
update public.media_ledger l set email_hash = public.account_email_hash(l.user_id) where l.email_hash is null and l.user_id is not null;
update public.media_ledger l set finished_at = coalesce(m.finished_at, now())
  from public.media m where m.id = l.media_id and l.finished_at is null and m.status <> 'running';
alter table public.media_ledger enable row level security;
revoke all on public.media_ledger from public, anon, authenticated;
grant select on public.media_ledger to service_role;

-- 3) Wiadomości do lisa na dzień (Europe/Warsaw).
create table if not exists public.fox_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  messages int not null default 0,
  primary key (user_id, day)
);
create index if not exists fox_usage_day on public.fox_usage (day);
alter table public.fox_usage enable row level security;
revoke all on public.fox_usage from public, anon, authenticated;
grant select on public.fox_usage to service_role;

-- 4) Znaki syntezy mowy (budżet globalny, krocząca doba). Bez klucza obcego: przeżywa usunięcie konta.
create table if not exists public.tts_ledger (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  chars int not null,
  media_id uuid,
  kind text constraint tts_ledger_kind check (kind in ('reel', 'chapter'))
);
create index if not exists tts_ledger_created on public.tts_ledger (created_at);
alter table public.tts_ledger enable row level security;
revoke all on public.tts_ledger from public, anon, authenticated;
grant select on public.tts_ledger to service_role;

-- wiersz media jako jsonb w kształcie klienta (te same kolumny co grant wyżej)
create or replace function public.media_row(m public.media) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'owner_id', m.owner_id, 'subject_id', m.subject_id, 'topic_id', m.topic_id, 'kind', m.kind,
    'status', m.status, 'phase', m.phase, 'progress', m.progress, 'title', m.title, 'spec', m.spec, 'manifest', m.manifest,
    'error', m.error, 'charged', m.charged, 'created_at', m.created_at, 'finished_at', m.finished_at)
$$;
revoke all on function public.media_row(public.media) from public, anon, authenticated;

-- tworzenia na serwerze w kroczącej dobie: większa z liczb — wiersze media (bez zwróconych) albo media_ledger (bez
-- zwróconych; przeżywa usunięcie materiałów i kont)
create or replace function public.media_last_day() returns bigint
language sql stable security definer set search_path = '' as $$
  select greatest((select count(*) from public.media m where m.created_at > now() - interval '1 day' and m.refunded_at is null),
                  (select count(*) from public.media_ledger l where l.created_at > now() - interval '1 day' and l.refunded_at is null))
$$;
revoke all on function public.media_last_day() from public, anon, authenticated;

-- PRÓBY na serwerze w kroczącej dobie, także zwrócone (koszt AI / lektora już poniesiony; limit media_global_daily_attempts)
create or replace function public.media_attempts_last_day() returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from public.media_ledger l where l.created_at > now() - interval '1 day'
$$;
revoke all on function public.media_attempts_last_day() from public, anon, authenticated;

-- busy konta: najnowsza rezerwacja bez końca pracy, młodsza niż 330 s (z media_ledger — usunięcie materiału w trakcie
-- pracy jej nie kończy). topicId z wiersza media, gdy jeszcze istnieje.
create or replace function public.media_busy(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', l.media_id, 'kind', l.kind, 'topicId', m.topic_id)
    from public.media_ledger l left join public.media m on m.id = l.media_id
   where l.user_id = p_user and l.finished_at is null and l.created_at > now() - interval '330 seconds'
   order by l.created_at desc limit 1
$$;
revoke all on function public.media_busy(uuid) from public, anon, authenticated;

-- zużycie darmowej puli na całe życie: wiersze z adresem konta albo z kontem (bez unieważnionych)
create or replace function public.media_free_used(p_user uuid, p_email_hash text) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.media_ledger l
   where l.scope = 'lifetime' and l.voided_at is null and (l.email_hash = p_email_hash or l.user_id = p_user)
$$;
revoke all on function public.media_free_used(uuid, text) from public, anon, authenticated;

-- 5) Rezerwacja tworzenia w JEDNEJ transakcji. Blokady doradcze: konto, (free) adres e-mail, potem serwer (ta sama
--    kolejność wszędzie). Kolejność: istniejący p_id (idempotencja: ten sam użytkownik → {ok, existing, media}; inny →
--    conflict) → temat i przedmiot należą do konta (not_found) → busy (media_busy: rezerwacja bez końca pracy < 5,5 min)
--    → dobowy bezpiecznik konta (wiersze media_ledger konta z doby, także nieudane i zwrócone; przeżywają usunięcie
--    materiału) → limit planu (free: media_free_used — po skrócie adresu e-mail albo koncie, bez unieważnionych; pro:
--    wiersze z p_month) → limity globalne (tworzenia bez zwróconych; próby ze zwróconymi). Wszystko PRZED zapisem;
--    odmowa niczego nie zmienia. Potem wiersz media (running, phase plan) + wiersz media_ledger (ze skrótem adresu).
--    Odpowiedź {ok:true, media, scope, used, limit} albo {ok:false, reason, …}.
--    p_pro_limit: limit pro z kodu (gdy brak pro_media_month w app_config). Tylko service role.
create or replace function public.reserve_media(
  p_id uuid, p_user uuid, p_subject uuid, p_topic uuid, p_kind text, p_spec jsonb, p_month text, p_pro_limit int
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_existing public.media%rowtype;
  v_busy jsonb;
  v_plan text;
  v_scope text;
  v_hash text;
  v_used int;
  v_limit int;
  v_row public.media%rowtype;
  v_progress jsonb;
begin
  if p_id is null or p_user is null or p_subject is null or p_topic is null or p_month is null or p_kind not in ('reels', 'podcast') then
    raise exception 'reserve_media: missing arguments';
  end if;
  perform pg_advisory_xact_lock(hashtext('cramfox:media:user'), hashtext(p_user::text));
  select p.plan::text into v_plan from public.profiles p where p.id = p_user;
  v_plan := case when coalesce(v_plan, 'free') = 'pro' then 'pro' else 'free' end;
  v_hash := public.account_email_hash(p_user);
  if v_plan = 'free' then
    -- dwa żywe konta z tym samym adresem po normalizacji nie przejdą razem (jak reserve_generation z 0007)
    perform pg_advisory_xact_lock(hashtext('cramfox:media:email'), hashtext(v_hash));
  end if;
  perform pg_advisory_xact_lock(hashtext('cramfox:media:global'), 0);

  select * into v_existing from public.media m where m.id = p_id;
  if found then
    if v_existing.owner_id = p_user then
      return jsonb_build_object('ok', true, 'existing', true, 'media', public.media_row(v_existing));
    end if;
    return jsonb_build_object('ok', false, 'reason', 'conflict');
  end if;
  if exists (select 1 from public.media_ledger l where l.media_id = p_id) then
    -- rezerwacja z tym id była, ale jej wiersz media zniknął (usunięty materiał): nie tworzymy drugiej
    return jsonb_build_object('ok', false, 'reason', 'conflict');
  end if;
  if not exists (select 1 from public.topics t join public.subjects s on s.id = t.subject_id
                  where t.id = p_topic and t.subject_id = p_subject and t.owner_id = p_user and s.owner_id = p_user) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_busy := public.media_busy(p_user);
  if v_busy is not null then
    return jsonb_build_object('ok', false, 'reason', 'busy', 'busy', v_busy);
  end if;
  v_limit := public.app_config_int('media_daily_per_user', 5);
  if (select count(*) from public.media_ledger l where l.user_id = p_user and l.created_at > now() - interval '1 day') >= v_limit then
    return jsonb_build_object('ok', false, 'reason', 'daily', 'limit', v_limit);
  end if;

  if v_plan = 'pro' then
    v_scope := 'month';
    v_limit := public.app_config_int('pro_media_month', greatest(coalesce(p_pro_limit, 0), 0));
    select count(*)::int into v_used from public.media_ledger l
     where l.user_id = p_user and l.scope = 'month' and l.month = p_month and l.voided_at is null;
  else
    v_scope := 'lifetime';
    v_limit := public.app_config_int('free_media_lifetime', 3);
    v_used := public.media_free_used(p_user, v_hash);
  end if;
  if v_used >= v_limit then
    return jsonb_build_object('ok', false, 'reason', case when v_scope = 'month' then 'month' else 'lifetime' end, 'used', v_used, 'limit', v_limit);
  end if;
  if public.media_last_day() >= public.app_config_int('media_global_daily_cap', 60)
     or public.media_attempts_last_day() >= public.app_config_int('media_global_daily_attempts', 150) then
    return jsonb_build_object('ok', false, 'reason', 'global');
  end if;

  v_progress := coalesce(p_spec->'progress', jsonb_build_object('step', 'plan', 'done', 0, 'total', 0));
  insert into public.media (id, owner_id, subject_id, topic_id, kind, status, phase, progress, spec)
  values (p_id, p_user, p_subject, p_topic, p_kind, 'running', 'plan', v_progress, coalesce(p_spec, '{}'::jsonb) - 'progress')
  returning * into v_row;
  insert into public.media_ledger (user_id, media_id, kind, scope, month, email_hash) values (p_user, p_id, p_kind, v_scope, p_month, v_hash);
  return jsonb_build_object('ok', true, 'media', public.media_row(v_row), 'plan', v_plan, 'scope', v_scope, 'used', v_used + 1, 'limit', v_limit);
end $$;
revoke all on function public.reserve_media(uuid, uuid, uuid, uuid, text, jsonb, text, int) from public, anon, authenticated;
grant execute on function public.reserve_media(uuid, uuid, uuid, uuid, text, jsonb, text, int) to service_role;

-- 6) Koniec pracy: running → ready z manifestem i kosztem (+ znaki syntezy do tts_ledger, gdy były), wiersz media_ledger
--    dostaje finished_at. Wiersz już nie running (zamknięty przez sprzątacz) → {ok:false, reason:'not_running'} i nic się
--    nie zmienia; wiersza nie ma (materiał usunięty w trakcie pracy) → {ok:false, reason:'not_found'} — serwer woła wtedy
--    release_media, który zwraca tworzenie po media_ledger.
--    p_stats: {model, cost_usd, tts_chars, tts_logged} — tts_logged: znaki już zapisane w tts_ledger przez tts_budget
--    (rolki sprawdzają budżet przed każdym nagraniem), do tts_ledger trafia tylko reszta.
create or replace function public.media_tts_rest(p_stats jsonb) returns int
language sql immutable set search_path = '' as $$
  select greatest(greatest(coalesce((p_stats->>'tts_chars')::int, 0), 0) - greatest(coalesce((p_stats->>'tts_logged')::int, 0), 0), 0)
$$;
revoke all on function public.media_tts_rest(jsonb) from public, anon, authenticated;

create or replace function public.finish_media(p_id uuid, p_manifest jsonb, p_stats jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.media%rowtype;
  v_chars int := greatest(coalesce((p_stats->>'tts_chars')::int, 0), 0);
  v_rest int := public.media_tts_rest(p_stats);
begin
  if p_id is null or p_manifest is null then raise exception 'finish_media: missing arguments'; end if;
  select * into m from public.media x where x.id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if m.status <> 'running' then return jsonb_build_object('ok', false, 'reason', 'not_running', 'status', m.status); end if;
  update public.media x set
    status = 'ready',
    phase = 'done',
    manifest = p_manifest,
    title = left(nullif(p_manifest->>'title', ''), 200),
    error = null,
    finished_at = now(),
    model = left(p_stats->>'model', 80),
    cost_usd = least(coalesce((p_stats->>'cost_usd')::numeric, 0), 9999.9999)::numeric(8,4),
    tts_chars = x.tts_chars + v_chars
  where x.id = p_id;
  update public.media_ledger l set finished_at = coalesce(l.finished_at, now()) where l.media_id = p_id;
  if v_rest > 0 then
    insert into public.tts_ledger (chars, media_id, kind) values (v_rest, p_id, case when m.kind = 'reels' then 'reel' else 'chapter' end);
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.finish_media(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.finish_media(uuid, jsonb, jsonb) to service_role;

-- 7) Zwrot tworzenia (porażka po naszej stronie: AI / lektor niedostępne, zła odpowiedź AI po jednej poprawce, termin,
--    Storage, budżet lektora) w JEDNEJ transakcji, pod blokadą konta: media → failed, charged=false, refunded_at, error
--    „released:<powód>” (+ koszt i znaki, gdy podane); wiersz media_ledger unieważniony, oznaczony zwrotem i końcem pracy.
--    Odmawia `ready` ({ok:false, reason:'done'}); idempotentny ({ok:true, already:true}). Dobowy bezpiecznik konta i
--    limit prób dalej liczą próbę.
--    Wiersza media nie ma (materiał / przedmiot usunięty w trakcie pracy — kaskada): zwrot po samym media_ledger, ale
--    tylko gdy praca się nie skończyła (finished_at is null; gotowe media usunięte później nie wracają do puli) →
--    {ok:true, orphan:true}; nie ma też wiersza w media_ledger → {ok:false, reason:'not_found'}.
create or replace function public.release_media(p_id uuid, p_reason text, p_stats jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  m public.media%rowtype;
  l public.media_ledger%rowtype;
  v_reason text := left(btrim(coalesce(p_reason, ''), E' \t\r\n'), 200);
  v_chars int := greatest(coalesce((p_stats->>'tts_chars')::int, 0), 0);
  v_rest int := public.media_tts_rest(p_stats);
  v_ledger int := 0;
begin
  if p_id is null or v_reason = '' then raise exception 'release_media: missing arguments'; end if;
  select x.owner_id into v_owner from public.media x where x.id = p_id;
  if not found then
    select * into l from public.media_ledger x where x.media_id = p_id;
    if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
    if l.user_id is not null then perform pg_advisory_xact_lock(hashtext('cramfox:media:user'), hashtext(l.user_id::text)); end if;
    select * into l from public.media_ledger x where x.media_id = p_id for update;
    if l.refunded_at is not null then return jsonb_build_object('ok', true, 'already', true, 'media_id', p_id, 'orphan', true); end if;
    if l.finished_at is not null then return jsonb_build_object('ok', false, 'reason', 'done'); end if;
    update public.media_ledger x set voided_at = coalesce(x.voided_at, now()), refunded_at = now(), finished_at = now() where x.id = l.id;
    if v_rest > 0 then
      insert into public.tts_ledger (chars, media_id, kind) values (v_rest, p_id, case when l.kind = 'reels' then 'reel' else 'chapter' end);
    end if;
    return jsonb_build_object('ok', true, 'media_id', p_id, 'ledger', 1, 'orphan', true);
  end if;
  perform pg_advisory_xact_lock(hashtext('cramfox:media:user'), hashtext(v_owner::text));
  select * into m from public.media x where x.id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if m.refunded_at is not null then return jsonb_build_object('ok', true, 'already', true, 'media_id', m.id); end if;
  if m.status = 'ready' then return jsonb_build_object('ok', false, 'reason', 'done'); end if;
  update public.media x set
    status = 'failed',
    phase = 'failed',
    charged = false,
    refunded_at = now(),
    finished_at = coalesce(x.finished_at, now()),
    error = left('released:' || v_reason, 240),
    model = coalesce(left(p_stats->>'model', 80), x.model),
    cost_usd = case when p_stats->>'cost_usd' is not null then least((p_stats->>'cost_usd')::numeric, 9999.9999)::numeric(8,4) else x.cost_usd end,
    tts_chars = x.tts_chars + v_chars
  where x.id = m.id;
  update public.media_ledger x set voided_at = coalesce(x.voided_at, now()), refunded_at = now(), finished_at = coalesce(x.finished_at, now())
   where x.media_id = m.id and x.refunded_at is null;
  get diagnostics v_ledger = row_count;
  if v_rest > 0 then
    insert into public.tts_ledger (chars, media_id, kind) values (v_rest, m.id, case when m.kind = 'reels' then 'reel' else 'chapter' end);
  end if;
  return jsonb_build_object('ok', true, 'media_id', m.id, 'ledger', v_ledger);
end $$;
revoke all on function public.release_media(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.release_media(uuid, text, jsonb) to service_role;

-- 8) Porażka BEZ zwrotu (odmowa AI): running → failed, charged zostaje true; media_ledger dostaje finished_at.
--    Wiersza media nie ma (materiał usunięty) → koniec pracy tylko w media_ledger, {ok:true, orphan:true}.
create or replace function public.fail_media(p_id uuid, p_reason text, p_stats jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.media%rowtype;
  v_chars int := greatest(coalesce((p_stats->>'tts_chars')::int, 0), 0);
  v_rest int := public.media_tts_rest(p_stats);
  v_n int := 0;
begin
  if p_id is null then raise exception 'fail_media: missing arguments'; end if;
  select * into m from public.media x where x.id = p_id for update;
  if not found then
    update public.media_ledger x set finished_at = now() where x.media_id = p_id and x.finished_at is null;
    get diagnostics v_n = row_count;
    if v_n > 0 and v_rest > 0 then
      insert into public.tts_ledger (chars, media_id, kind)
      select v_rest, p_id, case when x.kind = 'reels' then 'reel' else 'chapter' end from public.media_ledger x where x.media_id = p_id;
    end if;
    return case when v_n > 0 then jsonb_build_object('ok', true, 'orphan', true) else jsonb_build_object('ok', false, 'reason', 'not_found') end;
  end if;
  if m.status <> 'running' then return jsonb_build_object('ok', false, 'reason', 'not_running', 'status', m.status); end if;
  update public.media x set
    status = 'failed',
    phase = 'failed',
    finished_at = now(),
    error = left(coalesce(nullif(btrim(p_reason), ''), 'failed'), 240),
    model = coalesce(left(p_stats->>'model', 80), x.model),
    cost_usd = case when p_stats->>'cost_usd' is not null then least((p_stats->>'cost_usd')::numeric, 9999.9999)::numeric(8,4) else x.cost_usd end,
    tts_chars = x.tts_chars + v_chars
  where x.id = m.id;
  update public.media_ledger x set finished_at = coalesce(x.finished_at, now()) where x.media_id = m.id;
  if v_rest > 0 then
    insert into public.tts_ledger (chars, media_id, kind) values (v_rest, m.id, case when m.kind = 'reels' then 'reel' else 'chapter' end);
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.fail_media(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.fail_media(uuid, text, jsonb) to service_role;

-- 9) Stan puli (tylko odczyt) dla GET /api/me — ta sama logika co reserve_media:
--    {plan, scope, used, limit, remaining, dailyLeft, globalOpen, busy}.
create or replace function public.media_quota(p_user uuid, p_month text, p_pro_limit int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_plan text;
  v_scope text;
  v_used int;
  v_limit int;
  v_daily int;
begin
  if p_user is null or p_month is null then raise exception 'media_quota: missing arguments'; end if;
  select p.plan::text into v_plan from public.profiles p where p.id = p_user;
  if coalesce(v_plan, 'free') = 'pro' then
    v_plan := 'pro';
    v_scope := 'month';
    v_limit := public.app_config_int('pro_media_month', greatest(coalesce(p_pro_limit, 0), 0));
    select count(*)::int into v_used from public.media_ledger l
     where l.user_id = p_user and l.scope = 'month' and l.month = p_month and l.voided_at is null;
  else
    v_plan := 'free';
    v_scope := 'lifetime';
    v_limit := public.app_config_int('free_media_lifetime', 3);
    v_used := public.media_free_used(p_user, public.account_email_hash(p_user));
  end if;
  select count(*)::int into v_daily from public.media_ledger l where l.user_id = p_user and l.created_at > now() - interval '1 day';
  return jsonb_build_object('plan', v_plan, 'scope', v_scope, 'used', v_used, 'limit', v_limit,
    'remaining', greatest(v_limit - v_used, 0),
    'dailyLeft', greatest(public.app_config_int('media_daily_per_user', 5) - v_daily, 0),
    'globalOpen', public.media_last_day() < public.app_config_int('media_global_daily_cap', 60)
                  and public.media_attempts_last_day() < public.app_config_int('media_global_daily_attempts', 150),
    'busy', public.media_busy(p_user));
end $$;
revoke all on function public.media_quota(uuid, text, int) from public, anon, authenticated;
grant execute on function public.media_quota(uuid, text, int) to service_role;

-- 10) Rozdziały podcastu nagrywane na żądanie. Rozdział n = manifest->'chapters'->(n-1) (numeracja 1..N bez dziur).
--     claim: blokada wiersza; not_found (właściciel, rodzaj, zakres) / not_ready (podcast nie gotowy) / ready (rozdział
--     już nagrany) / busy (nagrywa go inne żądanie od < 3 min) / failing (3 nieudane nagrania tego rozdziału w tej
--     dobie UTC — każde kosztuje znaki lektora; jutro znowu) / claimed (status 'synth', synthAt = teraz).
create or replace function public.claim_podcast_chapter(p_media uuid, p_user uuid, p_n int) returns text
language plpgsql security definer set search_path = '' as $$
declare
  m public.media%rowtype;
  c jsonb;
begin
  select * into m from public.media x where x.id = p_media for update;
  if not found or m.owner_id is distinct from p_user or m.kind <> 'podcast' then return 'not_found'; end if;
  if m.status <> 'ready' or m.manifest is null then return 'not_ready'; end if;
  if p_n is null or p_n < 1 or p_n > coalesce(jsonb_array_length(m.manifest->'chapters'), 0) then return 'not_found'; end if;
  c := m.manifest->'chapters'->(p_n - 1);
  if coalesce((c->>'n')::int, -1) <> p_n then return 'not_found'; end if;
  if c->>'status' = 'ready' then return 'ready'; end if;
  if c->>'status' = 'synth' and (c->>'synthAt')::timestamptz > now() - interval '3 minutes' then return 'busy'; end if;
  if c->>'failDay' = to_char(now() at time zone 'UTC', 'YYYY-MM-DD') and coalesce((c->>'fails')::int, 0) >= 3 then return 'failing'; end if;
  update public.media x
     set manifest = jsonb_set(x.manifest, array['chapters', (p_n - 1)::text], c || jsonb_build_object('status', 'synth', 'synthAt', now()))
   where x.id = p_media;
  return 'claimed';
end $$;
revoke all on function public.claim_podcast_chapter(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.claim_podcast_chapter(uuid, uuid, int) to service_role;

-- set: scala p_patch z rozdziałem (status 'ready' usuwa synthAt i licznik porażek); zwraca rozdział po zmianie albo null.
create or replace function public.set_podcast_chapter(p_media uuid, p_n int, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.media%rowtype;
  c jsonb;
begin
  select * into m from public.media x where x.id = p_media for update;
  if not found or m.kind <> 'podcast' or m.manifest is null or p_n is null or p_n < 1
     or p_n > coalesce(jsonb_array_length(m.manifest->'chapters'), 0) then
    return null;
  end if;
  c := (m.manifest->'chapters'->(p_n - 1)) || coalesce(p_patch, '{}'::jsonb);
  if c->>'status' = 'ready' then c := c - 'synthAt' - 'fails' - 'failDay'; end if;
  update public.media x set manifest = jsonb_set(x.manifest, array['chapters', (p_n - 1)::text], c) where x.id = p_media;
  return c;
end $$;
revoke all on function public.set_podcast_chapter(uuid, int, jsonb) from public, anon, authenticated;
grant execute on function public.set_podcast_chapter(uuid, int, jsonb) to service_role;

-- release: rozdział wraca do 'script' (tylko z 'synth'). p_failed: nagranie się nie udało → +1 do licznika porażek
-- w dobie UTC (fails / failDay; claim odmawia po 3). Odmowa budżetu (429) to nie porażka (p_failed false).
drop function if exists public.release_podcast_chapter(uuid, int);
create or replace function public.release_podcast_chapter(p_media uuid, p_n int, p_failed boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.media%rowtype;
  c jsonb;
  v_day text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
begin
  select * into m from public.media x where x.id = p_media for update;
  if not found or m.manifest is null or p_n is null or p_n < 1 or p_n > coalesce(jsonb_array_length(m.manifest->'chapters'), 0) then return; end if;
  c := m.manifest->'chapters'->(p_n - 1);
  if c->>'status' <> 'synth' then return; end if;
  c := (c - 'synthAt') || '{"status":"script"}'::jsonb;
  if coalesce(p_failed, false) then
    c := c || jsonb_build_object('failDay', v_day,
      'fails', case when c->>'failDay' = v_day then coalesce((c->>'fails')::int, 0) + 1 else 1 end);
  end if;
  update public.media x set manifest = jsonb_set(x.manifest, array['chapters', (p_n - 1)::text], c) where x.id = p_media;
end $$;
revoke all on function public.release_podcast_chapter(uuid, int, boolean) from public, anon, authenticated;
grant execute on function public.release_podcast_chapter(uuid, int, boolean) to service_role;

-- 11) Budżet znaków syntezy mowy na cały serwer (krocząca doba, app_config tts_global_daily_chars). Pod blokadą
--     globalną: mieści się → zapis w tts_ledger i true; nie → false (nic nie zapisuje).
create or replace function public.tts_budget(p_chars int, p_media uuid, p_kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_chars is null or p_chars < 0 or p_kind not in ('reel', 'chapter') then raise exception 'tts_budget: bad arguments'; end if;
  perform pg_advisory_xact_lock(hashtext('cramfox:tts:global'), 0);
  if coalesce((select sum(l.chars) from public.tts_ledger l where l.created_at > now() - interval '1 day'), 0) + p_chars
     > public.app_config_int('tts_global_daily_chars', 600000) then
    return false;
  end if;
  insert into public.tts_ledger (chars, media_id, kind) values (p_chars, p_media, p_kind);
  delete from public.tts_ledger l where l.created_at < now() - interval '3 days';
  return true;
end $$;
revoke all on function public.tts_budget(int, uuid, text) from public, anon, authenticated;
grant execute on function public.tts_budget(int, uuid, text) to service_role;

-- zwrot do budżetu: znaki zarezerwowane przez tts_budget, których lektor nie nagrał (nieudane nagranie rozdziału) —
-- wiersz z ujemną liczbą, najwyżej tyle, ile ten media_id zarezerwował w kroczącej dobie. Zwraca oddane znaki.
create or replace function public.tts_refund(p_chars int, p_media uuid, p_kind text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_back int;
begin
  if p_chars is null or p_chars < 0 or p_media is null or p_kind not in ('reel', 'chapter') then raise exception 'tts_refund: bad arguments'; end if;
  perform pg_advisory_xact_lock(hashtext('cramfox:tts:global'), 0);
  v_back := least(p_chars, greatest(coalesce((select sum(l.chars) from public.tts_ledger l
                                               where l.media_id = p_media and l.created_at > now() - interval '1 day'), 0), 0))::int;
  if v_back > 0 then
    insert into public.tts_ledger (chars, media_id, kind) values (-v_back, p_media, p_kind);
  end if;
  return v_back;
end $$;
revoke all on function public.tts_refund(int, uuid, text) from public, anon, authenticated;
grant execute on function public.tts_refund(int, uuid, text) to service_role;

-- 12) Rozmowa z lisem: jedna wiadomość = +1 w dniu (Europe/Warsaw). Pod blokadą konta. Limit globalny liczony bez
--     blokady globalnej (miękki: przy wielu równoległych żądaniach może go przekroczyć o kilka wiadomości).
--     {ok:true, day, used, limit, remaining} albo {ok:false, reason: chat_daily | chat_global, used, limit}.
create or replace function public.reserve_chat(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Europe/Warsaw')::date;
  v_plan text;
  v_limit int;
  v_used int;
  v_global int := public.app_config_int('chat_global_daily_cap', 5000);
begin
  if p_user is null then raise exception 'reserve_chat: missing arguments'; end if;
  perform pg_advisory_xact_lock(hashtext('cramfox:chat:user'), hashtext(p_user::text));
  select p.plan::text into v_plan from public.profiles p where p.id = p_user;
  v_limit := case when v_plan = 'pro' then public.app_config_int('pro_chat_daily', 200) else public.app_config_int('free_chat_daily', 30) end;
  select coalesce(sum(f.messages), 0)::int into v_used from public.fox_usage f where f.user_id = p_user and f.day = v_day;
  if coalesce((select sum(f.messages) from public.fox_usage f where f.day = v_day), 0) >= v_global then
    return jsonb_build_object('ok', false, 'reason', 'chat_global', 'used', v_used, 'limit', v_limit, 'day', v_day);
  end if;
  if v_used >= v_limit then
    return jsonb_build_object('ok', false, 'reason', 'chat_daily', 'used', v_used, 'limit', v_limit, 'day', v_day);
  end if;
  insert into public.fox_usage as f (user_id, day, messages) values (p_user, v_day, 1)
  on conflict (user_id, day) do update set messages = f.messages + 1
  returning f.messages into v_used;
  delete from public.fox_usage f where f.day < v_day - 7;
  return jsonb_build_object('ok', true, 'day', v_day, 'used', v_used, 'limit', v_limit, 'remaining', greatest(v_limit - v_used, 0));
end $$;
revoke all on function public.reserve_chat(uuid) from public, anon, authenticated;
grant execute on function public.reserve_chat(uuid) to service_role;

-- zwrot wiadomości (AI nie odpowiedziało): −1 w dniu rezerwacji (p_day; domyślnie dziś), nie poniżej 0.
create or replace function public.release_chat(p_user uuid, p_day date default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then return; end if;
  perform pg_advisory_xact_lock(hashtext('cramfox:chat:user'), hashtext(p_user::text));
  update public.fox_usage f set messages = greatest(f.messages - 1, 0)
   where f.user_id = p_user and f.day = coalesce(p_day, (now() at time zone 'Europe/Warsaw')::date);
end $$;
revoke all on function public.release_chat(uuid, date) from public, anon, authenticated;
grant execute on function public.release_chat(uuid, date) to service_role;

-- stan (tylko odczyt): {day, used, limit, remaining, globalOpen}
create or replace function public.chat_quota(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Europe/Warsaw')::date;
  v_plan text;
  v_limit int;
  v_used int;
begin
  if p_user is null then raise exception 'chat_quota: missing arguments'; end if;
  select p.plan::text into v_plan from public.profiles p where p.id = p_user;
  v_limit := case when v_plan = 'pro' then public.app_config_int('pro_chat_daily', 200) else public.app_config_int('free_chat_daily', 30) end;
  select coalesce(sum(f.messages), 0)::int into v_used from public.fox_usage f where f.user_id = p_user and f.day = v_day;
  return jsonb_build_object('day', v_day, 'used', v_used, 'limit', v_limit, 'remaining', greatest(v_limit - v_used, 0),
    'globalOpen', coalesce((select sum(f.messages) from public.fox_usage f where f.day = v_day), 0) < public.app_config_int('chat_global_daily_cap', 5000));
end $$;
revoke all on function public.chat_quota(uuid) from public, anon, authenticated;
grant execute on function public.chat_quota(uuid) to service_role;

-- 13) Sprzątacz: tworzenie `running` starsze niż 8 min nie ma już procesu (Vercel kończy po 300 s, wewnętrzny termin
--     270 s) → zwrot jak release_media (powód „timeout:sweeper”) — także rezerwacja z media_ledger bez końca pracy,
--     której wiersz media zniknął (materiał usunięty w trakcie). Rozdział podcastu „synth” starszy niż 5 min wraca do
--     „script” (nagrywanie trwa najwyżej ~2 min). Zwraca liczbę zwróconych tworzeń. pg_cron co 5 min.
create or replace function public.sweep_stale_media() returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in select m.id from public.media m where m.status = 'running' and m.created_at < now() - interval '8 minutes'
           union
           select l.media_id from public.media_ledger l
            where l.finished_at is null and l.media_id is not null and l.created_at < now() - interval '8 minutes' loop
    if (public.release_media(r.id, 'timeout:sweeper')->>'ok')::boolean then n := n + 1; end if;
  end loop;
  update public.media m
     set manifest = jsonb_set(m.manifest, '{chapters}', (
       select jsonb_agg(case when c->>'status' = 'synth' and (c->>'synthAt')::timestamptz < now() - interval '5 minutes'
                             then (c - 'synthAt') || '{"status":"script"}'::jsonb else c end order by i)
         from jsonb_array_elements(m.manifest->'chapters') with ordinality as t(c, i)))
   where m.kind = 'podcast' and m.status = 'ready' and jsonb_typeof(m.manifest->'chapters') = 'array'
     and exists (select 1 from jsonb_array_elements(m.manifest->'chapters') c
                  where c->>'status' = 'synth' and (c->>'synthAt')::timestamptz < now() - interval '5 minutes');
  return n;
end $$;
revoke all on function public.sweep_stale_media() from public, anon, authenticated;
create extension if not exists pg_cron;
do $$ begin
  perform cron.unschedule('cramfox-sweep-media') where exists (select 1 from cron.job where jobname = 'cramfox-sweep-media');
  perform cron.schedule('cramfox-sweep-media', '*/5 * * * *', 'select public.sweep_stale_media()');
end $$;

-- 14) Usunięcie konta (zastępuje delete_my_account z 0004; ta sama sygnatura i uprawnienia): pliki zostają też w buckecie
--     media → files_remaining. Apka usuwa je sama (Storage API) przed wywołaniem; starsza apka bez tego kroku dostaje
--     files_remaining zamiast zostawić nagrania pod usuniętym kontem.
create or replace function public.delete_my_account(p_dry_run boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.subscriptions s where s.user_id = uid and s.status in ('active','trialing','past_due')) then
    raise exception 'active_subscription';
  end if;
  if p_dry_run then return; end if;
  if exists (select 1 from storage.objects o where o.bucket_id in ('materials', 'media') and (storage.foldername(o.name))[1] = uid::text) then
    raise exception 'files_remaining';
  end if;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_my_account(boolean) from public, anon;
grant execute on function public.delete_my_account(boolean) to authenticated;

-- 15) Storage (OSTATNIE — patrz nagłówek): prywatny bucket media, 25 MB na plik, tylko mp3 i JSON. Właściciel czyta i
--     usuwa pliki w swoim folderze ({uid}/…; apka usuwa je sama przed usunięciem konta — delete_my_account sprawdza
--     oba buckety). Wgrywa i nadpisuje tylko serwer (service role, z pominięciem RLS) — żadnej polityki
--     insert / update dla użytkowników. Polityka „materials upload daily cap” (0008, RESTRICTIVE) bucketu media nie dotyczy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 26214400, array['audio/mpeg', 'application/json'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "media read own" on storage.objects;
create policy "media read own" on storage.objects for select
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media delete own" on storage.objects;
create policy "media delete own" on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
