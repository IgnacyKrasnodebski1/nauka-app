# Plan wdrożenia: centrum przedmiotu, rolki, podcast, rozmowa z lisem

Stan: 2026-10-22. Plan dla 5 agentów pracujących równolegle. Źródło prawdy dla wyglądu i tekstów: `docs/design-centrum.md` (dalej „spec”, decyzje D1–D8) i makiety `design/centrum/*.dc.html`. Ten plan ustala **kontrakty** (dane, API, baza, funkcje silnika) i **podział plików**. Agent robi dokładnie to, co jest przypisane jemu, i nie edytuje plików innych agentów. Jeśli kontrakt okaże się niewykonalny, agent zapisuje problem w swoim raporcie końcowym i stosuje najbliższe rozwiązanie zgodne z kontraktem (nie zmienia kształtu danych po cichu).

Konwencja: „…” = gotowy tekst UI po polsku. Kod, nazwy pól i opisy techniczne po angielsku.

---

## 0. Zasady wspólne (obowiązują każdego agenta)

### 0.1 Twarde reguły
- Bez wdrożeń, bez `git commit`/`push`, bez wgrywania migracji na produkcję, bez prawdziwych płatnych wywołań (Anthropic i ElevenLabs tylko jako atrapy w testach).
- Każdy tekst z bazy, z AI, z Storage (scenariusze, transkrypcje, tytuły, odpowiedzi lisa) trafia do DOM tylko przez `clean()` (pola HTML) albo `esc()`/`plain()`/`textContent` (zwykły tekst). Treść AI nie może mieć emoji (`stripEmoji` przez `plain()`).
- Nie zmieniać nazw istniejących kluczy localStorage. Nowe klucze są dozwolone (wymienione w tym planie).
- Nie usuwać ani nie przestawiać elementów `quiz`/`flashcards`/`tasks`/`feed` (indeksy są kluczami postępów). Nowe pola danych zawsze opcjonalne; stare tematy i stare zapisy działają bez zmian.
- UI po polsku, ciepło i rzeczowo, bez emoji, rodzajowo neutralnie (D7), przecinek dziesiętny („1,25×”), cudzysłów „…”. **Nigdy** słowa o płatności, cenie, planie Pro, kupowaniu, subskrypcji (App Store 3.1.1). Limit tylko neutralnie: „Zostało: X z Y”.
- Żadnych zewnętrznych zasobów w apce (CSP). Audio z Supabase Storage pobierane jako Blob → `blob:` URL.
- Żaden klient nie ponawia automatycznie `POST`, który zużywa limit (`/api/media/reels`, `/api/media/podcast`, `/api/fox`). Ponowienie tylko po wyraźnym stuknięciu użytkownika. Wyjątek opisany w 2.5: przejście do następnego rozdziału podcastu podczas słuchania to start rozdziału przez użytkownika (jedno żądanie, bez ponawiania).
- Agenci piszący wywołania Anthropic najpierw ładują skill `claude-api` i trzymają się wzorców z `packages/ai/src/generate.ts` (klient z `client.ts`, `Deadline`, `UsageMeter`, `classifyAiError`).

### 0.2 Decyzje właściciela (przyjęte)
1. Osobna pula tworzeń dla rolek i podcastu (nigdy nie zużywa 2 darmowych lekcji): `app_config.free_media_lifetime = 3`, `app_config.pro_media_month = 30`.
2. Dzienny limit rozmowy z lisem (wiadomości): `app_config.free_chat_daily = 30`, `app_config.pro_chat_daily = 200`.
3. Kluczowe punkty (6–15 na materiał, ≥3 elementy każdy, każdy element w dokładnie jednym punkcie) powstają w **tej samej** generacji lekcji, z walidacją na serwerze. Stare tematy: jeden punkt na poziom (fallback po stronie klienta i serwera).
4. Tryb głosowy później: **żadnego** UI mikrofonu (bez przycisku mikrofonu w czacie, bez „POWIEDZ ODPOWIEDŹ” w pauzie podcastu, bez ekranu Lis-Glos). Notka w Lis-Tryby brzmi: „Odpowiadasz, pisząc.”
5. Podcast: skrypt raz na materiał (jedno tworzenie), audio syntezowane **per rozdział na żądanie** (gdy użytkownik włącza rozdział), cache na zawsze. Podcast: model TTS `eleven_flash_v2_5`. Rolki: `eleven_v4`. Jedno tworzenie naraz na konto. Zwrot (release) przy błędach po naszej stronie jak w 0009.
6. Seria rolek: domyślnie 5 rolek po 45–60 s (3–6 wg wybranych rodzajów), pytanie końcowe = istniejące pytanie quizu zapisywane do SRS; przewijanie w górę/dół.
7. Podcast 20–30 min, 8 rozdziałów, dialog Lis + Szop, pauzy z istniejącymi pytaniami quizu (jedna pauza na rozdział).
8. Rozmowa z lisem: tryby tekstowe „Wytłumacz mi”, „Przepytaj mnie”, „Egzamin ustny” (ocena w polskiej skali).

### 0.3 Decyzje tego planu (doprecyzowania spec)
- Copy Dodatków zmienione pod 20–30 min: podcast „20–30 minut rozmowy w 8 rozdziałach. Szop się myli, lis poprawia, a Ty odpowiadasz w pauzach.”; meta odtwarzacza „26:40 · 8 rozdziałów · 8 pauz na pytanie”.
- Zwrot tworzenia (release): przy **każdej** porażce tworzenia rolek/podcastu poza `refusal` (treść tematu jest już przetworzona, więc porażka jest po naszej stronie). Dzienny bezpiecznik konta (5/dobę, liczy też zwrócone) zostaje.
- Licznik czatu to wiadomości (jedno `POST /api/fox` = 1). Linia w Lis-Tryby pokazuje się tylko przy `remaining ≤ 10`: „Dziś możesz wysłać lisowi jeszcze N wiadomości.” (`pl()`); przy 0: „Na dziś to wszystkie rozmowy. Jutro możesz znowu.” i przycisk wyłączony. Doba czatu = data w strefie `Europe/Warsaw` (liczona w SQL).
- Odpowiedź w rozmowie z lisem nie zapisuje SRS. Dobra odpowiedź o punkcie zapisuje `PROGRESS.oral` i może tylko podnieść stan „Nowe” → „W trakcie” (nigdy do „Umiem”).
- Rolka i pauza podcastu zapisują SRS przez istniejące pytanie quizu (+3 XP za dobrą, jak zakładka Quiz). Samo oglądanie nie daje XP ani SRS (D2).
- „ŹRÓDŁO” w materiale: wiersz z nazwą pliku; stuknięcie otwiera arkusz z listą plików materiału (bez pobierania pliku w tej fazie) i tekstem „Każde pytanie wskazuje swoją stronę — stuknij „Źródło” pod odpowiedzią.”
- Model AI dla scenariuszy rolek/podcastu: `CRAMFOX_MEDIA_MODEL` (domyślnie `claude-sonnet-5`, szybszy — budżet 270 s). Rozmowa z lisem: `CRAMFOX_FOX_MODEL` (domyślnie `claude-sonnet-5`). Bez klucza Anthropic media nie mają trybu demo (503 `ai_unavailable`).

---

## 1. Dane

### 1.1 `TopicContent.keyPoints` (backend, `packages/shared/src/schema.ts`)

Opcjonalne pole na końcu `TopicContentSchema`:

```ts
export const KeyPointItemSchema = z.object({
  kind: z.enum(["quiz", "flashcard", "task"]),
  level: z.string().min(1).max(40),        // Level.id of THIS topic ("l1", "l2", …)
  index: z.number().int().min(0).max(59),   // index in levels[level].quiz | .flashcards | .tasks
});
export const KeyPointSchema = z.object({
  id: z.string().regex(/^p\d{1,2}$/),       // "p1".."p15", unique in the topic, in display order
  title: z.string().min(1).max(120),        // „MFW: rola Międzynarodowego Funduszu Walutowego”
  short: z.string().min(1).max(24),         // chip label „MFW”
  summary: z.string().max(300).optional(),
  levels: z.array(z.string().min(1).max(40)).min(1).max(30), // levels the items live in, in level order
  items: z.array(KeyPointItemSchema).min(3).max(120),
});
// in TopicContentSchema:
keyPoints: z.array(KeyPointSchema).min(3).max(15).optional(),
```
Mirror type `KeyPoint` / `KeyPointItem` in `types.ts`.

**Invariants after finalize** (enforced by `buildKeyPoints()` in finalize, see 2.1): every `quiz` and `flashcard` item of the topic is in exactly one point; every `task` is in at most one point; every ref points to an existing element **after** finalize filtering; every point has ≥3 items and ≥2 of them are `quiz`/`flashcard`; 6–15 points (3–15 allowed only when the topic has < 18 quiz+flashcard items); if these cannot be met, `keyPoints` is omitted (never fail the generation because of key points).

**Fallback (old topics or omitted keyPoints)** — identical on server (`topicPoints()` in `packages/shared/src/media.ts`) and client (`cloud.js`): one point per level, raw id `"L" + level.id` (e.g. `"Ll2"`), `title`=`short`=level title (short cut to 24 chars with „…”), items = all flashcards + all quiz + all tasks of that level, `fb: true`.

### 1.2 Point in the engine (client, built by `cloud.js → toEngine()`)

Each engine subject gets `s.points: Point[]` (all topics, topic order, then point order). Each topic in `s.topics` gets `points: [pid…]` and `n` (1-based chapter number „01”).

```js
Point = {
  id,          // 't' + topicId(no dashes).slice(0,8) + '_' + rawId   e.g. "t1a2b3c4d_p3", fallback "t1a2b3c4d_Ll2" (no ':' — used in keys)
  raw,         // "p3" | "Ll2"  (server id, used in API calls and manifests)
  topicId,     // uuid
  t,           // plain(title)  (escaped text)
  s,           // plain(short)
  sum,         // plain(summary) or ''
  lv:[lid],    // ENGINE level ids
  fc:[[lid,i]], q:[[lid,i]], tk:[[lid,i]],   // engine level id + index
  fb:boolean,  // fallback point
  n            // 1-based position within its topic („PUNKT 9 Z 13”)
}
```
Mapping rules in `cloud.js` (`mapPoints(content, topicId, lidOf)` where `lidOf(rawLevelId)` returns the engine level id produced by `mapLevel` for that topic):
- drop refs whose level is unknown or whose index is out of range of the mapped arrays; drop duplicate refs (first point wins);
- `quiz`/`flashcard` items not covered by any point → appended to the fallback-style point of their level created on demand (`raw "L"+level`);
- a point left with < 3 items or < 2 SRS-able items is merged into the next point of the same topic (or the previous one if last);
- if fewer than 3 valid points remain for the topic → whole topic uses fallback;
- strings via `plain()`; lengths cut to the schema limits.

### 1.3 Mastery (D1) — pure function over existing SRS keys

Engine function (CLIENT-CORE), no new storage:

```js
pointState(s, p, today = todayStr()) -> {
  st: 'known'|'learning'|'refresh'|'new',
  n,          // fc.length + q.length (tasks excluded: they have no SRS key)
  seen,       // items with srs entry and seen>0
  firm,       // items with box >= 2
  overdue,    // items with dayDiff(due, today) > 2
  maxOverdue, // max days overdue among items (0 if none)
  last        // {ok, total} of the point's quiz items answered in the last session if known, else null (optional, for PointSheet „Ostatnio 4 z 5 dobrze.” — may be null)
}
```
Keys: flashcard `${s.id}:${lid}:${i}`, quiz `${s.id}:${lid}:q${i}` (existing `srsTouch` format).

Rules, evaluated in this order:
1. `n === 0` → `'new'`.
2. `seen === 0` → `'new'`, unless `PROGRESS.oral[s.id+':'+p.id]?.ok === true` → `'learning'`.
3. `firm / n >= 0.7 && overdue === 0` → `'known'`.
4. `overdue / n >= 1/3` → `'refresh'`.
5. otherwise → `'learning'`.

XP, streak, watching reels/podcast never change the state. Points hidden by the user („To nie jest punkt z mojego materiału”, `PROGRESS.ptHide[sid+':'+pid]`) are excluded from all counts.

Aggregates:
```js
masteryOf(s, topicId = null) -> { known, learning, refresh, fresh /* 'new' */, total, list: [{p, r /* pointState */}] }
```

### 1.4 Gotowość (D3)

```js
readiness(s, levelIds = null) -> { pct: number|null, known, total, mock: number|null, answers }
```
- scope: points with any `lv` in `levelIds` (test plan levels) or all points when `null`;
- `answers` = Σ `seen` over all srs entries whose key starts with `s.id + ':'`;
- `answers < 10` → `pct: null` (UI shows „?”);
- `share = known/total`; `mock = subjState(s.id).exam?.best?.pct ?? null`;
- `pct = mock == null ? round(100*share) : round(70*share + 0.3*mock)`.
TestPlan screen (`renderTestPlan`) uses this number instead of the old 60/40 formula. Exam card, Dziś card and hub use the same function.

### 1.5 „NA TERAZ” (D5)

```js
naTeraz(s) -> Action[]   // ordered; [0] = main card; „Inna propozycja” cycles [1..] then back to [0]
Action = { id, kind, eyebrow, title, body, cta, minutes, fox: 'think'|'happy'|'sleep', go: () => void }
```
Inputs: `s`, `testFor(s.id)` (exam date), `lsaves()` (interrupted lessons), `masteryOf(s)`, today's test-plan row (`testTodayItem`), level done flags, `subjState(s.id).exam`, `PROGRESS.fox`, media registry (`mediaFor(s.id)`), `NAUKA_CLOUD.meCached()` features.

Order (first match = main; every further match appended; reels/podcast only appended, never first):
1. exam today → kind `warmup`: „Rozgrzewka · 5 min” (review session of up to 10 due items of this subject, else 10 weakest items); exam tomorrow → kind `cram`: „Noc przed sprawdzianem · 20 min” → `openCram(sid)`.
2. kind `resume`: any `lessonSave` of a level of `s` (most recent) → title „Dokończ lekcję N z <material short>”, body „<level title> · część X z Y. Przerwane <wczoraj|dziś|N dni temu>, zostały ok. M minuty.”, cta „DOKOŃCZ LEKCJĘ” → `resumeLesson`.
3. kind `szop`: ≥ 2 points `refresh` → „Odzyskaj N punktów od Szopa”, cta „ODZYSKAJ · M MIN” → point practice session over those points (1.6). When this is the main card, the Szop strip is hidden.
4. kind `plan`: unfinished row of today's test plan → its existing action.
5. kind `lesson`: first level not done, in material (topic) order → „Zacznij lekcję N z <material>” (new hub: eyebrow „NA START”, title „Zacznij od lekcji 1”, cta „ZACZNIJ LEKCJĘ 1”, no „Inna propozycja”).
6. kind `mock`: exam in ≤ 3 days and `exam.n === 0` → „Egzamin próbny”.
7. kind `oral`: all points `known` and `features.fox` → „Egzamin ustny z lisem”; if `PROGRESS.fox['s:'+sid].exam.at === today` → kind `rest` „Na dziś wystarczy” (fox sleep, no button).
Appended alternatives (never main): `reel` — next unwatched reel of the newest ready series („Obejrzyj rolkę 3/5: <title> · 0:47”); `podcast` — continue podcast („Słuchaj dalej: <title> · zostało 5:10”); `szop` with 1 point; `review` when the subject has due items.
Fallback when the list is empty: kind `review` (if due) else `rest`.

Minutes: lesson `max(3, round(1.2*feed + 0.4*(min(6,quiz)+tasks)))`; point practice `max(2, ceil(items/3))` capped 10.

### 1.6 Point practice (PointSheet, Szop) — no AI, no hearts

`practicePoints(s, pids, onDone)`: builds a session of: the point's first lesson chunk as a reminder card (feed of the first `lv`, chunk of `doseChunks`), up to 4 linked quiz items (overdue first, then lowest box), 3 linked flashcards; uses the existing review-session renderer (`startReview(items)` with an `onDone` callback added; items via `srsResolve(key)`); answers go through `srsTouch` as in Powtórka (+2/+3 XP). Result sheet: „<short>: Do odświeżenia → W trakcie” (states before/after via `pointState`). Completes daily task `sid:szop`.

### 1.7 New optional progress/meta fields (CLIENT-CORE validates in `fixProgress` / `fixMeta`)

| Field | Shape | Written by |
|---|---|---|
| `PROGRESS.media` | `{ [mediaId]: { w: [n…] /* watched reels, numbers */, q: { [k]: 0\|1 } /* first answer per reel n or podcast "c<n>" */, ch: n /* podcast current chapter */, pos: sec /* position in chapter */, done: [n…] /* finished chapters */, at: 'yyyy-mm-dd' } }` | media.js via `setMediaState` |
| `PROGRESS.oral` | `{ ['sid:pid']: { at: date, ok: bool } }` | media.js via `markOral` |
| `PROGRESS.fox` | `{ [topicId \| 's:'+sid]: { explain?: {at, gaps}, quiz?: {at, ok, n}, exam?: {at, pct, grade} } }` | media.js via `setFoxState` |
| `PROGRESS.ptHide` | `{ ['sid:pid']: date }` | engine (PointSheet footer) |
| `META.mediaPrefs` | `{ rate: 1\|1.25\|1.5, qEnd: bool /* podcast questions at end */, hint: bool /* reel pause hint seen */ }` | media.js via `saveMeta` |

Validation: unknown shapes dropped; arrays of ints (`w`, `done`) deduped, ints 1–20; `pos` number ≥ 0; strings ≤ 40 chars where used as dates (`isDate`). Sync rules already fit (`merge3`: objects per key, arrays of primitives as sets, numbers max). Podcast position: save at pause, chapter change, player close, `visibilitychange` hidden, and at most once per 60 s while playing (never every second — each save triggers the 4 s sync debounce).

Daily plan (`PROGRESS.daily.tasks`) gets new kinds (ids `sid:kind[:x]`): `szop` (+20 XP), `reels:<mediaId>` (+15), `cram` (+20), `oral` (+25), `warmup` (+15). Old kinds (`lesson`, `review`, `quiz`, `exam`, `weak`) still resolve in `taskInfo` (old saved days keep working); new plans no longer create `quiz`/`exam`.

---

## 2. Backend — kontrakty

Common to all new routes (`apps/web/src/app/api/...`): `Authorization: Bearer <supabase access_token>`; errors `{ error: string /* Polish, may be shown */, code: string, ...extra }`; no CORS; `export const dynamic = "force-dynamic"`; `maxDuration` both in `route.ts` and `apps/web/vercel.json`. All DB writes through the service role; ownership checks through the user-scoped client (RLS). `requestId` = idempotency key = `media.id`.

### 2.1 Key points inside lesson generation (BACKEND-KEYPOINTS)

- `OutlineSchema` gains `points: z.array(z.object({ key: z.string(), title: z.string(), short: z.string(), summary: z.string(), levels: z.array(z.number()) }))` — 6–15 key points of the whole material, `levels` = 0-based outline level indexes. `OUTLINE_INSTRUCTIONS` asks for them (disjoint, exam-relevant, ordered as in the material, `short` ≤ 24 chars, no emoji).
- `GenCardSchema`, `GenQuizSchema`, `GenTaskCompactSchema` (and `GenTaskSchema` / `expandGenTask` passthrough) gain `p: z.string()` — the `key` of the point the item belongs to. `levelInstructions()` receives the points assigned to that level (plus all point keys as allowed values) and requires `p` on every flashcard, question and task.
- Review (`packages/ai/src/review.ts`, `packages/shared/src/review.ts`): every quiz/flashcard/task that survives review keeps its original `p` (map by original index; a rewritten question keeps `p`).
- `finalizeGenerated()` builds `keyPoints` with `buildKeyPoints(outlinePoints, finalLevels)` **after** filtering, so indexes are final. Repair order: unknown/empty `p` → the first outline point listing that level, else the point with most items in that level; points < 3 items or < 2 quiz/flashcard → merged into the point with most items sharing a level; > 15 → merge smallest into its neighbour; ids renumbered `p1..pN` in order; if invariants of 1.1 still fail → omit `keyPoints`. Quality stats `{keyPoints: n, repaired: k, omitted: bool}` go into `generations.quality`.
- `demo.ts`: demo topic gets valid `keyPoints`.
- `GeneratedTopicSchema` / `LevelGenSchema` accept `p` optionally (old fixtures stay valid).
- No new API fields: `topic.content.keyPoints` simply appears in `/api/generate` 200 and in `topics.content`.

### 2.2 `POST /api/media/reels` (BACKEND-MEDIA) — `maxDuration = 300`

Request:
```json
{ "requestId": "uuid v4", "topicId": "uuid",
  "types": ["czym","kto","mit","porownanie","sprawdzian"],
  "focusPointId": "p3" }
```
- `types`: 1–6 distinct from `czym` („CZYM TO JEST”), `kto` („KTO JEST KIM”), `mit` („MIT CZY FAKT”), `porownanie` („PORÓWNANIE”), `pulapki` („PUŁAPKI NA EGZAMINIE”), `sprawdzian` („NA SPRAWDZIAN”); 3–6 for a series; exactly 1 when `focusPointId` is given (single reel „ZRÓB ROLKĘ Z TEGO”).
- `focusPointId`: optional raw point id (`p3` or fallback `Ll2`).

Sequence (before any cost, in this order): 503 `no_config` (no Supabase / service role) → 503 `ai_unavailable` (no Anthropic key, `charged:false`) → 503 `tts_unavailable` (no `ELEVENLABS_API_KEY`) → 401 `unauthorized` → 400 `bad_request` (zod) → **idempotency**: row `media.id = requestId` exists for this user → **200** `{ media }` (no charge); exists for another user → 409 `conflict` → 404 `not_found` (topic missing or not owned, user-scoped client) → 400 `no_quiz` (topic has no quiz item: every reel needs an end question) → 400 `bad_point` (unknown `focusPointId`) → RPC `reserve_media` (3.3):
- `busy` → 409 `busy` + `busy: { id, kind, topicId }`;
- `lifetime` / `month` → 402 `limit_reached` + `reason`, `scope: "lifetime"|"month"`, `used`, `limit`;
- `daily` → 402 `limit_reached` + `reason: "daily"`;
- `global` → 402 `limit_reached` + `reason: "global"`;
- RPC missing (no 0010) → 503 `media_unavailable`; other DB error → 500 `reserve_failed`.
Every error has `charged: false`.

Success: **202** `{ media: MediaRow }` with `status: "running"`, `progress: {step:"plan", done:0, total:N}`. The work continues in `after()` (`import { after } from "next/server"`), bounded by a `Deadline` of request start + 270 s (abort signal for every AI/TTS call). Pipeline (`packages/ai/src/media/reels.ts`, pure with injected deps):
1. **Series plan** (one structured call): input = compact topic text (levels, feed bodies without HTML, flashcards, quiz items labelled `l2#q3`), `topicPoints(content)`, requested types, stage. Output `{ seriesTitle, reels: [{ type, title, pointIds, quizRef: {level, index}, feedRef: {level, index} | null, angle }] }`. Validate/repair: one reel per requested type in request order; quizRefs exist and are distinct; with keyPoints, quizRef must be an item of one of the reel's points (repair: pick an unused quiz item of the reel's points); every point covered by ≥ 1 reel (repair: add uncovered points to the reel with fewest); single mode: pointIds = [focusPointId].
2. **Storyboards** (N parallel calls, cached shared prefix: rules + example + topic text). Output `{ storyboard: string }` (JSON string — the storyboard union is too big for a grammar). Parse → `sanitizeStoryboard()` (`packages/shared/src/media.ts`) → if parse fails, **one** re-ask for that reel. Storyboard format = prototype README §„Scenariusz” with these changes: no `quiz` field (end question is `quizRef` in the manifest), no `voice`; `audio` is set by the server to `{ "src": "rN.mp3", "words": "rN.words.json", "rate": 1.15 }`; `say` 80–130 words in 6–14 scenes (45–60 s at rate 1.15 with voice „Dawid”); `tts` must contain exactly the words of `say` plus allowed tags (`[excited]`, `[whispers]`, `[laughs softly]`, `[sarcastic]`, `[dramatically]`, `[short pause]`) and `{a|b}` pairs — on mismatch `tts := say`. Sanitizer: unknown keys dropped; colors only `#hex`; `kind` outside the prop library (README table) → `house`; action types outside the README table dropped; numbers clamped (zoom 0.5–3, x/y −30…30, dur 0–8); texts trimmed to: title 60, label 40, card line 60, cutaway texts 80, say per scene 400; no `<>` in texts (stripped); emoji stripped. Rules text = constant `REEL_STORYBOARD_RULES` in `packages/shared/src/media.ts`, adapted from the prototype README sections Świat, Kamera, Narracja, Akcje, Biblioteka rekwizytów (owner's text), plus one example (trimmed `test/proto/rolka/storyboards/fotosynteza.json`, copied as `REEL_EXAMPLE`). Prompt rules: only facts from the topic; the hook may not reveal the end question's answer; Polish; no emoji.
3. If fewer than 3 reels (series) or 0 (single) survive → failure. Otherwise continue with the survivors.
4. **TTS** per reel, concurrency 3: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_64`, header `xi-api-key`, body `{ text, model_id: ELEVENLABS_REEL_MODEL ("eleven_v4"), apply_text_normalization: "auto", language_code: "pl" }`; `text` = scenes' `tts` joined with `"\n"` (tags removed when `ELEVENLABS_REEL_TAGS=0`), ≤ 2 000 chars. Response `{ audio_base64, alignment: { characters, character_start_times_seconds, character_end_times_seconds }, normalized_alignment }` (docs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps, models and limits: https://elevenlabs.io/docs/models — cite both in code comments and re-verify field names when implementing). `alignToWords(text, alignment)` → prototype `words.json`: `{ v:1, duration, words: [{ w, start, end, tag? }] }` (tokens split on whitespace with char offsets; tags `[…]` → `tag: true`; if `alignment` chars do not match `text`, fall back to `normalized_alignment` with a greedy token match; `duration` from MP3 frame parsing, not from the last word).
5. **Storage**: bucket `media`, paths `{uid}/{mediaId}/rN.json` (storyboard), `rN.mp3` (`audio/mpeg`), `rN.words.json`; upsert true.
6. RPC `finish_media(id, manifest, stats)`. Progress updates during the run: direct service-role `update media set progress=…, phase=…` — steps `plan` → `script` (done/total storyboards) → `voice` (done/total) → `save`.
On failure: `refusal` → RPC `fail_media` (charged); anything else (AI or TTS unavailable, invalid output after the one re-ask, timeout, storage) → RPC `release_media` (refund). `media.error` = `<code>:<detail ≤ 200>`, codes: `ai_unavailable`, `tts_unavailable`, `invalid_output`, `refusal`, `timeout`, `storage_failed`.

**ReelsManifest** (`media.manifest`, kind `reels`):
```json
{ "v": 1, "kind": "reels", "title": "Kto rządzi światową gospodarką?", "topicId": "uuid",
  "coverage": { "points": 13, "covered": 13 },
  "reels": [ { "n": 1, "type": "czym", "title": "MSG i MSP w minutę", "durSec": 52.4,
               "pointIds": ["p1","p2"], "quizRef": { "level": "l1", "index": 3 },
               "feedRef": { "level": "l1", "index": 0 },
               "files": { "storyboard": "r1.json", "audio": "r1.mp3", "words": "r1.words.json" },
               "rate": 1.15, "thumb": "#2F6BFF" } ] }
```
`thumb` ∈ station colours (`#2F6BFF`, `#1F8A5B`, `#E9A23B`, `#E0483F`). File names match `/^[a-z0-9.]+$/`.

### 2.3 `POST /api/media/podcast` (BACKEND-MEDIA) — `maxDuration = 300`

Request `{ "requestId": "uuid", "topicId": "uuid" }`. Same pre-checks as 2.2 except: after `tts_unavailable`, 503 `voices_missing` when `ELEVENLABS_VOICE_FOX` or `ELEVENLABS_VOICE_SZOP` is unset (before auth is fine; `charged:false`). `reserve_media(kind 'podcast')`. 202 `{ media }`, work in `after()`:
1. **Outline** (one call): `{ title, chapters: [{ n, title, pointIds, levelIds, quizRef, szopMistake, lead }] }` — 8 chapters (6–8 allowed when the topic has < 8 points), in material order, every point in ≥ 1 chapter, distinct existing `quizRef` per chapter (one pause per chapter), `lead` ≤ 160 chars = what the Szop just got wrong, said by the fox before the question.
2. **Chapters** (8 parallel calls): `{ lines: [{ s: "lis"|"szop", t: string }], pauseAfter: int }` — 350–520 words per chapter (total 2 800–4 100 words ≈ 20–30 min at ~2,3 words/s), 18–40 lines, line ≤ 400 chars, alternating speakers mostly; the line at `pauseAfter` is the Szop's mistake from `szopMistake`; `**term**` marks highlighted terms (no other markup). Validate; one re-ask per failed chapter; fewer than 6 valid chapters → failure.
3. Store `{uid}/{mediaId}/script.json` = `{ v:1, title, chapters: [{ n, title, lines }] }`; `finish_media` with **PodcastManifest**:
```json
{ "v": 1, "kind": "podcast", "title": "Kto naprawdę rządzi gospodarką świata?", "topicId": "uuid",
  "estSec": 1600,
  "files": { "script": "script.json" },
  "chapters": [ { "n": 1, "title": "Czym są MSGiP", "pointIds": ["p1","p2"], "levelIds": ["l1"],
                  "estSec": 190, "durSec": null, "status": "script",
                  "pauses": [ { "afterLine": 12, "quizRef": { "level": "l1", "index": 2 }, "pointId": "p1", "lead": "Szop twierdzi, że…" } ],
                  "files": null } ] }
```
`estSec = words / 2.3`. No audio is synthesized here.

### 2.4 `POST /api/media/podcast/chapter` (BACKEND-MEDIA) — `maxDuration = 120`, synchronous

Request `{ "mediaId": "uuid", "chapter": 1 }`. Not charged to the user's pool. Sequence: 503 `no_config` / `tts_unavailable` / `voices_missing` → 401 → 400 `bad_request` → 404 `not_found` (media not owned, not podcast, chapter out of range) → 409 `not_ready` (media not `ready`) → RPC `claim_podcast_chapter`: `ready` → **200** cached chapter; `busy` (another synthesis < 3 min) → 409 `chapter_busy` (client polls the media row every 3 s, up to 120 s); `claimed` → RPC `tts_budget(chars)`: refused → 429 `tts_budget` and claim released → synthesize:
- one TTS call per line, concurrency 4, `model_id: ELEVENLABS_PODCAST_MODEL ("eleven_flash_v2_5")`, voice by speaker (`ELEVENLABS_VOICE_FOX` / `ELEVENLABS_VOICE_SZOP`), `output_format=mp3_44100_64`, text without `**`; internal retry once only on 429/5xx (server-side, not the client);
- concatenate MP3 bytes (strip ID3v2/Xing frames), line offsets from MP3 frame durations;
- timing file `{uid}/{mediaId}/cN.json` = `{ v:1, duration, lines: [{ i, s, start, end, words: [{ w, start, end }] }], pauses: [{ afterLine, at }] }` and audio `cN.mp3`;
- RPC `set_podcast_chapter(mediaId, n, { status:"ready", durSec, files:{ audio:"cN.mp3", timing:"cN.json" } })`.
Response 200 `{ chapter: <chapter object as in the manifest, status "ready"> }`. Failure → claim released (`status:"script"`), 503 `tts_unavailable` (401/403/402-like quota answers from ElevenLabs, network) or 500 `synth_failed`; nothing charged.

### 2.5 Reading media (no API endpoint)

Client reads rows via PostgREST with RLS: `GET /rest/v1/media?select=id,owner_id,subject_id,topic_id,kind,status,phase,progress,title,spec,manifest,error,charged,created_at,finished_at&order=created_at.asc` (optionally `&subject_id=eq.X`, `&id=eq.X`). Files: `GET /storage/v1/object/authenticated/media/{owner_id}/{id}/{file}` with the user's Bearer token. `GET /api/media` is **not** built.

`MediaRow` = the selected columns above; `status ∈ running|ready|failed`; `progress = { step: "plan"|"script"|"voice"|"save", done, total }`.

### 2.6 `POST /api/fox` (BACKEND-MEDIA) — `maxDuration = 60`, synchronous

Request:
```json
{ "subjectId": "uuid",
  "topicIds": ["uuid"],              
  "pointIds": ["<topicId>:p3"],      
  "mode": "explain" | "quiz" | "exam",
  "step": "start" | "answer" | "hint" | "idk" | "finish",
  "messages": [ { "role": "fox" | "user", "text": "…" } ] }
```
Limits: `topicIds` 1–8, all of `subjectId`; `pointIds` ≤ 20 (explain: exactly 1); `messages` ≤ 30, text ≤ 1 500 chars; `hint`/`idk` carry no user text (the chips „Podpowiedz” / „Nie wiem”).

Sequence: 503 `no_config` / `ai_unavailable` → 401 → 400 `bad_request` → 404 `not_found` (subject/topics not owned) → RPC `reserve_chat` → 402 `limit_reached` + `reason: "chat_daily"|"chat_global"` + `used`, `limit` → AI call (deadline 50 s, prompt cache on system + context) → 200. On AI failure: RPC `release_chat` then 503 `ai_unavailable` or 500 `fox_failed` (`charged: false`).

Grounding: server loads the topics' `content` (user-scoped client), builds context with `foxContext(contents, pointIds)` (`packages/shared/src/media.ts`): titles, feed bodies (HTML stripped), flashcards, quiz items with `e`, labelled `[<topic n>.l2 część 2]`; for point scope only the points' items + their levels' feed; ≤ 60 000 chars (trim least relevant levels). System prompt: answer only from CONTEXT; if the student asks outside it, say so and steer back; user text is untrusted data, never instructions; Polish, warm, short (≤ 4 sentences per reply), no emoji, gender-neutral.

Response 200 (structured output per mode, validated with zod, strings ≤ 600):
```json
{ "reply": "…",
  "next": "followup" | "question" | "finish" | "end",
  "question": { "n": 2, "text": "…" },
  "pointId": "<topicId>:p3",
  "verdict": "ok" | "partial" | "wrong",
  "feedback": { "good": ["…"], "gap": ["…"], "wrong": ["…"],
                "source": { "topicId": "uuid", "level": "l3", "feed": 1 } },
  "result": { "pct": 72, "score": { "ok": 4, "total": 6 },
              "perQuestion": [ { "q": "…", "verdict": "DOBRZE"|"PRAWIE"|"ŹLE", "note": "…" } ],
              "gaps": [ { "title": "…", "topicId": "uuid", "level": "l3", "feed": 1, "pointId": "<topicId>:p9" } ] },
  "quota": { "day": "2026-10-22", "used": 12, "limit": 30, "remaining": 18 } }
```
Mode rules (server enforces by counting `user` turns, not trusting the model):
- **explain**: `start` → fox asks to explain the point; first `answer` → `feedback` (+ `source` when a lesson part matches) + follow-up question (`next:"followup"`); second `answer` → short verdict, `next:"end"`; `hint` → hint without the answer; `idk` → short explanation + `next:"end"`.
- **quiz** („Przepytaj mnie”): 5 open questions; each `answer` → `verdict` + one-sentence comment + next question; after the 5th → `next:"finish"` with `result.score`.
- **exam** („Egzamin ustny”): 3 questions, each with exactly one follow-up; after the last follow-up answer (or `step:"finish"`) → `result` with `pct` and per-question verdicts and `gaps`. `pct` from per-question scores 0–100 (model) averaged by the server. Grade is computed on the **client** from the subject's grading scale (`NaukaEngine.gradeFor`), the server only returns `pct`.

### 2.7 `GET /api/me` additions (BACKEND-MEDIA, additive)

```json
"media": { "plan": "free", "scope": "lifetime", "used": 1, "limit": 3, "remaining": 2,
           "dailyLeft": 4, "globalOpen": true, "busy": null },
"chat":  { "day": "2026-10-22", "used": 12, "limit": 30, "remaining": 18, "globalOpen": true },
"features": { "reels": true, "podcast": false, "fox": true }
```
`busy` = `{ id, kind, topicId }` of a running media row or `null`. `features.reels` = Anthropic key + `ELEVENLABS_API_KEY` + RPCs present; `features.podcast` = `reels` + both podcast voices; `features.fox` = Anthropic key + RPCs. Without 0010 or on RPC error: `media: null`, `chat: null`, `features: { reels:false, podcast:false, fox:false }` — old fields unchanged.

### 2.8 Environment (names only)

`ELEVENLABS_API_KEY`; `ELEVENLABS_VOICE_REEL` (default `gBomWqQijp5IiOPF7hkJ`, voice „Dawid”); `ELEVENLABS_VOICE_FOX`, `ELEVENLABS_VOICE_SZOP` (no defaults); `ELEVENLABS_REEL_MODEL` (default `eleven_v4`); `ELEVENLABS_PODCAST_MODEL` (default `eleven_flash_v2_5`); `ELEVENLABS_REEL_TAGS` (default `1`); `CRAMFOX_MEDIA_MODEL` (default `claude-sonnet-5`); `CRAMFOX_FOX_MODEL` (default `claude-sonnet-5`). Add to `apps/web/.env.example` with empty values and to the backend `docs/DEPLOY.md` list (names only).

### 2.9 Timeouts summary

| Call | Server | Client |
|---|---|---|
| `POST /api/media/reels`, `/podcast` | answers 202 in < 10 s; work until start + 270 s | 30 s |
| `POST /api/media/podcast/chapter` | 110 s deadline | 130 s |
| `POST /api/fox` | 50 s deadline | 60 s |
| polling `media` row | — | every 4 s while visible, every 15 s otherwise; stop after 9 min (row swept after 8 min) |

---

## 3. Migracja `backend/0010_media.sql` (BACKEND-MEDIA)

Idempotent (`if not exists`, `create or replace`, `on conflict do nothing`, `drop policy if exists`), header in Polish like 0009 with apply order. All functions `security definer set search_path = ''`, `revoke all … from public, anon, authenticated`, `grant execute … to service_role` (except where noted).

1. **`app_config` rows** (do not overwrite changed values): `free_media_lifetime` 3, `pro_media_month` 30, `media_daily_per_user` 5, `media_global_daily_cap` 60, `free_chat_daily` 30, `pro_chat_daily` 200, `chat_global_daily_cap` 5000, `tts_global_daily_chars` 600000. Read with `app_config_int()`.
2. **Table `public.media`**: `id uuid primary key` (client requestId), `owner_id uuid not null references auth.users on delete cascade`, `subject_id uuid not null references public.subjects on delete cascade`, `topic_id uuid not null references public.topics on delete cascade`, `kind text not null check (kind in ('reels','podcast'))`, `status text not null default 'running' check (status in ('running','ready','failed'))`, `phase text`, `progress jsonb`, `title text`, `spec jsonb not null default '{}'`, `manifest jsonb`, `error text`, `charged boolean not null default true`, `refunded_at timestamptz`, `model text`, `cost_usd numeric(8,4)`, `tts_chars int not null default 0`, `created_at timestamptz not null default now()`, `finished_at timestamptz`, `updated_at timestamptz not null default now()`; indexes `(owner_id, created_at)`, `(topic_id)`; CHECK `pg_column_size(manifest) < 200000`. RLS on; policy `media own read` FOR SELECT using `owner_id = auth.uid()`; no insert/update/delete policies. `revoke select … from anon, authenticated; grant select (id, owner_id, subject_id, topic_id, kind, status, phase, progress, title, spec, manifest, error, charged, created_at, finished_at) to authenticated`.
3. **`public.media_ledger`**: `id uuid pk default gen_random_uuid()`, `user_id uuid references auth.users on delete set null`, `media_id uuid unique`, `kind text`, `scope text` (`lifetime`|`month`), `month text`, `created_at`, `voided_at`, `refunded_at`. RLS on, no policies, revoked from API roles.
4. **`public.fox_usage`**: `(user_id uuid references auth.users on delete cascade, day date, messages int not null default 0, primary key (user_id, day))`; RLS on, no policies, revoked.
5. **`public.tts_ledger`**: `id`, `created_at`, `chars int`, `media_id uuid`, `kind text` (`reel`|`chapter`); RLS on, no policies, revoked.
6. **RPCs**:
   - `reserve_media(p_id uuid, p_user uuid, p_subject uuid, p_topic uuid, p_kind text, p_spec jsonb, p_month text, p_pro_limit int) returns jsonb` — advisory lock `hashtext('cramfox:media:user'), hashtext(p_user::text)` then `hashtext('cramfox:media:global'), 0`; existing `p_id` of `p_user` → `{ok:true, existing:true}`; of another user → `{ok:false, reason:'conflict'}`; `busy` = media of the user `running` and younger than 5,5 min → `{ok:false, reason:'busy', busy:{id,kind,topicId}}`; daily = media rows of the user in last 24 h (incl. failed/refunded) ≥ `media_daily_per_user` → `daily`; plan from `profiles.plan`: free → non-voided ledger rows of the user (all time) ≥ `free_media_lifetime` → `lifetime`; pro → non-voided rows with `month = p_month` ≥ `coalesce(app_config 'pro_media_month', p_pro_limit)` → `month`; global = non-refunded media rows in last 24 h ≥ `media_global_daily_cap` → `global`. All checks before inserting. Then insert media row (`running`, phase `plan`) + ledger row; return `{ok:true, media:<row as jsonb>, scope, used, limit}`.
   - `finish_media(p_id uuid, p_manifest jsonb, p_stats jsonb) returns jsonb` — only from `running`; sets `ready`, `manifest`, `title`, `finished_at`, `model`, `cost_usd`, `tts_chars`; inserts `tts_ledger` row (`chars` from stats).
   - `release_media(p_id uuid, p_reason text) returns jsonb` — like `release_generation`: refuses `ready` (`{ok:false, reason:'done'}`), idempotent (`already`), sets `failed`, `charged=false`, `refunded_at`, `error='released:'||left(p_reason,200)`, voids + refunds the ledger row.
   - `fail_media(p_id uuid, p_reason text, p_stats jsonb)` — `failed`, `charged` stays true.
   - `media_quota(p_user uuid, p_month text, p_pro_limit int) returns jsonb` — read only, same logic: `{plan, scope, used, limit, remaining, dailyLeft, globalOpen, busy}`.
   - `claim_podcast_chapter(p_media uuid, p_user uuid, p_n int) returns text` — row lock (`for update`) on the media row; `not_found` (owner/kind/range), `not_ready`, `ready` (chapter status ready), `busy` (status `synth` and `synthAt` < 3 min ago), else sets chapter `status:'synth', synthAt:now()` → `claimed`.
   - `set_podcast_chapter(p_media uuid, p_n int, p_patch jsonb) returns jsonb` — merges `p_patch` into `manifest->'chapters'->(p_n-1)`; `release_podcast_chapter(p_media, p_n)` sets `status:'script'`.
   - `tts_budget(p_chars int, p_media uuid, p_kind text) returns boolean` — global advisory lock; sum of `tts_ledger.chars` in last 24 h + `p_chars` ≤ `tts_global_daily_chars` → insert row, true; else false.
   - `reserve_chat(p_user uuid) returns jsonb` — `v_day := (now() at time zone 'Europe/Warsaw')::date`; plan limit `free_chat_daily`/`pro_chat_daily`; global = sum of today's messages ≥ `chat_global_daily_cap` → `chat_global`; user at limit → `chat_daily`; else upsert +1 → `{ok:true, day, used, limit, remaining}`.
   - `release_chat(p_user uuid) returns void` — today's counter − 1 (not below 0).
   - `chat_quota(p_user uuid) returns jsonb` — read only.
   - `sweep_stale_media() returns int` — `running` older than 8 min → same effect as `release_media(…, 'timeout:sweeper')`; claims `synth` older than 5 min → back to `script`. pg_cron job `cramfox-sweep-media` every 5 min (same guarded pattern as `cramfox-sweep-generations` in 0007).
7. **Storage**: bucket `media` — `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('media','media',false,26214400,array['audio/mpeg','application/json']) on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types`. Policies on `storage.objects`: `media read own` FOR SELECT using `bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text`; `media delete own` FOR DELETE same condition (account deletion cleans media files from the client). No insert/update for users (only the service role writes). Put the storage section last (see BIBLIA 7.8 #15: may need the SQL Editor).
8. **Apply order**: 0010 → backend deploy (media routes, `/api/me` fields) → app build. Backend without 0010: `/api/me` media fields null → app hides creation; media routes 503 `media_unavailable`. 0010 without backend: nothing changes.
9. **db-test** (`nauka-backend/supabase/tests/db-test.mjs`, appended section, plus storage stubs in `stubs.sql` if needed): 0010 applied twice; reserve paths (existing, conflict, busy, daily, lifetime, month, global); release/fail idempotence and quota after release; sweep; chat counters per Warsaw day, release; tts_budget; chapter claim states and parallel claims; RLS: owner reads own media, another user reads nothing, `authenticated` cannot insert/update media nor read ledgers; storage policies (read own, delete own, no insert).

---

## 4. Klient — architektura i własność plików

### 4.1 Files and owners

| Owner | Files (only these) |
|---|---|
| **CLIENT-CORE** | `engine.js`, `styles.css`, `cloud.js`, `cloud-ui.js`, `build.js`, `index.html`, `native/ios/App/App/Info.plist`, `native/ios/App/App/AppDelegate.swift` |
| **CLIENT-MEDIA** | new `media.js`, new `media.css` (repo root). Reads (does not edit) `test/proto/rolka/*`. |
| **TEST** | `test/dev/mock-backend.js`, `test/dev/index.html`, `test/dev/shoot.mjs`, `test/dev/README.md`, new `test/dev/checks/hub.mjs`, `media.mjs`, `fox.mjs`, `keypoints.mjs`, new `test/fixtures/topic-msgip.json`, new `test/fixtures/media/**` |
| **BACKEND-KEYPOINTS** | `nauka-backend/packages/shared/src/{schema,types,prompts,finalize,review}.ts` + their tests and snapshots; `nauka-backend/packages/ai/src/{generate,review,demo}.ts` + tests |
| **BACKEND-MEDIA** | new `nauka-backend/packages/shared/src/media.ts` (+ `media.test.ts`); new `nauka-backend/packages/ai/src/media/*.ts` (+ tests); new `apps/web/src/app/api/media/reels/route.ts`, `apps/web/src/app/api/media/podcast/route.ts`, `apps/web/src/app/api/media/podcast/chapter/route.ts`, `apps/web/src/app/api/fox/route.ts`; new `apps/web/src/lib/media.ts`, `apps/web/src/lib/media-db.ts`; new `nauka-app/backend/0010_media.sql`; **appends only**: `packages/shared/src/index.ts` (`export * from "./media.js";`), `packages/ai/src/index.ts` (media exports), `apps/web/src/app/api/me/route.ts` (fields of 2.7), `apps/web/vercel.json` (functions entries), `apps/web/.env.example`, `supabase/tests/db-test.mjs` (+ `stubs.sql`), `docs/API.md` (new section „Media i rozmowa z lisem”) |

BACKEND-MEDIA must not import key-point types from `schema.ts` (parallel work): `topicPoints(content: unknown)` in `media.ts` parses `content.keyPoints` tolerantly and falls back per level (1.1). Grading values: copy the stage table (BIBLIA 6.2) into `media.ts` (do not edit `finalize.ts`).

Docs (`docs/BIBLIA.md`, `CLAUDE.md`) are updated by the integration lead after merge, not by agents.

### 4.2 Script order, build, CSP

- Order: `cloud-config.js` → `cloud.js` → `engine.js` → **`media.js`** → `cloud-ui.js` (in `index.html`, `build.js` `scripts` array, and `test/dev/index.html`).
- Styles: `index.html` links `fonts/fonts.css`, `styles.css`, `media.css`; `build.js` inlines `styles.css + "\n" + media.css`.
- CSP in `build.js`: add `"media-src blob:"`. Nothing else changes (`connect-src` already has the Supabase origin used by Storage).
- `media.js` is one IIFE, `"use strict"`, no external loads, no `fetch` of its own except through `NAUKA_CLOUD`.

### 4.3 Navigation (D6) — CLIENT-CORE

- `renderNav`: „Dziś” (home) · „Przedmioty” (grid) · [+] („Dodaj materiał”) · „Powtórka” (refresh) · „Profil” (user). Fiszki tab removed (view `cards` stays registered for old links). Styles per spec BottomNav.
- `go()` resets `navHist` for `today|review|profile|subjects` (as now; `cards` too).
- **Subject context stays as today** (`current` set, `#lesson` container present) so lessons, flashcards, quiz, exercises, exam, boss and info keep working: `openSubject(id, tab='hub', setup)`; tabs: `hub` (new, replaces `path` — `path` is an alias of `hub`), `material` (new, with `curTopic`), `fiszki`, `quiz`, `cwicz`, `egzamin`, `info`. `hub` and `material` render the new chrome (TopBar 56 px + scroll + BottomNav with „Przedmioty” active + mini-player slot + `#toast` + `#lesson`); tool tabs keep the band without the subject tabs row and a back button to the tab they were opened from (`tabFrom`). Hub back → the view the subject was opened from (`subjFrom`: `today` or `subjects`).
- `navHist` subject entries become `{sid, tab, topic}`; `goBack` restores `curTopic`. Full-screen media views opened from the hub/material (`go('reelseries')` etc.) return correctly through `goBack()`.
- `levelUnlocked()` returns `true` for every level (no locks); the boss still requires all levels done.
- `registerView(k, fn, o)` gains optional `o = { leave: fn }` called by `go()` before rendering another view when leaving `k`.
- `shell()` and the hub chrome insert `window.NaukaMedia?.miniPlayer?.()` (an element or `null`) directly above the nav.

### 4.4 Screens and owners

| Screen (makieta) | Owner | Entry |
|---|---|---|
| Main (hub, mid-way) + HowSheet + PointSheet + „…” menu + Inna propozycja | CLIENT-CORE | `openSubject(sid)` |
| Centrum-Material | CLIENT-CORE (reel strip + podcast card drawn by core from the media registry; taps call `NaukaMedia`) | `openMaterial(sid, topicId)` |
| Centrum-Nowy (incl. date card, Dodatki card, „Zobacz przedmiot” from „Przedmiot gotowy”) | CLIENT-CORE (Dodatki „PRZYGOTUJ” → `NaukaMedia.prepare`) | hub when no level is done |
| Dziś (new plan, POZA PLANEM, subject cards) | CLIENT-CORE | `today` |
| Point practice session + result | CLIENT-CORE | PointSheet, Szop strip, NA TERAZ |
| Rolki-Seria, Rolki-Odtwarzacz, Rolki-Pytanie | CLIENT-MEDIA | `NaukaMedia.openReels` |
| Rolki-Przygotuj (frame A sheet, frame B progress) + all limit/status copy (spec §6 table) + ready toast | CLIENT-MEDIA | `NaukaMedia.prepare` |
| Podcast-Odtwarzacz, Podcast-Pauza, mini-player | CLIENT-MEDIA | `NaukaMedia.openPodcast` |
| Lis-Tryby, Lis-Wytlumacz (also used for Przepytaj), Lis-Egzamin | CLIENT-MEDIA | `NaukaMedia.openFox` |

Router views registered by `media.js`: `reelseries`, `reelplay`, `podcast`, `foxmodes`, `foxchat`, `foxresult` (all without nav).

### 4.5 `window.NaukaMedia` (CLIENT-MEDIA exports; CLIENT-CORE calls only these)

```js
window.NaukaMedia = {
  openReels(subjectId, topicId, o?),      // o = {mediaId?, reel?: n}; series screen; with o.reel → player at that reel
  openPodcast(subjectId, topicId, o?),    // o = {mediaId?, chapter?: n, play?: bool}
  openFox(subjectId, o?),                 // o = {topicId?, mode?: 'explain'|'quiz'|'exam', pointId?: enginePid, pointIds?: [enginePid]} → Lis-Tryby preselected
  prepare(subjectId, topicId, kind, o?),  // kind 'reels'|'podcast'; o = {focusPointId?: enginePid} (single reel); opens confirm sheet or busy/limit sheet
  miniPlayer(),                           // HTMLElement | null (podcast playing/paused and not closed)
  status(topicId),                        // {reels: 'none'|'running'|'ready'|'failed', podcast: …, runningMedia?: MediaRow} from the registry, for pills
};
```
If `NaukaMedia` is missing (media.js failed to load), the hub hides reels/podcast/fox entries.

### 4.6 `NAUKA_CLOUD` additions (CLIENT-CORE, `cloud.js`) — exact list

```js
api,                              // existing internal api(path, o) now exported (returns {status, data})
mediaList(),                      // Promise<MediaRow[]> — all rows of the account (REST, select of 2.5); every string field via plain(); manifest deep-cleaned (strings plain(), unknown keys dropped, file names /^[a-z0-9.]+$/, refs {level: /^[A-Za-z0-9_-]{1,40}$/, index: int 0–59})
mediaGet(id),                     // Promise<MediaRow|null>
mediaCreate(kind, body),          // kind 'reels'|'podcast'; generates requestId (uuid()), writes journal cf_media_job:<uid> with jsetHard BEFORE the POST (failure → CloudError 'storage_full', no POST), POST /api/media/<kind> (timeout 30 s). 202/200 → {media}; 4xx/5xx JSON → journal removed, CloudError(code, data); network / non-JSON → journal kept, CloudError('unknown_outcome') and polling starts
mediaChapter(mediaId, n),         // POST /api/media/podcast/chapter (timeout 130 s) → {chapter}; 409 chapter_busy → polls mediaGet every 3 s up to 120 s
mediaBlob(ownerId, mediaId, file),// Promise<Blob> via GET /storage/v1/object/authenticated/media/<owner>/<id>/<file> (Bearer, 401 → refresh once). Cached in IndexedDB 'kv' under 'm:<uid>:<id>/<file>' with an LRU index 'mi:<uid>' (evict above 150 MB)
mediaJson(ownerId, mediaId, file),// Promise<object> — JSON.parse of the blob, NOT sanitized (media.js sanitizes per schema)
mediaWatch(),                     // starts/stops polling of running rows (journal + rows with status running); emits on('media', row) on every change; on running→ready emits on('mediaReady', row)
fox(body),                        // POST /api/fox (timeout 60 s) → response object (strings NOT yet escaped; media.js escapes); errors as CloudError with code/data
```
Also in `cloud.js`: `toEngine()` adds `s.points` and topic `points`/`n`/`source` (1.2); `fetchAll()` adds (tolerant, failures ignored) `topics.generation_id` in the select, `generations?select=id,material_ids&status=eq.done` and `materials?select=id,name,mime,created_at` to fill topic `source = {kind: 'pdf'|'photos'|'pptx'|'text'|'mixed', files: [{name (plain), mime}], addedAt}`; `deleteAccount()` also deletes media files (paths from `mediaList()` manifests, bucket `media`) before the RPC; `wipeLocal()` also deletes IndexedDB keys `m:<uid>:*` and `mi:<uid>`; `me()` passes through `media`, `chat`, `features`. New localStorage keys: `cf_media_job:<uid>`.

`cloud-ui.js` (CLIENT-CORE): boot/refresh calls `mediaList()` → `NaukaEngine.setMedia(rows)` and `mediaWatch()`; on `mediaReady` → `notify('Rolki z „<material>” są gotowe. Stuknij, żeby obejrzeć.', …, {go})` (podcast: „Podcast z „<material>” jest gotowy. Stuknij, żeby posłuchać.”); `renderReady` gets the link „Zobacz przedmiot” under „ZACZNIJ NAUKĘ”; hub „Zmień nazwę i kolor” reuses the rename/colour UI (hook `subjectEdit(sid)` set by cloud-ui); `deleteSubject(id)` / `renameTopic(id, name)` / `deleteTopic(id)` in cloud.js (REST, RLS) behind `ask({danger:true})`.

---

## 5. `NaukaEngine` — dodatki (CLIENT-CORE implements, CLIENT-MEDIA uses)

Existing and unchanged: `el, icon, fox, liveFoxes, foxAct, toast, notify, openSheet, closeSheet, sheetBack, ask, shell, go, goBack, openSubject, openLevel, openTestSheet, openQuickAdd, registerView, setSubjects, upsertSubject, subjects, meta, saveMeta, pl, noEmoji, todayStr, esc, txt, native, subjShort, subjInitials, barLayout, reload, view, current`.

New (exact names and signatures):

```js
// --- icons: ICONS gains (stroke 2.6, round caps, 24 viewBox):
//     dots, reel, headphones, timer, chat, help-bubble, play, pause, rewind-15, forward-15, send, skip-down, speaker, speaker-off, clipboard, stop, scrubber-diamond
//     (lightbulb = existing 'bulb'; bookmark, book, cards, refresh, info, check, plus, close, file, moon, target, chevron-* exist)
raccoon(mood, size)                       // existing raccoon SVG (idle|angry|hit|laugh|dizzy|win)
gradeFor(sid, pct) -> {label, name}       // exGrade + Polish name: studia {'2':'niedostateczny','3':'dostateczny','3,5':'dostateczny plus','4':'dobry','4,5':'dobry plus','5':'bardzo dobry'}; liceum/podstawowka {'1':'niedostateczny','2':'dopuszczający','3':'dostateczny','4':'dobry','5':'bardzo dobry','6':'celujący'}; inne: label only
gradeScale(sid) -> [label…]               // ascending, e.g. ['2','3','3,5','4','4,5','5'] (fail label first)

// --- navigation
registerView(k, fn, {leave}?)
openSubject(sid, tab?, setup?)            // tab default 'hub'
openMaterial(sid, topicId)
openLessonAt(sid, lid, part?)             // starts the lesson (resume sheet if saved); part (0-based feed index) opens the chat at that part when the level is done, else from start
openPointSheet(sid, pid)
practicePoints(sid, pids, onDone?)        // 1.6

// --- data
subject(sid) -> s | null
topicOf(sid, topicId) -> {topic, n, levels:[engine levels], points:[Point], source} | null
levelId(topicId, rawLevelId) -> engineLid | null      // same mapping as mapLevel
pointId(topicId, rawPointId) -> enginePid | null
pointRaw(pid) -> {topicId, raw} | null
pointsOf(sid, topicId?) -> Point[]
pointState(sid, pid) -> (1.3)
masteryOf(sid, topicId?) -> (1.3)
readiness(sid, levelIds?) -> (1.4)
naTeraz(sid) -> Action[] (1.5)
masteryMarker(st) -> HTML string          // 22 px marker, aria-label „Umiem|W trakcie|Do odświeżenia|Nowe”
masteryBar(counts, {h}) -> HTML string
lessonChunk(sid, lid, feedIdx) -> {title, html /* already clean() */, lesson: n, part: n, parts: n} | null   // „Przeczytaj w lekcji 3, część 2”
lessonMinutes(lv) -> int

// --- quiz items for reels / podcast pauses / fox gaps
quizItem(sid, lid, qi) -> {q, a:[…], c, e, pm} | null // qOf + mixQ (overrides applied, answers shuffled once; strings already escaped)
recordAnswer(sid, lid, qi, ok, {source: 'reel'|'podcast'}) -> {due, box, dueText}   // srsTouch(sid,lid,'q'+qi,ok); +3 XP when ok (addXP); missionEvent/okRun like the Quiz tab; histAdd; dueText „jutro” | „za N dni” | „dziś”
makeDue(sid, pid) -> n                    // every item of the point: srs entry due = today (created with box 0 when missing); returns item count; saves
isDue(sid, pid) -> bool                   // all items due today or earlier (for „W POWTÓRCE”)

// --- media registry (rows from cloud) and progress
setMedia(rows)                            // replaces the registry; re-renders hub/material/today if visible and safe
mediaFor(sid, topicId?) -> MediaRow[]     // newest first
mediaState(mediaId) -> object             // PROGRESS.media[mediaId] or {}
setMediaState(mediaId, patch, {save=true}) // shallow merge + validate + saveProgress
foxState(key) -> object                   // key = topicId | 's:'+sid
setFoxState(key, mode, value)             // PROGRESS.fox[key][mode] = value
markOral(sid, pid, ok)                    // PROGRESS.oral
completeTask(sid, kind, x?)               // completeDaily wrapper for new kinds (reels:<id>, oral)
fmtTime(sec) -> 'm:ss'                    // „4:31”, negative → „-5:10”
dec(n, digits=1) -> string                // decimal comma „1,25”
```
Every function returns data with strings already escaped (as all engine data is); media.js must still escape strings it gets from `NAUKA_CLOUD` or Storage.

---

## 6. Briefy agentów

### 6.1 BACKEND-KEYPOINTS (repo `nauka-backend`)
Deliver 1.1 and 2.1. Steps: schema + types → outline/level/task schemas and prompts → generate.ts passes points to level/task calls and carries `p` → review keeps `p` → `buildKeyPoints` in finalize (export it) → demo → tests.
Tests (node:test, mocked Anthropic via `mock-ai.test-helper.ts`): `buildKeyPoints` cases — all items carry valid `p`; missing/unknown `p`; filtered quiz shifts indexes (refs remapped); point with 2 items merged; 17 points → 15; tiny topic (< 18 items) with 4 points kept; impossible → omitted; every quiz/flashcard exactly once, tasks at most once; schema parse with and without `keyPoints`; old fixtures still parse; `generateTopic` with mock AI returns valid keyPoints; review keeps `p`; prompt snapshots updated deliberately. Run `npm test` and `npm run typecheck`. No changes to `/api/generate` request/response shape.

### 6.2 BACKEND-MEDIA (repo `nauka-backend` + `nauka-app/backend/0010_media.sql`)
Deliver 2.2–2.9 and 3. Structure: `packages/shared/src/media.ts` (types MediaRow/ReelsManifest/PodcastManifest/Storyboard, `REEL_TYPES`, `topicPoints`, `foxContext`, `sanitizeStoryboard`, `REEL_STORYBOARD_RULES`, `REEL_EXAMPLE`, zod schemas for AI outputs, grading table); `packages/ai/src/media/` — `elevenlabs.ts` (REST client, error classification: 401/403/payment → `tts_unavailable`, 429/5xx/network → one internal retry then `tts_unavailable`, 422 → `invalid_output`), `align.ts` (alignment → words), `mp3.ts` (frame parser: duration, strip ID3/Xing, concat), `reels.ts`, `podcast.ts`, `chapter.ts`, `fox.ts`, `handlers.ts` (`handleReelsRequest`, `handlePodcastRequest`, `handleChapterRequest`, `handleFoxRequest` with injected deps: db RPCs, storage upload, AI, TTS, clock — like `pipeline.ts`); routes are thin wrappers (auth, admin client, deps, `after()`); `apps/web/src/lib/media-db.ts` (RPC wrappers, storage upload with the admin client).
Tests (node:test; all network mocked): align (tags, normalized fallback, punctuation, Polish diacritics), mp3 (duration of a known file — use `../nauka-app/test/proto/rolka/audio/rewolucja.mp3` when present, else skip; concat offsets), sanitizeStoryboard (XSS strings `<img onerror>`, `javascript:`, unknown kinds/actions, non-hex colors, huge numbers, emoji), series plan repair (coverage, distinct quizRefs, single mode), podcast outline/chapter validation (word counts, pauseAfter range), fox (turn counting per mode, untrusted user text stays data, pct averaging, schema of response), handlers (idempotent requestId → 200 without reserve; busy/limit mapping to HTTP; `after` work → finish; AI failure → release, refusal → fail; TTS 401 → release with `tts_unavailable`; deadline → release `timeout`; voices_missing before auth for podcast; chapter: cached → 200 without TTS, busy → 409, budget refused → 429 and claim released, failure → claim released), `/api/me` fields with and without RPCs. `npm test`, `npm run typecheck`, `npm run build -w @nauka/web` (no env), `npm run test:db` when Postgres is available (else report „skip”).

### 6.3 CLIENT-CORE (repo `nauka-app`)
Deliver 1.2–1.7, 4.2–4.6, 5 and the core screens of 4.4, matching makiety pixel-for-pixel in layout, copy and colours (D7, D8 button radius 18). Order of work: (1) icons, `registerView` leave hook, `NaukaEngine` data functions and stubs, script order/CSP/build (unblocks CLIENT-MEDIA and TEST); (2) cloud.js points mapping + media functions; (3) nav + hub + material + Nowy; (4) Dziś + daily plan kinds; (5) PointSheet, HowSheet, practice session, readiness in TestPlan; (6) menus (rename, delete subject/material, source sheet); (7) native background audio (`UIBackgroundModes` = `audio`; `AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)` in `AppDelegate`).
Rules: XP/gem/heart pills not on the hub; Szop strip only when ≥ 1 point `refresh` and NA TERAZ is not `szop`; invitations („PRZYGOTUJ”, Dodatki card, „ZRÓB ROLKĘ”) only when `features.reels`/`features.podcast` and `media.remaining > 0` (unknown quota = show; server checks); podcast feature off but reels on → podcast slot shows „Podcast będzie dostępny wkrótce” (no button); `media.remaining === 0` → spec copy „Rolek i podcastów na razie nie przygotujesz. Wszystko, co masz w tym przedmiocie, działa bez ograniczeń.”; „Rozmowa z lisem” tile only when `features.fox`.
Tests: `node build.js`; all existing checks green (`build7-engine`, `cloud-*`); TEST agent's new checks; manual pass in `test/dev/?mock=seeded&reset=1`.

### 6.4 CLIENT-MEDIA (repo `nauka-app`, files `media.js`, `media.css`)
Deliver the screens of 4.4 owned by media and `window.NaukaMedia` (4.5), using only `NaukaEngine` (5) and `NAUKA_CLOUD` (4.6).
- **Reel player**: port `test/proto/rolka/engine.js` + `styles.css` into `media.js`/`media.css` as a reusable instance `Reel.mount(host, {storyboard, words, audioUrl, rate, muted, onEnd, onTime})` → `{play, pause, seek, destroy, duration}`: no globals, no `document.getElementById` outside the host, all CSS scoped under `.reel`, no `fetch`, no URL params, no cover screen (playback starts from the user's tap on the series/next button), the prototype quiz replaced by the app's question card (Rolki-Pytanie) built from `NaukaEngine.quizItem(sid, lid, qi)` (lid via `levelId(topicId, quizRef.level)`), answer → `recordAnswer(…, {source:'reel'})`, line „Zapisane do punktu „<short>” · wróci <dueText> w powtórce”. No gradients/vignette/text glow (spec §4 reel palette: solid plate rgba(236,230,217,.92)). Storyboard sanitizing on load: re-validate with the same rules as `sanitizeStoryboard` (colors `#hex`, kinds, action types, string lengths) and insert text only via `esc()`/`textContent`.
- Series list (Rolki-Seria), swipe up/down between reels, side actions („Do powtórki” → `makeDue` + toast „Dodano do powtórki: <short>”; „Wyjaśnij” → pause + sheet with `lessonChunk` + „Przeczytaj w lekcji N, część M” → `openLessonAt`; „Następna”), pause hint once (`META.mediaPrefs.hint`), watched = narration reached the end (`setMediaState({w})`), question result once per reel (`q`), daily task `reels:<mediaId>` completed after one answered question per day, last reel → „ZAKOŃCZ SERIĘ” + „Przepytaj mnie z tej serii” (`openFox(sid,{mode:'quiz', pointIds})`).
- Prepare sheet (frame A: types 3–6, default 5 without „Pułapki na egzaminie”, summary rows, counter line „To jedno tworzenie rolek lub podcastu. Zostało: X z Y.” — pro: „… Zostało: X z Y w tym miesiącu.”), single mode for `focusPointId` (1 type, title „Przygotuj rolkę o „<short>””); frame B progress from `on('media')` (steps „Piszę scenariusze” / „Nagrywam lektora · k z N” / „Składam rolki”; podcast „Układam rozdziały” / „Piszę rozmowę · k z 8” / „Zapisuję”), „UCZ SIĘ DALEJ” → `goBack()`. All copy of spec §6 limit table; `unknown_outcome` → „Nie wiem jeszcze, czy przygotowanie ruszyło. Sprawdzam…” while polling; failure with `charged:false` → „Nie udało się przygotować rolek. To błąd po naszej stronie i nie zużył tworzenia.” + manual „SPRÓBUJ PONOWNIE” (new requestId).
- Podcast player (Podcast-Odtwarzacz, Podcast-Pauza): one `<audio>` element kept outside `#app` (survives re-renders), Blob URL from `mediaBlob`; chapter not synthesized → state „Nagrywam rozdział N… zwykle ok. 30 s” and one `mediaChapter` call; at chapter end while playing → next chapter (one call, no retry); speed 1,0× / 1,25× / 1,5× (`META.mediaPrefs.rate`); „Pauzy na pytania” switch (`qEnd`) — off = questions collected at the end of the chapter; pause sheet with `lead` + existing quiz item, „Pomiń”, „SŁUCHAJ DALEJ” disabled until answered; live transcript from `cN.json` (+ `script.json` text, `**term**` → highlighted after `esc`); chapters list; scrubber with diamonds at pauses; ±15 s; mini-player (`miniPlayer()`); Media Session metadata (title, artist „Lis i Szop”) when available.
- Fox (Lis-Tryby, chat, result): scope chips (subject, each material, „Słabe punkty · N” = refresh + learning), mode cards, point chips sorted weakest first (explain only), quota line rules (0.3), chat with feedback card (DOBRZE/LUKA/POMYŁKA chips), source link via `levelId`, quick chips „Podpowiedz” / „Nie wiem”, input bar without mic, „Zakończ”; exam result with grade from `gradeFor`, scale strip from `gradeScale`, per-question rows, „DO POPRAWY” cards: „DODAJ DO POWTÓRKI” ↔ „W POWTÓRCE” (`makeDue`/`isDue`), „OBEJRZYJ ROLKĘ k/N” when a ready reel covers the point, else „ZRÓB ROLKĘ Z TEGO” (only with remaining creations) → `prepare(..., 'reels', {focusPointId})`; writes `setFoxState`, `markOral`, daily `oral`.
Tests: render with mock (TEST agent fixtures), XSS storyboard/transcript/fox reply fixtures must not execute, timing check like the prototype (`check-audio` idea: reel clock vs `audio.currentTime` within 50 ms on the fixture mp3), no horizontal scroll at 360 px, reduced motion respected (no camera shake/flash when `reduce-motion`).

### 6.5 TEST (repo `nauka-app/test`)
- `mock-backend.js`: REST `media` (select/filters as 2.5), Storage `object/authenticated/media/...` (serves `test/fixtures/media/**`), `DELETE object/media`, `/api/media/reels`, `/api/media/podcast` (202, then the row walks `plan → script → voice → save → ready` over `mediagen=fast|slow:N` seconds), `/api/media/podcast/chapter` (returns chapter from fixtures; `chapter=busy|err:CODE|slow:N`), `/api/fox` (scripted replies per mode/step, quota counting), `/api/me` `media`/`chat`/`features`. Params: `media=none|running|ready|failed`, `mq=N` (remaining creations), `mplan=free|pro`, `mediaerr=CODE[:charged]` (`busy`, `limit_reached:lifetime|month|daily|global`, `tts_unavailable`, `voices_missing`, `ai_unavailable`, `unknown`), `voices=0` (podcast feature off), `fox=0`, `chat=N` (remaining), `foxerr=CODE`, `nomedia=1` (backend without 0010: `media:null`). Every POST logged; `MOCK.posts(kind)` count.
- Fixtures: `topic-msgip.json` (spec §3 data: 4 levels, 13 keyPoints with valid refs, quiz/flashcards counts 36/46, tasks 14); `media/` — reels manifest + 5 storyboards in app format (derived from `test/proto/rolka/storyboards/fotosynteza.json` and `rewolucja.json`, without `quiz`, with `quizRef`), one shared mp3 (copy of `test/proto/rolka/audio/rewolucja.mp3`) + words; podcast manifest + `script.json` (8 chapters) + 2 synthesized chapters (`c1`, `c2`: mp3 copy + timing JSON); XSS variants (titles, labels, card lines, transcript, fox reply with `<img src=x onerror=window.__pwned=1>`); seeded account: MSGiP subject with progress matching spec §3 (U 6 · W 2 · R 2 · N 3 via srs entries with due dates relative to „today” of the mock clock).
- Checks: `hub.mjs` (nav labels, hub sections order, mastery counts 6/2/2/3 for material 01, NA TERAZ priority cases incl. exam today/tomorrow, interrupted lesson, ≥2 refresh, all known → oral, readiness „?” below 10 answers, old topic fallback = one point per level, Centrum-Nowy, invitations hidden at `mq=0`, podcast „wkrótce” with `voices=0`), `media.mjs` (prepare → exactly one POST per tap, no retry on error or reload, busy/limit copy, progress steps, ready toast, series → player → question → SRS key written `sid:lid:qN`, watched state, swipe, podcast chapter synth on start only, pause question writes SRS, position saved, mini-player on other tabs, account deletion deletes media files), `fox.mjs` (modes, quota line, chat errors, exam result grade per scale, gaps buttons), `keypoints.mjs` (sanitizer: XSS in keyPoints titles, bad refs dropped, duplicate refs, <3 items merged, CSP has `media-src blob:` in build). All checks also assert: no emoji in UI text, no word matching `/\b(pro|premium|płat|cen[ay]|kup|subskryp|zł)\w*/i` in visible UI, `window.__pwned` undefined, no horizontal scroll, no request outside localhost.
- `shoot.mjs`: scenarios `hub` (Main, Material, Nowy, HowSheet, PointSheet), `reels` (Seria, Odtwarzacz at a fixed `t`, Pytanie answered, Przygotuj A and B), `podcast` (Odtwarzacz, Pauza, mini-player), `fox` (Tryby, Wytłumacz, Egzamin), `today` (Dzis) — 390×844 to compare with makiety.
- Update `test/dev/README.md` with the new params and checks.

---

## 7. Integracja (lider, po pracy agentów)

1. Backend: `npm test`, `npm run typecheck`, `npm run build -w @nauka/web` (bez env), `npm run test:db` (lokalny Postgres). Przegląd `git diff` obu agentów backendu na kolizje w `index.ts`.
2. Apka: `node build.js` (CSP z `media-src blob:`, `media.js` między `engine.js` a `cloud-ui.js`, `media.css` w stylach); `cd test && node dev/checks/*.mjs` — wszystkie zielone; `node dev/shoot.mjs --only hub,reels,podcast,fox,today` i porównanie z `design/centrum/*.dc.html`.
3. Zgodność kontraktów: kształt `MediaRow`/manifestów w `packages/shared/src/media.ts` = sanitizer w `cloud.js` = fixture'y TEST; kody błędów 2.2–2.6 obsłużone w `media.js` (tabela copy) i w atrapie.
4. Stare dane: konto z tematami bez `keyPoints` (fixtures `topic-makro`, `topic-krypto`) — hub z punktami na poziom, bez błędów; stary zapis postępów bez `media`/`oral`/`fox` działa; dawne zadania planu dnia (`quiz`, `exam`) nadal się wyświetlają w dniu, w którym zostały zapisane.
5. Bezpieczeństwo: każdy nowy string z bazy/Storage/API przez `clean()`/`esc()`/`plain()` (grep po `innerHTML` w `media.js` i nowych częściach `engine.js`); fixture'y XSS bez `__pwned`; RLS `media` i bucket `media` sprawdzone w db-test.
6. Copy: brak słów o płatnościach/Pro (check), polskie przecinki dziesiętne, „…” w cudzysłowach, brak emoji, brak UI mikrofonu.
7. Limity: jedno `POST` na stuknięcie, brak automatycznych ponowień (log atrapy), licznik tylko w arkuszu potwierdzenia, zaproszenia znikają przy 0 tworzeń.
8. iOS: `cd native && npm run sync`, symulator na atrapie niemożliwy — na prawdziwym backendzie dopiero po 0010 i wdrożeniu (decyzja właściciela). Sprawdzić odtwarzanie Blob audio w WKWebView, dźwięk przy zablokowanym ekranie (`UIBackgroundModes audio`), wydajność SVG świata rolki na starszym iPhonie.
9. Dokumentacja (lider): `docs/BIBLIA.md` (nowe sekcje: punkty, opanowanie, media, rozmowa z lisem, 0010, zmienne środowiskowe), `CLAUDE.md` (skrypt `media.js`, bucket `media`, limity mediów i czatu), `nauka-backend/docs/DEPLOY.md` (kolejność 0010 → backend → apka, zmienne).
10. Kolejność wdrożenia (decyzja właściciela, nie agentów): 0010 → backend (z kluczami ElevenLabs i głosami) → TestFlight z nową apką.
