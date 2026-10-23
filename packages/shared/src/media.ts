import { z } from "zod";

/**
 * Cramfox media contract (plan: nauka-app/docs/plan-media.md §1.1, §2.2–2.7): reel series, the Lis + Szop podcast and
 * the fox conversation. Shared by the API (`@nauka/ai` media handlers) and its tests; the app mirrors these shapes in
 * `cloud.js` / `media.js`. Everything here is pure (no I/O).
 *
 * Key points are read TOLERANTLY from `content.keyPoints` (`topicPoints`) — this module never imports the key-point
 * types of `schema.ts`, so an old topic (no keyPoints) and a topic with broken refs both work: one point per level.
 */

/* ======================================================================================================== rows */

export const MEDIA_KINDS = ["reels", "podcast"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export type MediaStatus = "running" | "ready" | "failed";
export type MediaStep = "plan" | "script" | "voice" | "save";

export interface MediaProgress {
  step: MediaStep;
  done: number;
  total: number;
}

/** A `public.media` row as clients read it (PostgREST select of {@link MEDIA_COLUMNS}, RLS: owner only). */
export interface MediaRow {
  /** = the client's requestId (idempotency key) */
  id: string;
  owner_id: string;
  subject_id: string;
  topic_id: string;
  kind: MediaKind;
  status: MediaStatus;
  phase: string | null;
  progress: MediaProgress | null;
  title: string | null;
  spec: Record<string, unknown>;
  manifest: ReelsManifest | PodcastManifest | null;
  /** `<code>:<detail>`; a refunded failure starts with `released:` (then `charged` is false) */
  error: string | null;
  charged: boolean;
  created_at: string;
  finished_at: string | null;
}

/** Columns granted to `authenticated` by backend/0010 (the client must select exactly these, never `*`). */
export const MEDIA_COLUMNS = "id,owner_id,subject_id,topic_id,kind,status,phase,progress,title,spec,manifest,error,charged,created_at,finished_at";

/** Storage bucket of reels and podcasts (private; `{uid}/{mediaId}/{file}`, written only by the service role). */
export const MEDIA_BUCKET = "media";
/** File names inside a media folder (`r1.json`, `r1.mp3`, `c3.json`, `script.json`). */
export const MEDIA_FILE_RE = /^[a-z0-9.]+$/;

export function mediaPath(ownerId: string, mediaId: string, file: string): string {
  if (!MEDIA_FILE_RE.test(file)) throw new Error(`bad media file name: ${file}`);
  return `${ownerId}/${mediaId}/${file}`;
}

/* ===================================================================================================== reels */

export const REEL_TYPES = ["czym", "kto", "mit", "porownanie", "pulapki", "sprawdzian"] as const;
export type ReelType = (typeof REEL_TYPES)[number];

/** Chip labels (UI, caps). */
export const REEL_TYPE_LABELS: Record<ReelType, string> = {
  czym: "CZYM TO JEST",
  kto: "KTO JEST KIM",
  mit: "MIT CZY FAKT",
  porownanie: "PORÓWNANIE",
  pulapki: "PUŁAPKI NA EGZAMINIE",
  sprawdzian: "NA SPRAWDZIAN",
};

/** What each type of reel does (for the AI prompts). */
export const REEL_TYPE_BRIEFS: Record<ReelType, string> = {
  czym: "CZYM TO JEST — jedno pojęcie albo zjawisko: definicja własnymi słowami, jak działa, jeden mocny przykład z materiału.",
  kto: "KTO JEST KIM — kilka postaci, instytucji, organów albo elementów: kto co robi i czym się różnią role; świat jako mapa stacji.",
  mit: "MIT CZY FAKT — hak obala popularne błędne przekonanie z tego materiału; potem poprawna wersja i dlaczego mit kusi.",
  porownanie: "PORÓWNANIE — dwie (najwyżej trzy) rzeczy obok siebie: wspólne cechy, kluczowe różnice, jak ich nie pomylić.",
  pulapki: "PUŁAPKI NA EGZAMINIE — typowe pomyłki i podchwytliwe rozróżnienia z materiału; jak je rozpoznać na sprawdzianie.",
  sprawdzian: "NA SPRAWDZIAN — krótka lista rzeczy, które trzeba umieć (3–5), każda z jednym konkretem; na końcu szybkie podsumowanie.",
};

/** Default series (5 reels, without „Pułapki na egzaminie”). */
export const DEFAULT_REEL_TYPES: readonly ReelType[] = ["czym", "kto", "mit", "porownanie", "sprawdzian"];
/** Station colours used as reel thumbnails. */
export const REEL_THUMBS = ["#2F6BFF", "#1F8A5B", "#E9A23B", "#E0483F"] as const;
/** Playback rate of the reel narration (voice „Dawid” at 1.15 ≈ 45–60 s for 80–130 words). */
export const REEL_RATE = 1.15;
/** Allowed ElevenLabs v4 audio tags in `tts` (anything else is removed). */
export const TTS_TAGS = ["[excited]", "[whispers]", "[laughs softly]", "[sarcastic]", "[dramatically]", "[short pause]"] as const;

export interface QuizRef {
  level: string;
  index: number;
}
export type FeedRef = QuizRef;

export interface ReelEntry {
  /** 1-based position in the series */
  n: number;
  type: ReelType;
  title: string;
  /** playback length in seconds at `rate` (audio duration ÷ rate), 0.1 s */
  durSec: number;
  /** raw point ids of the topic (`p3`, fallback `Ll2`) */
  pointIds: string[];
  /** end question = an existing quiz item of this topic (`levels[level].quiz[index]`) */
  quizRef: QuizRef;
  /** lesson chunk for „Wyjaśnij” (`levels[level].feed[index]`) */
  feedRef: FeedRef | null;
  files: { storyboard: string; audio: string; words: string };
  rate: number;
  thumb: string;
}

export interface ReelsManifest {
  v: 1;
  kind: "reels";
  title: string;
  topicId: string;
  coverage: { points: number; covered: number };
  reels: ReelEntry[];
}

/* =================================================================================================== podcast */

export type Speaker = "lis" | "szop";
export interface PodcastLine {
  s: Speaker;
  /** plain text; `**term**` marks a highlighted term (no other markup) */
  t: string;
}

export interface PodcastPause {
  /** 0-based index of the line (the Szop's mistake) after which playback stops for the question */
  afterLine: number;
  quizRef: QuizRef;
  pointId: string;
  /** what the Szop just got wrong, said by the fox before the question (≤ 160) */
  lead: string;
}

export type ChapterStatus = "script" | "synth" | "ready";
export interface PodcastChapter {
  n: number;
  title: string;
  pointIds: string[];
  levelIds: string[];
  /** estimated length (words ÷ 2.3) */
  estSec: number;
  /** real length once synthesized, else null */
  durSec: number | null;
  status: ChapterStatus;
  pauses: PodcastPause[];
  files: { audio: string; timing: string } | null;
  /** ISO time of the running synthesis (server only, status `synth`) */
  synthAt?: string;
}

export interface PodcastManifest {
  v: 1;
  kind: "podcast";
  title: string;
  topicId: string;
  estSec: number;
  files: { script: string };
  chapters: PodcastChapter[];
}

export interface PodcastScript {
  v: 1;
  title: string;
  chapters: { n: number; title: string; lines: PodcastLine[] }[];
}

/** Words per second used for podcast estimates. */
export const PODCAST_WORDS_PER_SEC = 2.3;

/* =================================================================================================== timings */

export interface WordTiming {
  w: string;
  start: number;
  end: number;
  /** an audio tag (`[excited]`), not spoken */
  tag?: true;
}
/** `rN.words.json` (same shape as the prototype's `audio/*.words.json`, plus `v`). */
export interface WordsFile {
  v: 1;
  duration: number;
  words: WordTiming[];
}
/** `cN.json` — one podcast chapter's audio timing. */
export interface ChapterTiming {
  v: 1;
  duration: number;
  lines: { i: number; s: Speaker; start: number; end: number; words: { w: string; start: number; end: number }[] }[];
  pauses: { afterLine: number; at: number }[];
}

/* ==================================================================================================== quotas */

export type MediaScope = "lifetime" | "month";

/** `media` in `GET /api/me` (RPC `media_quota`, backend/0010). */
export interface MediaQuota {
  plan: "free" | "pro";
  scope: MediaScope;
  used: number;
  limit: number;
  remaining: number;
  /** creations the account may still start in the rolling 24 h (abuse guard, counts failed ones) */
  dailyLeft: number;
  globalOpen: boolean;
  /** the running creation; topicId null when its material was deleted during the job (the reservation still holds) */
  busy: { id: string; kind: MediaKind; topicId: string | null } | null;
}

/** `chat` in `GET /api/me` and `quota` in `POST /api/fox` (RPC `chat_quota` / `reserve_chat`). */
export interface ChatQuota {
  /** Warsaw date of the counter (yyyy-mm-dd) */
  day: string;
  used: number;
  limit: number;
  remaining: number;
  globalOpen?: boolean;
}

export interface MediaFeatures {
  reels: boolean;
  podcast: boolean;
  fox: boolean;
}

const nonNeg = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

/** Validates `media_quota`'s answer; null when it is not one. */
export function parseMediaQuota(raw: unknown): MediaQuota | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const scope = r.scope === "lifetime" || r.scope === "month" ? r.scope : null;
  const used = nonNeg(r.used);
  const limit = nonNeg(r.limit);
  if (!scope || used === null || limit === null) return null;
  const b = r.busy as Record<string, unknown> | null | undefined;
  const busy =
    b && typeof b === "object" && typeof b.id === "string" && (b.kind === "reels" || b.kind === "podcast")
      ? { id: b.id, kind: b.kind as MediaKind, topicId: typeof b.topicId === "string" ? b.topicId : null }
      : null;
  return {
    plan: r.plan === "pro" ? "pro" : "free",
    scope,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    dailyLeft: nonNeg(r.dailyLeft) ?? 0,
    globalOpen: r.globalOpen !== false,
    busy,
  };
}

/** Validates `chat_quota` / `reserve_chat`; null when it is not one. */
export function parseChatQuota(raw: unknown): ChatQuota | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const used = nonNeg(r.used);
  const limit = nonNeg(r.limit);
  const day = typeof r.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.day) ? r.day : null;
  if (used === null || limit === null || !day) return null;
  return { day, used, limit, remaining: Math.max(0, limit - used), ...(typeof r.globalOpen === "boolean" ? { globalOpen: r.globalOpen } : {}) };
}

/* ====================================================================================================== text */

const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{FE0E}\u{200D}\u{20E3}]/gu;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]/g;

export function stripEmoji(s: string): string {
  return s.replace(EMOJI_RE, "");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** HTML (lesson doses) → plain text: tags removed, basic entities decoded, whitespace collapsed. */
export function stripHtml(html: string): string {
  return String(html ?? "")
    .replace(/<\s*(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 31 && code < 0x110000 ? String.fromCodePoint(code) : " ";
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * AI or database text for storage and display as PLAIN text: no `<` / `>`, no emoji, no control characters,
 * whitespace collapsed, cut to `max` characters (with „…” when cut). The app still escapes it (`esc()` / textContent).
 */
export function cleanText(s: unknown, max: number): string {
  if (typeof s !== "string" && typeof s !== "number") return "";
  let t = stripEmoji(String(s)).replace(CONTROL_RE, " ").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (t.length > max) t = `${t.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
  return t;
}

/** Words of a text (for counts): whitespace-separated tokens with at least one letter or digit. */
export function countWords(s: string): number {
  return s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/* ================================================================================================ topic data */

export interface TopicLevelView {
  id: string;
  title: string;
  feed: { title: string; body: string }[];
  flashcards: { t: string; d: string }[];
  quiz: { q: string; a: string[]; c: number; e: string }[];
  tasks: { type: string; title?: string }[];
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Levels of a `topics.content` (tolerant: anything malformed becomes empty). */
export function topicLevels(content: unknown): TopicLevelView[] {
  return arr(obj(content).levels)
    .map((raw) => {
      const l = obj(raw);
      return {
        id: str(l.id),
        title: str(l.title),
        feed: arr(l.feed).map((f) => ({ title: str(obj(f).title), body: str(obj(f).body) })),
        flashcards: arr(l.flashcards).map((f) => ({ t: str(obj(f).t), d: str(obj(f).d) })),
        quiz: arr(l.quiz).map((q) => {
          const o = obj(q);
          return { q: str(o.q), a: arr(o.a).map(str), c: typeof o.c === "number" ? o.c : 0, e: str(o.e) };
        }),
        tasks: arr(l.tasks).map((t) => ({ type: str(obj(t).type), title: str(obj(t).title) || undefined })),
      };
    })
    .filter((l) => l.id);
}

export function topicName(content: unknown): string {
  return str(obj(content).name);
}

export type PointItemKind = "quiz" | "flashcard" | "task";
export interface PointItem {
  kind: PointItemKind;
  level: string;
  index: number;
}

/** A key point as both server and app see it after validation (plan §1.1 / §1.2). */
export interface TopicPoint {
  /** raw id: `p1`…`p15`, or `L<levelId>` for the per-level fallback */
  id: string;
  title: string;
  /** chip label, ≤ 24 */
  short: string;
  summary: string;
  /** level ids of the items, in level order */
  levels: string[];
  items: PointItem[];
  /** fallback point (one per level) */
  fb: boolean;
}

const POINT_ID_RE = /^p\d{1,2}$/;
const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

function arrayFor(level: TopicLevelView, kind: PointItemKind): unknown[] {
  return kind === "quiz" ? level.quiz : kind === "flashcard" ? level.flashcards : level.tasks;
}

/** One point per level: all flashcards + quiz + tasks of that level. */
export function fallbackPoints(content: unknown): TopicPoint[] {
  return topicLevels(content).map((l) => {
    const title = cleanText(l.title, 120) || l.id;
    return {
      id: `L${l.id}`,
      title,
      short: cut(title, 24),
      summary: "",
      levels: [l.id],
      items: [
        ...l.flashcards.map((_, index) => ({ kind: "flashcard" as const, level: l.id, index })),
        ...l.quiz.map((_, index) => ({ kind: "quiz" as const, level: l.id, index })),
        ...l.tasks.map((_, index) => ({ kind: "task" as const, level: l.id, index })),
      ],
      fb: true,
    };
  });
}

const srsAble = (p: { items: PointItem[] }) => p.items.filter((i) => i.kind !== "task").length;
const validPoint = (p: { items: PointItem[] }) => p.items.length >= 3 && srsAble(p) >= 2;

/**
 * Key points of a topic, validated exactly like the app's `mapPoints` (plan §1.2), so raw point ids agree on both sides:
 *  1. refs to an unknown level or an index out of range are dropped; a ref already used by an earlier point is dropped;
 *  2. quiz / flashcard items no point covers go to a fallback-style point of their level (`L<level>`), appended;
 *  3. a point with < 3 items or < 2 quiz/flashcard items is merged into the next point (the previous one when last);
 *  4. fewer than 3 points left → the whole topic uses {@link fallbackPoints}. The on-demand per-level points of step 2 count
 *     towards these 3 (the app reads it the same way).
 * A point whose title and short are both empty after cleaning is dropped before step 1 (its items go to step 2).
 * Tasks count towards a point's size whatever their type (the app keeps unsupported task types as `_skip` and counts them
 * too), so both sides merge the same points and agree on the raw ids. Strings are cleaned and cut (title 120, short 24,
 * summary 300). Never throws.
 */
export function topicPoints(content: unknown): TopicPoint[] {
  const levels = topicLevels(content);
  const raw = obj(content).keyPoints;
  if (!Array.isArray(raw) || !raw.length) return fallbackPoints(content);
  const byId = new Map(levels.map((l) => [l.id, l]));
  const order = new Map(levels.map((l, i) => [l.id, i]));
  const seen = new Set<string>();
  const ids = new Set<string>();
  let points: TopicPoint[] = [];
  for (const rp of raw) {
    const p = obj(rp);
    const id = str(p.id);
    if (!POINT_ID_RE.test(id) || ids.has(id)) continue;
    // a point without any readable title is dropped (its items fall back to their level's point) — same as the app
    const title = cleanText(p.title, 120) || cleanText(p.short, 120);
    if (!title) continue;
    const items: PointItem[] = [];
    for (const ri of arr(p.items)) {
      const it = obj(ri);
      const kind = it.kind === "quiz" || it.kind === "flashcard" || it.kind === "task" ? it.kind : null;
      const level = str(it.level);
      const index = typeof it.index === "number" && Number.isInteger(it.index) ? it.index : -1;
      const lv = byId.get(level);
      if (!kind || !lv || index < 0 || index >= arrayFor(lv, kind).length) continue;
      const key = `${kind}:${level}:${index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ kind, level, index });
    }
    ids.add(id);
    const short = cut(cleanText(p.short, 60) || title, 24);
    points.push({ id, title, short, summary: cleanText(p.summary, 300), levels: [], items, fb: false });
  }
  // 2) uncovered quiz / flashcards → a fallback-style point of their level
  const extra = new Map<string, TopicPoint>();
  for (const l of levels) {
    for (const kind of ["flashcard", "quiz"] as const) {
      arrayFor(l, kind).forEach((_, index) => {
        if (seen.has(`${kind}:${l.id}:${index}`)) return;
        let p = extra.get(l.id);
        if (!p) {
          const title = cleanText(l.title, 120) || l.id;
          p = { id: `L${l.id}`, title, short: cut(title, 24), summary: "", levels: [], items: [], fb: true };
          extra.set(l.id, p);
        }
        p.items.push({ kind, level: l.id, index });
      });
    }
  }
  points = [...points, ...extra.values()];
  // 3) merge small points into the next one (the previous one when last)
  for (let guard = 0; guard < 100; guard++) {
    const i = points.findIndex((p) => !validPoint(p));
    if (i < 0 || points.length < 2) break;
    const small = points[i]!;
    const target = i + 1 < points.length ? points[i + 1]! : points[i - 1]!;
    target.items = [...target.items, ...small.items];
    points.splice(i, 1);
  }
  // 4) too few valid points → fallback
  if (points.length < 3 || points.some((p) => !validPoint(p))) return fallbackPoints(content);
  for (const p of points) {
    p.items.sort((a, b) => (order.get(a.level)! - order.get(b.level)!) || 0);
    p.levels = [...new Set(p.items.map((i) => i.level))].sort((a, b) => order.get(a)! - order.get(b)!);
  }
  return points;
}

/** Number of quiz items of a topic. */
export function quizCount(content: unknown): number {
  return topicLevels(content).reduce((n, l) => n + l.quiz.length, 0);
}

/** `l2#q3` (quiz), `l2#k1` (flashcard), `l2#f0` (lesson part), `l2#t4` (task) — labels used in AI prompts. */
export function itemLabel(kind: "quiz" | "flashcard" | "feed" | "task", level: string, index: number): string {
  return `${level}#${kind === "quiz" ? "q" : kind === "flashcard" ? "k" : kind === "feed" ? "f" : "t"}${index}`;
}

/** Inverse of {@link itemLabel}; null when the label is malformed. Tolerates spaces and a `[`…`]` wrapper. */
export function parseItemLabel(label: unknown): { kind: "quiz" | "flashcard" | "feed" | "task"; level: string; index: number } | null {
  const m = /^\[?\s*([^#\s[\]]{1,40})\s*#\s*([qkft])(\d{1,3})\s*\]?$/.exec(str(label).trim());
  if (!m) return null;
  const kind = m[2] === "q" ? "quiz" : m[2] === "k" ? "flashcard" : m[2] === "f" ? "feed" : "task";
  return { kind, level: m[1]!, index: Number(m[3]) };
}

/** True when `levels[level].quiz[index]` exists. */
export function quizExists(content: unknown, ref: QuizRef): boolean {
  const l = topicLevels(content).find((x) => x.id === ref.level);
  return !!l && Number.isInteger(ref.index) && ref.index >= 0 && ref.index < l.quiz.length;
}

export function feedExists(content: unknown, ref: FeedRef): boolean {
  const l = topicLevels(content).find((x) => x.id === ref.level);
  return !!l && Number.isInteger(ref.index) && ref.index >= 0 && ref.index < l.feed.length;
}

/**
 * The topic as compact text for the reel / podcast prompts: points with their item labels, then each lesson with its
 * parts (HTML stripped), flashcards and quiz items with the correct answer and explanation. Over `maxChars` the lesson
 * parts are shortened first, then flashcards are left out, then the text is cut.
 */
export function topicDigest(content: unknown, opts: { stage?: string; maxChars?: number } = {}): string {
  const max = opts.maxChars ?? 80_000;
  const levels = topicLevels(content);
  const points = topicPoints(content);
  const build = (feedMax: number, cards: boolean) => {
    const out: string[] = [];
    out.push(`MATERIAŁ: „${cleanText(topicName(content), 160)}”${opts.stage ? ` (etap: ${opts.stage})` : ""}`);
    out.push("", "KLUCZOWE PUNKTY (id: tytuł [skrót] — elementy):");
    for (const p of points) {
      const items = p.items.filter((i) => i.kind !== "task").map((i) => itemLabel(i.kind === "quiz" ? "quiz" : "flashcard", i.level, i.index));
      out.push(`${p.id}: ${p.title} [${p.short}] — lekcje ${p.levels.join(", ")}; ${items.join(", ")}`);
    }
    levels.forEach((l, li) => {
      out.push("", `=== LEKCJA ${li + 1} (id ${l.id}): ${cleanText(l.title, 160)}`);
      l.feed.forEach((f, i) => out.push(`[${itemLabel("feed", l.id, i)}] ${cleanText(f.title, 160)}: ${cleanText(stripHtml(f.body), feedMax)}`));
      if (cards && l.flashcards.length) {
        out.push("Fiszki:");
        l.flashcards.forEach((f, i) => out.push(`[${itemLabel("flashcard", l.id, i)}] ${cleanText(stripHtml(f.t), 200)} — ${cleanText(stripHtml(f.d), 400)}`));
      }
      if (l.quiz.length) {
        out.push("Pytania quizu:");
        l.quiz.forEach((q, i) =>
          out.push(`[${itemLabel("quiz", l.id, i)}] ${cleanText(stripHtml(q.q), 400)} | odpowiedź: ${cleanText(stripHtml(q.a[q.c] ?? ""), 200)} | wyjaśnienie: ${cleanText(stripHtml(q.e), 400)}`),
        );
      }
    });
    return out.join("\n");
  };
  for (const [feedMax, cards] of [
    [4000, true],
    [1200, true],
    [600, true],
    [400, false],
    [200, false],
  ] as const) {
    const t = build(feedMax, cards);
    if (t.length <= max) return t;
  }
  return build(200, false).slice(0, max);
}

/* ============================================================================================== fox context */

export interface FoxTopicInput {
  topicId: string;
  /** 1-based chapter number of the material in the subject (labels `T<n>`) */
  n: number;
  content: unknown;
}

/** Labels in the fox context: `T1.l2.f1` (lesson 2's part 2), `T1.l2.q3` (quiz item), `T1.p3` (key point). */
export function foxFeedLabel(n: number, level: string, index: number): string {
  return `T${n}.${level}.f${index}`;
}
export function foxPointLabel(n: number, pointId: string): string {
  return `T${n}.${pointId}`;
}

/** `T1.l3.f1` → {n:1, level:"l3", index:1} (also `.q` items); null when malformed. */
export function parseFoxItemLabel(label: unknown): { n: number; level: string; kind: "feed" | "quiz"; index: number } | null {
  const m = /^\[?\s*T(\d{1,2})\.(.{1,40})\.([fq])(\d{1,3})\s*\]?$/.exec(str(label).trim());
  if (!m) return null;
  return { n: Number(m[1]), level: m[2]!, kind: m[3] === "f" ? "feed" : "quiz", index: Number(m[4]) };
}

/** `T1.p3` / `T2.Ll2` → {n, point}; null when malformed. */
export function parseFoxPointLabel(label: unknown): { n: number; point: string } | null {
  const m = /^\[?\s*T(\d{1,2})\.(p\d{1,2}|L[^\s\]]{1,40})\s*\]?$/.exec(str(label).trim());
  if (!m) return null;
  return { n: Number(m[1]), point: m[2]! };
}

/**
 * Grounding text for the fox (plan §2.6): titles, lesson parts (HTML stripped), flashcards and quiz items with `e`,
 * every piece labelled. `pointIds` (`<topicId>:<rawPointId>`) narrows a topic to those points' items and their levels'
 * lesson parts; topics without a selected point are included whole. Fits `maxChars` by shortening lesson parts, then
 * leaving out flashcards, then the later levels of each topic.
 */
export function foxContext(topics: FoxTopicInput[], pointIds: string[] = [], maxChars = 60_000): string {
  const selected = new Map<string, Set<string>>();
  for (const pid of pointIds) {
    const i = pid.lastIndexOf(":");
    if (i <= 0) continue;
    const t = pid.slice(0, i);
    if (!selected.has(t)) selected.set(t, new Set());
    selected.get(t)!.add(pid.slice(i + 1));
  }
  const build = (feedMax: number, cards: boolean, maxLevels: number) => {
    const out: string[] = [];
    for (const tp of topics) {
      const levels = topicLevels(tp.content);
      const points = topicPoints(tp.content);
      const sel = selected.get(tp.topicId);
      const chosen = sel ? points.filter((p) => sel.has(p.id)) : points;
      const itemKeys = sel ? new Set(chosen.flatMap((p) => p.items.map((i) => `${i.kind}:${i.level}:${i.index}`))) : null;
      const levelIds = sel ? new Set(chosen.flatMap((p) => p.levels)) : null;
      out.push(`## MATERIAŁ T${tp.n}: ${cleanText(topicName(tp.content), 160)}`);
      out.push("Kluczowe punkty:");
      for (const p of chosen) out.push(`[${foxPointLabel(tp.n, p.id)}] ${p.title}${p.summary ? ` — ${p.summary}` : ""}`);
      let shown = 0;
      levels.forEach((l, li) => {
        if (levelIds && !levelIds.has(l.id)) return;
        if (shown >= maxLevels) return;
        shown++;
        out.push(`### Lekcja ${li + 1}: ${cleanText(l.title, 160)} [T${tp.n}.${l.id}]`);
        l.feed.forEach((f, i) => out.push(`[${foxFeedLabel(tp.n, l.id, i)}] część ${i + 1}: ${cleanText(f.title, 160)}. ${cleanText(stripHtml(f.body), feedMax)}`));
        const cardsIn = l.flashcards.map((f, i) => ({ f, i })).filter(({ i }) => !itemKeys || itemKeys.has(`flashcard:${l.id}:${i}`));
        if (cards && cardsIn.length) {
          out.push("Fiszki:");
          for (const { f } of cardsIn) out.push(`- ${cleanText(stripHtml(f.t), 200)}: ${cleanText(stripHtml(f.d), 400)}`);
        }
        const quizIn = l.quiz.map((q, i) => ({ q, i })).filter(({ i }) => !itemKeys || itemKeys.has(`quiz:${l.id}:${i}`));
        if (quizIn.length) {
          out.push("Pytania z lekcji:");
          for (const { q, i } of quizIn)
            out.push(`[T${tp.n}.${l.id}.q${i}] ${cleanText(stripHtml(q.q), 400)} Poprawnie: ${cleanText(stripHtml(q.a[q.c] ?? ""), 200)}. ${cleanText(stripHtml(q.e), 400)}`);
        }
      });
      out.push("");
    }
    return out.join("\n").trim();
  };
  for (const [feedMax, cards, maxLevels] of [
    [4000, true, 99],
    [900, true, 99],
    [500, false, 99],
    [300, false, 6],
    [300, false, 3],
    [200, false, 2],
  ] as const) {
    const t = build(feedMax, cards, maxLevels);
    if (t.length <= maxChars) return t;
  }
  return build(200, false, 1).slice(0, maxChars);
}

/* ========================================================================================== reel storyboard */

/** Prop library of the reel engine (prototype README „Biblioteka rekwizytów”); anything else is drawn as `house`. */
export const PROP_KINDS = [
  "house", "tower", "hall", "palace", "fortress", "factory", "school", "server", "crowd", "people", "person", "pair", "document", "crown",
  "scales", "clock", "globe", "book", "trees", "tree-cluster", "tree", "flag", "cell", "sun", "plant", "water", "vault", "field", "cloud",
  "crate", "bubbles", "billboard", "bar", "node", "gear", "recycle",
] as const;
/** Action types of the reel engine (README „Akcje”). */
export const ACTION_TYPES = ["label", "card", "strike", "packet", "badge", "prop", "state", "burst", "tone", "tint", "recap", "tunnel", "highlight", "cam", "impact", "chapter", "fox", "cutaway"] as const;
export const CUTAWAY_KINDS = ["phone", "dots", "arc", "tiles", "zoomin", "calendar"] as const;
export const FOX_POSES = ["point", "shrug", "think", "thumbs", "celebrate", "wave", "startle"] as const;
export const SFX_KINDS = ["pop", "pop2", "whoosh", "thud", "scratch", "chime", "tick", "none"] as const;

/** Text limits of the storyboard sanitizer (plan §2.2). */
export const STORYBOARD_LIMITS = { title: 60, label: 40, cardLine: 60, cutaway: 80, say: 400, tts: 600, stations: 16, roads: 32, zones: 6, scenes: 16, actions: 24 } as const;

export interface StoryboardStation {
  id: string;
  kind: string;
  label?: string;
  x: number;
  y: number;
  [k: string]: unknown;
}
export interface StoryboardScene {
  say: string;
  tts?: string;
  cam?: Record<string, unknown> | "keep";
  hold?: number;
  actions: Record<string, unknown>[];
}
export interface Storyboard {
  title: string;
  maxLabels?: number;
  camDur?: number;
  world: { seed: number; theme?: "city" | "leaf"; stations: StoryboardStation[]; roads: unknown[]; zones: Record<string, unknown>[] };
  scenes: StoryboardScene[];
  audio?: { src: string; words: string; rate: number };
}

type Ctx = { ids: Set<string>; stations: Set<string> };
type V = (v: unknown, ctx: Ctx) => unknown;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const num = (min: number, max: number): V => (v) => (isNum(v) ? Math.round(Math.min(max, Math.max(min, v)) * 1000) / 1000 : undefined);
const int = (min: number, max: number): V => (v) => (isNum(v) ? Math.round(Math.min(max, Math.max(min, v))) : undefined);
const bool: V = (v) => (typeof v === "boolean" ? v : undefined);
const oneOf = (...vals: readonly string[]): V => (v) => (typeof v === "string" && vals.includes(v) ? v : undefined);
const txt = (max: number): V => (v) => {
  const t = cleanText(v, max);
  return t ? t : undefined;
};
const ref: V = txt(40);
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const hex: V = (v) => (typeof v === "string" && HEX_RE.test(v) ? v : undefined);
const hexes: V = (v) => {
  if (!Array.isArray(v)) return undefined;
  const out = v.map((c) => hex(c, { ids: new Set(), stations: new Set() })).filter((c): c is string => typeof c === "string").slice(0, 8);
  return out.length ? out : undefined;
};
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const slug: V = (v) => (typeof v === "string" && ID_RE.test(v) ? v : undefined);
const coord = num(-30, 30);
const px = num(-400, 400);
/** a station / zone id, or [x, y] / [x, y, z] */
const at: V = (v, ctx) => {
  if (typeof v === "string") return ctx.ids.has(v) ? v : undefined;
  if (Array.isArray(v) && (v.length === 2 || v.length === 3) && v.every(isNum)) return [coord(v[0], ctx), coord(v[1], ctx), ...(v.length === 3 ? [num(0, 12)(v[2], ctx)] : [])];
  return undefined;
};
const station: V = (v, ctx) => (typeof v === "string" && ctx.stations.has(v) ? v : undefined);
const stations: V = (v, ctx) => {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((s) => typeof s === "string" && ctx.ids.has(s)).slice(0, 8);
  return out.length ? out : undefined;
};
const road: V = (v, ctx) => (Array.isArray(v) && v.length === 2 && v.every((s) => typeof s === "string" && ctx.stations.has(s)) ? [...v] : undefined);
const camTo: V = (v, ctx) => (v === "all" ? "all" : typeof v === "string" ? at(v, ctx) : Array.isArray(v) && v.every((s) => typeof s === "string") ? stations(v, ctx) : at(v, ctx));
const zoom: V = (v, ctx) => (v === "fit" ? "fit" : num(0.5, 3)(v, ctx));
const parts: V = (v) => (typeof v === "string" ? slug(v, { ids: new Set(), stations: new Set() }) : Array.isArray(v) ? v.filter((p) => typeof p === "string" && ID_RE.test(p)).slice(0, 6) : undefined);
const timedLines = (max: number, n: number): V => (v) => {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((l) => {
      if (typeof l === "string") return txt(max)(l, { ids: new Set(), stations: new Set() });
      const o = obj(l);
      const t = txt(max)(o.t, { ids: new Set(), stations: new Set() });
      if (!t) return undefined;
      const on = ref(o.on, { ids: new Set(), stations: new Set() });
      return on ? { t, on } : { t };
    })
    .filter((x) => x !== undefined)
    .slice(0, n);
  return out.length ? out : undefined;
};
const pathPts: V = (v, ctx) => {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((p) => Array.isArray(p) && p.length === 2 && p.every(isNum)).map((p) => [coord((p as number[])[0], ctx), coord((p as number[])[1], ctx)]).slice(0, 16);
  return out.length >= 2 ? out : undefined;
};
const sub = (spec: Record<string, V>): V => (v, ctx) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out = applySpec(v as Record<string, unknown>, spec, ctx);
  return Object.keys(out).length ? out : undefined;
};
const listOf = (spec: Record<string, V>, n: number, allowString = 0): V => (v, ctx) => {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((x) => (allowString && typeof x === "string" ? txt(allowString)(x, ctx) : sub(spec)(x, ctx)))
    .filter((x) => x !== undefined)
    .slice(0, n);
  return out.length ? out : undefined;
};

function applySpec(src: Record<string, unknown>, spec: Record<string, V>, ctx: Ctx): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(spec)) {
    if (!(k in src)) continue;
    const v = f(src[k], ctx);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const CAM_SPEC: Record<string, V> = { to: camTo, zoom, y: num(0, 1), dx: px, dy: px, dur: num(0, 8), ease: oneOf("io", "out", "in", "lin"), lead: num(0, 1), punch: bool, flash: bool };
const COMMON_SPEC: Record<string, V> = { on: ref, w: int(0, 400), t: num(-5, 120), off: ref, dur: num(0, 8), scenes: int(1, 20), keep: bool, sfx: oneOf(...SFX_KINDS), stay: bool };
const ANCHOR: Record<string, V> = { dx: px, dy: px, af: num(0, 2), adx: px, ady: px };
const LABEL = STORYBOARD_LIMITS.label;
const CUT = STORYBOARD_LIMITS.cutaway;

const ACTION_SPECS: Record<(typeof ACTION_TYPES)[number], Record<string, V>> = {
  label: { at, text: txt(LABEL), style: oneOf("dark", "accent"), z: num(0, 12), ang: num(-7, 7), date: txt(LABEL), icon: slug, trend: oneOf("up", "down"), ...ANCHOR },
  card: { id: slug, title: txt(STORYBOARD_LIMITS.title), date: txt(LABEL), lines: timedLines(STORYBOARD_LIMITS.cardLine, 6), at, y: num(0, 1), ...ANCHOR },
  strike: { card: slug, line: int(0, 12), text: txt(STORYBOARD_LIMITS.cardLine), at, fall: bool, part: slug, noX: bool, road, pos: num(0, 1) },
  packet: {
    from: station,
    to: station,
    via: stations,
    path: pathPts,
    n: int(1, 12),
    color: hex,
    text: txt(16),
    ink: hex,
    loop: bool,
    speed: num(0.2, 8),
    gap: num(0, 5),
    style: oneOf("dot", "pill", "coin", "people", "light", "battery"),
    lane: num(-40, 40),
    untrim: (v) => (typeof v === "boolean" ? v : v === "from" || v === "to" ? v : undefined),
    hold: num(0, 10),
    stop: (v, ctx) => (isNum(v) ? num(0, 1)(v, ctx) : station(v, ctx)),
    go: ref,
    arrive: ref,
    morph: sub({ text: txt(16), color: hex, ink: hex }),
    charge: ref,
    drain: bool,
  },
  badge: { at, n: int(1, 20), lit: ref },
  prop: { at, kind: oneOf("flag", "bicorne"), x: coord, y: coord, z: num(0, 12), h: num(0, 12), w: num(0, 12), scale: num(0.2, 3), colors: hexes, drop: bool },
  state: { at, show: parts, hide: parts },
  burst: { at, kind: oneOf("dust", "spark"), n: int(1, 40), color: hex, af: num(0, 2), flash: bool },
  tone: { sat: num(0, 1) },
  tint: { at, road, color: hex },
  recap: { from: station, to: station, delay: num(0, 8), step: num(0, 2), label: txt(LABEL), dates: bool },
  tunnel: { from: station, to: station, color: hex },
  highlight: { at, r: num(0.2, 10), color: hex, style: oneOf("tint") },
  cam: CAM_SPEC,
  impact: { flash: bool },
  chapter: { n: int(1, 20), text: txt(LABEL), hold: num(0, 8) },
  fox: { pose: oneOf(...FOX_POSES), side: oneOf("left", "right"), size: oneOf("big") },
  cutaway: { kind: oneOf(...CUTAWAY_KINDS), dim: num(0, 1) },
};

const XY = { label: txt(LABEL), x: num(0, 1), y: num(0, 1) };
const CUTAWAY_SPECS: Record<(typeof CUTAWAY_KINDS)[number], Record<string, V>> = {
  phone: { app: txt(LABEL), title: txt(CUT), sub: txt(CUT), rows: timedLines(CUT, 8) },
  dots: { head: txt(CUT), total: int(1, 400), hit: int(0, 400), value: num(-1e9, 1e9), unit: txt(12), label: txt(CUT), note: txt(CUT), color: hex, land: ref },
  arc: { title: txt(CUT), from: sub(XY), to: sub(XY), extra: listOf(XY, 6, LABEL) },
  tiles: { title: txt(CUT), tiles: listOf({ t: txt(16), k: txt(8), c: txt(LABEL), op: txt(4), on: ref, br: bool }, 16), note: txt(CUT) },
  zoomin: { steps: listOf({ icon: oneOf("tree", "leaf", "cell", "chloroplast"), label: txt(LABEL), on: ref }, 6), step: num(0, 3) },
  calendar: { date: txt(LABEL), text: txt(CUT) },
};

/** Required fields per action type (an action without them is dropped). */
function actionOk(a: Record<string, unknown>): boolean {
  switch (a.type) {
    case "label":
    case "badge":
    case "prop":
    case "state":
    case "burst":
    case "highlight":
      return a.at !== undefined;
    case "strike":
      return a.card !== undefined || a.at !== undefined || a.road !== undefined;
    case "packet":
      return a.from !== undefined && (a.to !== undefined || a.path !== undefined);
    case "tint":
      return a.at !== undefined || a.road !== undefined;
    case "recap":
    case "tunnel":
      return a.from !== undefined && a.to !== undefined;
    case "chapter":
      return a.n !== undefined && a.text !== undefined;
    case "cutaway":
      return a.kind !== undefined;
    default:
      return true;
  }
}

function sanitizeAction(raw: unknown, ctx: Ctx): Record<string, unknown> | null {
  const src = obj(raw);
  const type = src.type;
  if (typeof type !== "string" || !(ACTION_TYPES as readonly string[]).includes(type)) return null;
  const spec = ACTION_SPECS[type as keyof typeof ACTION_SPECS];
  const out: Record<string, unknown> = { type, ...applySpec(src, COMMON_SPEC, ctx), ...applySpec(src, spec, ctx) };
  if (type === "cutaway" && typeof out.kind === "string") Object.assign(out, applySpec(src, CUTAWAY_SPECS[out.kind as keyof typeof CUTAWAY_SPECS], ctx));
  if (type === "fox" && out.pose === undefined) out.pose = "point";
  return actionOk(out) ? out : null;
}

const STATION_SPEC: Record<string, V> = {
  label: txt(LABEL),
  x: coord,
  y: coord,
  s: num(0.4, 3),
  color: hex,
  date: txt(LABEL),
  dateName: txt(LABEL),
  z: num(0, 12),
  text: txt(LABEL),
  colors: hexes,
  h: num(0, 12),
  n: int(0, 40),
  bulb: bool,
  dark: bool,
  cap: bool,
  size: num(6, 40),
};
const ZONE_SPEC: Record<string, V> = { x: coord, y: coord, r: num(0.5, 15), w: num(0.5, 30), d: num(0.5, 30), color: hex };

/**
 * Validates and cleans a reel storyboard from the AI (or Storage) against the engine's schema (prototype README
 * „Scenariusz”, plan §2.2): unknown keys are dropped; colours only `#hex`; `kind` outside the prop library → `house`;
 * unknown action / cutaway types are dropped, as are actions missing their target; numbers are clamped (zoom 0.5–3,
 * x/y −30…30, dur 0–8, …); texts are plain (no `<>`, no emoji) and cut (title 60, label 40, card line 60, cutaway 80,
 * `say` 400 per scene); station ids are `[A-Za-z0-9_-]{1,32}`, unique, and every reference must point to one.
 * `quiz`, `voice`, `cover` and `audio` are never kept (the server sets `audio`). Null when nothing playable is left
 * (no scene with `say`, or fewer than 2 stations).
 */
export function sanitizeStoryboard(raw: unknown): Storyboard | null {
  const src = obj(raw);
  const w = obj(src.world);
  const ids = new Set<string>();
  const stationIds = new Set<string>();
  const stationsOut: StoryboardStation[] = [];
  for (const rs of arr(w.stations)) {
    if (stationsOut.length >= STORYBOARD_LIMITS.stations) break;
    const s = obj(rs);
    const id = typeof s.id === "string" && ID_RE.test(s.id) && !ids.has(s.id) ? s.id : null;
    if (!id) continue;
    const kind = typeof s.kind === "string" && (PROP_KINDS as readonly string[]).includes(s.kind) ? s.kind : "house";
    const rest = applySpec(s, STATION_SPEC, { ids, stations: stationIds });
    if (rest.x === undefined || rest.y === undefined) continue;
    ids.add(id);
    stationIds.add(id);
    stationsOut.push({ id, kind, ...(rest as { x: number; y: number }) });
  }
  const zones: Record<string, unknown>[] = [];
  for (const rz of arr(w.zones)) {
    if (zones.length >= STORYBOARD_LIMITS.zones) break;
    const z = obj(rz);
    const id = typeof z.id === "string" && ID_RE.test(z.id) && !ids.has(z.id) ? z.id : null;
    if (!id) continue;
    const rest = applySpec(z, ZONE_SPEC, { ids, stations: stationIds });
    if (rest.x === undefined || rest.y === undefined) continue;
    ids.add(id);
    zones.push({ id, ...rest });
  }
  const ctx: Ctx = { ids, stations: stationIds };
  const roads: unknown[] = [];
  for (const rr of arr(w.roads)) {
    if (roads.length >= STORYBOARD_LIMITS.roads) break;
    if (Array.isArray(rr)) {
      const r = road(rr, ctx);
      if (r) roads.push(r);
      continue;
    }
    const o = obj(rr);
    const from = station(o.from, ctx);
    const to = station(o.to, ctx);
    if (!from || !to) continue;
    const style = oneOf("beam")(o.style, ctx);
    const color = hex(o.color, ctx);
    roads.push({ from, to, ...(style ? { style } : {}), ...(color ? { color } : {}) });
  }
  const scenes: StoryboardScene[] = [];
  for (const rsc of arr(src.scenes)) {
    if (scenes.length >= STORYBOARD_LIMITS.scenes) break;
    const sc = obj(rsc);
    const say = cleanText(sc.say, STORYBOARD_LIMITS.say);
    if (!say) continue;
    const scene: StoryboardScene = { say, actions: [] };
    const tts = cleanText(sc.tts, STORYBOARD_LIMITS.tts);
    if (tts) scene.tts = tts;
    if (sc.cam === "keep") scene.cam = "keep";
    else {
      const cam = sub(CAM_SPEC)(sc.cam, ctx);
      if (cam) scene.cam = cam as Record<string, unknown>;
    }
    const hold = num(0, 4)(sc.hold, ctx);
    if (hold !== undefined) scene.hold = hold as number;
    for (const ra of arr(sc.actions)) {
      if (scene.actions.length >= STORYBOARD_LIMITS.actions) break;
      const a = sanitizeAction(ra, ctx);
      if (a) scene.actions.push(a);
    }
    scenes.push(scene);
  }
  if (!scenes.length || stationsOut.length < 2) return null;
  const out: Storyboard = {
    title: cleanText(src.title, STORYBOARD_LIMITS.title) || "Rolka",
    world: { seed: (int(0, 100000)(w.seed, ctx) as number | undefined) ?? 7, stations: stationsOut, roads, zones },
    scenes,
  };
  const theme = oneOf("city", "leaf")(w.theme, ctx);
  if (theme) out.world.theme = theme as "city" | "leaf";
  const maxLabels = int(1, 4)(src.maxLabels, ctx);
  if (maxLabels !== undefined) out.maxLabels = maxLabels as number;
  const camDur = num(0.2, 3)(src.camDur, ctx);
  if (camDur !== undefined) out.camDur = camDur as number;
  return out;
}

const PAIR_RE = /\{([^{}|]*)\|([^{}]*)\}/g;
const TAG_RE = /\[[^[\]]{1,30}\]/g;
const ALLOWED_TAGS = new Set<string>(TTS_TAGS);

/** `say` as the narrator reads it: `{pokaz|wymowa}` → `wymowa`. */
export function spokenText(say: string): string {
  return say.replace(PAIR_RE, "$2").replace(/\s+/g, " ").trim();
}
/** `say` as captions show it: `{pokaz|wymowa}` → `pokaz`. */
export function displayText(say: string): string {
  return say.replace(PAIR_RE, "$1").replace(/\s+/g, " ").trim();
}
const ttsWords = (s: string) =>
  s
    .replace(TAG_RE, " ")
    .normalize("NFC")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter(Boolean);

/** True when `tts` says exactly the words of `say` (spoken form), ignoring tags, case and punctuation. */
export function ttsMatchesSay(say: string, tts: string): boolean {
  const a = ttsWords(spokenText(say));
  const b = ttsWords(tts);
  return a.length === b.length && a.every((w, i) => w === b[i]);
}

/**
 * The text sent to ElevenLabs for one scene: the AI's `tts` with only the allowed tags ({@link TTS_TAGS}), or the spoken
 * form of `say` when the words differ (plan §2.2: on mismatch `tts := say`). `tags: false` removes every tag.
 */
export function sceneTts(say: string, tts: string | undefined, opts: { tags: boolean }): string {
  let t = (tts ?? "").replace(TAG_RE, (m) => (ALLOWED_TAGS.has(m.toLowerCase()) ? m.toLowerCase() : " ")).replace(/[{}]/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  if (!t || !ttsMatchesSay(say, t)) t = spokenText(say);
  if (!opts.tags) t = t.replace(TAG_RE, " ").replace(/\s+/g, " ").trim();
  return t;
}

/** Spoken words of a storyboard (captions, `{a|b}` counted as shown). */
export function storyboardWords(sb: Pick<Storyboard, "scenes">): number {
  return sb.scenes.reduce((n, s) => n + countWords(displayText(s.say)), 0);
}

/**
 * Storyboard rules for the AI (owner's prototype README: Świat, Kamera, Narracja, Akcje, Biblioteka rekwizytów),
 * adapted for the app: no `quiz` (the end question is an existing quiz item), no `cover`, no `voice`, no `audio`
 * (the server adds them), 80–130 words for 45–60 s with the voice „Dawid” at 1.15×.
 */
export const REEL_STORYBOARD_RULES = `ROLKA — pionowa opowieść 9:16 na 45–60 sekund, zrobiona z materiału ucznia. Lektor („Dawid”, ElevenLabs eleven_v4) czyta krótką narrację, a w izometrycznym „świecie” pojęcia są miejscami (stacjami) połączonymi drogami. Kamera przelatuje między stacjami, pojawiają się etykiety, karty z faktami, napisy karaoke, numerowane rozdziały i przerywniki. Lis Cramfox jest przewodnikiem i wskakuje z gestami. Na końcu rolki apka sama zada istniejące pytanie z quizu — NIE piszesz pytania.

ZWRACASZ jeden obiekt JSON scenariusza (jako tekst w polu „storyboard”). Wszystkie teksty po polsku, bez emoji, bez HTML i bez znaków < >. Kolory tylko jako #hex.

SCHEMAT
{ "title": "krótki tytuł (≤ 60 znaków)",
  "maxLabels": 2,                       // opcjonalnie, ile etykiet świata naraz
  "camDur": 0.95,                       // opcjonalnie, domyślny czas przelotu kamery (s)
  "world": { "seed": 23, "theme": "city" | "leaf",
             "stations": [ { "id": "mfw", "kind": "vault", "label": "MFW", "x": 0, "y": 0, "s": 1, "color": "#2F6BFF" } ],
             "roads": [ ["mfw", "bank"], { "from": "slonce", "to": "jasna", "style": "beam", "color": "#F2B53A" } ],
             "zones": [ { "id": "ue", "x": 2, "y": 2, "r": 5, "color": "#DCE8CB" } ] },
  "scenes": [ { "say": "…", "tts": "…", "cam": { "to": "mfw", "zoom": 2.0, "y": 0.56 }, "hold": 0.4, "actions": [ … ] } ] }

ŚWIAT
- x, y to siatka mapy. Na ekranie pion to x + y (w dół), poziom to x − y (w prawo). Ekran jest wąski: trzymaj stacje blisko przekątnej (|x − y| ≤ ~8) i prowadź opowieść „w dół” (rosnące x + y). Sprawdza się zygzak: krok +4,2 po x, potem +4,2 po y.
- Stacje co najmniej ~3,5 jednostki od siebie. 4–10 stacji. id: małe litery, cyfry, „-”, „_”.
- Drogi to relacje (przyczyna → skutek, kolejność, przepływ). Do stacji w powietrzu (sun, cloud) silnik sam rysuje promień.
- theme "leaf" tylko dla biologii komórki / rośliny; domyślnie "city".
- Dookoła silnik sam dorysowuje miasto-wypełniacz.

KAMERA (cam sceny i akcje cam)
- cam sceny ustawia kadr na początku sceny; "cam": "keep" = bez przelotu. Akcje cam to uderzenia kamery na konkretne słowa — rolka nie może trzymać jednego kadru przez 7 s; każde zdanie z nowym podmiotem dostaje swój ruch.
- to: id stacji, lista id (kadr obejmie wszystkie), [x, y] albo "all". zoom: zbliżenie 1,9–2,6; kadr 2–3 stacji ~1,3–1,6; cała oś ~0,7; "fit" = dopasuj do listy. y: miejsce celu na ekranie 0–1 (domyślnie 0,43; przy etykietach nad stacją 0,52–0,56). dx, dy: przesunięcie w px. dur: czas ruchu (s). ease: io | out | in | lin. punch: true = uderzenie (najazd, drgnięcie, błysk; flash: false wyłącza błysk).

NARRACJA (say i tts)
- Rejestr TikTok: hak w pierwszych 2 s (najlepiej obala mit albo zaskakuje), otwarta pętla („Zostań do końca…”) domknięta później, krótkie mocne zdania, pytania retoryczne, zaskoczenia, humor. Lekki potoczny język dozwolony, bez wulgaryzmów i bez żenady. Zwracaj się do widza neutralnie płciowo (bez czasowników w czasie przeszłym z rodzajem: zamiast „zrobiłeś” — „to zrobisz”, „pewnie znasz”).
- FAKTY TYLKO Z MATERIAŁU UCZNIA. Żadnych dat, liczb, nazwisk ani przykładów spoza materiału. Fakty muszą się zgadzać co do joty.
- Długość: 80–130 słów łącznie w say, 6–14 scen, każda scena 1–3 krótkie zdania (45–60 s przy tempie 1,15).
- say = czysty tekst napisów, bez znaczników. tts = TE SAME SŁOWA dla lektora plus znaczniki tylko z listy: [excited], [whispers], [laughs softly], [sarcastic], [dramatically], [short pause] — stoją przed słowami, które kolorują. WIELKIE LITERY w tts to akcent, oszczędnie (najwyżej 1–2 na scenę).
- Zapis {pokaz|wymowa} rozdziela napis od tego, co czyta lektor, np. {ATP|a te pe}, {1789|tysiąc siedemset osiemdziesiąt dziewięć}, {97%|dziewięćdziesiąt siedem procent}. W tts piszesz tylko część mówioną. Interpunkcję daj w obu częściach. Lepiej mówić „w styczniu 1793” niż pełną datę słownie; pełna data niech będzie na chipie albo karcie.
- Słowa-uderzenia: słowo WIELKIMI w tts albo zakończone „!” w say idzie samo w ramce. Jedno, najwyżej dwa na scenę.
- Hak nie może zdradzać odpowiedzi na pytanie końcowe. Narracja ma jednak nauczyć tego, o co pyta pytanie końcowe (rozróżnienie, definicja, fakt), żeby uważny widz odpowiedział dobrze.
- Trudne momenty pokazuj symbolicznie (np. akcja tone), bez lisa i bez efektów.

AKCJE (w scene.actions)
Czas startu: "on": "słowo" (pierwsze słowo sceny zaczynające się od tego tekstu, bez polskich znaków i wielkości liter; "słowo#2" = drugie takie), "w": indeks słowa, albo "t": sekundy od początku sceny (może być ujemne w pierwszej scenie). Bez nich akcja startuje 0,55 s po początku sceny. Słowo z innej sceny: "Jeden@+1" (następna scena).
Koniec: "dur" (s), "scenes": n, "keep": true (do końca rolki), "off": "słowo". Każda akcja może mieć "sfx": pop | pop2 | whoosh | thud | scratch | chime | tick | none.
- label: at (id stacji/strefy albo [x,y,z]), text (≤ 40), dx, dy, style: dark | accent, af, adx, ady, date (chip z datą), trend: up | down, stay — pigułka z linią do stacji. Najwyżej 2 etykiety naraz.
- card: id, title albo date, lines: ["tekst" | {"t": "tekst", "on": "słowo"}] (linijka ≤ 60), at (bez at = duża karta na środku, y 0–1), dx, dy — karta z faktem.
- strike: card + line + text (przekreśla linijkę karty i wpisuje poprawną wartość) | at + fall: true (część top spada) | road: [a, b] + pos.
- packet: from, to, via: [ids] albo path: [[x,y],…], n, color, text (≤ 16), ink, style: dot | pill | coin | people | light | battery, lane, stop (stacja albo 0–1) + go: "słowo", arrive: "słowo", morph: {text, color, ink}, charge: "słowo", drain: true, loop, speed, gap, hold — kropki jadące po drogach.
- badge: at, n, lit: "słowo" — numerowana plakietka, zapala się na słowo.
- prop: at, kind: flag | bicorne, x, y, z, h, w, scale, colors, drop: true — dodatek dokładany w trakcie.
- state: at, show, hide (części rekwizytu, np. field: ok → dry).
- burst: at, kind: dust | spark, n, color, af, flash.
- tone: sat (0–1) — odbarwia świat.
- tint: at albo road: [a, b], color — barwi stację i drogę.
- recap: from, to, delay, step, label, dates — podsumowanie osi czasu.
- tunnel: from, to, color — tunel wzdłuż drogi.
- highlight: at, r, color, style: tint — pulsujący pierścień.
- cam: to, zoom, y, dx, dy, dur, ease, lead, punch, flash — ruch kamery na słowo.
- impact: flash — uderzenie bez ruchu kamery.
- chapter: n, text (≤ 40), hold — duży numerowany chip rozdziału.
- fox: pose: point | shrug | think | thumbs | celebrate | wave | startle, side: left | right, size: big, dur — lis wskakuje w rogu.
- cutaway: kind + pola, dim (0–1):
  phone: app, title, sub, rows: ["tekst" | {"t","on"}] — telefon z listą odhaczaną po kolei;
  dots: head, total, hit, value, unit, label, note, color, land: "słowo" — siatka kropek i licznik;
  arc: title, from {label,x,y}, to {label,x,y} (x, y 0–1), extra — mapa z łukiem;
  tiles: title, tiles: [{t,k,c,on} | {op,c,on} | {br:true}], note — klocki, np. wzór;
  zoomin: steps: [{icon: tree|leaf|cell|chloroplast, label, on}] — skok skali;
  calendar: date, text — duża data.
Lis ma się pojawić co najmniej 3 razy, przerywnik co najmniej raz. Każde "on" stawiaj na słowie, które mówi o tym samym co obraz.

BIBLIOTEKA REKWIZYTÓW (kind stacji): house, tower, hall (gmach z kolumnadą; dark, cap), palace, fortress, factory, school, server, crowd / people (n), person, pair, document, crown, scales, clock, globe, book (bulb), trees / tree-cluster (n), tree, flag (colors), cell, sun (z), plant, water, vault (skarbiec, pieniądze), field, cloud (z), crate, bubbles, billboard (text), bar (h — słupek wykresu), node, gear, recycle. Nieznany kind rysuje się jako house.

MAPOWANIE TYPÓW TREŚCI: oś czasu → droga-zygzak ze stacjami z date + dateName i recap na końcu; przyczyny → skutek → stacje przyczyn, drogi, packet po każdej drodze; porównanie → dwie stacje obok siebie (cam.to: [a, b]) i dwie karty z dx w przeciwne strony; liczby → card z liczbą, billboard, przerywnik dots albo tiles; cykl → stacje w kole połączone drogami i packet z via; drzewo pojęć → stacja-piasta i stacje-liście.`;

/**
 * One finished storyboard as an example for the AI (trimmed from the owner's prototype `fotosynteza.json`: 6 of 9
 * scenes, tags limited to {@link TTS_TAGS}, no quiz / cover; `audio` shows what the server adds).
 */
export const REEL_EXAMPLE = `{"title":"Fotosynteza","world":{"seed":23,"zones":[{"id":"chloroplast","x":2,"y":2,"r":5.8,"color":"#CFE3B2"}],"stations":[{"id":"jasna","kind":"cell","label":"Tylakoidy","x":-1,"y":-1},{"id":"k","kind":"gear","label":"Wiązanie CO₂","x":4.5,"y":1.5,"color":"#7FAE66"},{"id":"r","kind":"factory","label":"Redukcja","x":4,"y":5,"color":"#DCE8CC"},{"id":"g","kind":"recycle","label":"Regeneracja","x":1,"y":3,"color":"#5E9A5A"},{"id":"slonce","kind":"sun","label":"Słońce","x":-8,"y":-4,"z":5},{"id":"woda","kind":"water","label":"Woda z gleby","x":-2.8,"y":-6.2},{"id":"tlen","kind":"bubbles","label":"Tlen","x":-4,"y":-2.3,"s":0.85},{"id":"co2","kind":"cloud","label":"CO₂ z powietrza","x":3.5,"y":-4.5,"z":3},{"id":"glukoza","kind":"crate","label":"Glukoza","x":5,"y":9},{"id":"drzewo","kind":"tree","label":"Drzewo","x":-5.5,"y":-8.5,"s":1.15}],"roads":[["drzewo","woda"],["woda","jasna"],["jasna","tlen"],["jasna","g"],["k","r"],["r","g"],["g","k"],["r","glukoza"],["slonce","jasna"],["co2","k"]],"theme":"leaf"},"scenes":[{"say":"Czekaj… Myślisz, że drzewo rośnie, bo zjada ziemię? Nie, nie, NIE! Budulec bierze głównie z powietrza. Serio.","tts":"[excited] Czekaj… myślisz, że drzewo rośnie, bo zjada ziemię? [laughs softly] Nie, nie, NIE! Budulec bierze głównie z POWIETRZA. [whispers] Serio.","cam":{"to":"drzewo","zoom":2.1,"y":0.56},"actions":[{"type":"card","id":"mit","title":"Popularny mit","lines":["Drzewo je ziemię"],"t":-0.6,"y":0.15,"sfx":"none"},{"type":"fox","pose":"shrug","side":"left","size":"big","on":"Nie,","dur":1.6},{"type":"cam","on":"nie#3","to":"drzewo","zoom":2.4,"dur":0.2,"punch":true,"flash":false},{"type":"strike","card":"mit","line":0,"text":"Budulec z powietrza: CO₂","on":"Budulec"},{"type":"cam","on":"powietrza","to":"co2","zoom":1.8,"y":0.56,"dur":0.6},{"type":"label","at":"co2","text":"CO₂ z powietrza","on":"powietrza"}]},{"say":"To robota fotosyntezy. Roślina sama robi sobie jedzenie, na energii ze światła. Zostań do końca, bo zdradzę, skąd naprawdę bierze się tlen.","tts":"[excited] To robota fotosyntezy. Roślina sama robi sobie jedzenie, na energii ze ŚWIATŁA. [whispers] Zostań do końca, bo zdradzę, skąd naprawdę bierze się tlen.","cam":{"to":"all","y":0.46},"actions":[{"type":"fox","pose":"point","side":"right","on":"fotosyntezy","dur":2.6},{"type":"label","at":"glukoza","text":"jedzenie = glukoza","on":"jedzenie"},{"type":"label","at":"slonce","text":"energia ze światła","on":"energii","dy":50,"dx":40},{"type":"cam","on":"tlen","to":"tlen","zoom":2,"y":0.56,"dur":0.5},{"type":"label","at":"tlen","text":"tlen: skąd?","on":"tlen","style":"accent"}]},{"say":"Przepis? Trzy składniki. Światło. Woda, która płynie od korzeni naczyniami. I dwutlenek węgla, który wpada przez aparaty szparkowe.","tts":"Przepis? [excited] Trzy składniki. Światło. Woda, która płynie od korzeni naczyniami. I dwutlenek węgla, który wpada przez aparaty szparkowe.","cam":{"to":["slonce","woda","co2","jasna","k"],"y":0.5},"actions":[{"type":"chapter","n":1,"text":"Składniki","on":"Przepis"},{"type":"cam","on":"Światło","to":["slonce","jasna"],"zoom":"fit","y":0.52,"dur":0.55},{"type":"packet","from":"slonce","to":"jasna","on":"Światło","n":3,"color":"#F2B53A"},{"type":"cam","on":"Woda","to":["woda","jasna"],"zoom":"fit","y":0.55,"dur":0.55},{"type":"tunnel","from":"woda","to":"jasna","on":"Woda"},{"type":"packet","from":"woda","to":"jasna","on":"płynie","n":3,"color":"#2F6BFF","text":"H₂O"},{"type":"cam","on":"dwutlenek","to":["co2","k"],"zoom":"fit","y":0.55,"dur":0.55},{"type":"packet","from":"co2","to":"k","on":"dwutlenek","n":3,"color":"#7D8796","text":"CO₂"},{"type":"label","at":"co2","text":"aparaty szparkowe","on":"aparaty","style":"dark","dx":-40}],"hold":0.4},{"say":"Faza jasna, w tylakoidach. Światło rozbija cząsteczki wody i… uwalnia się tlen!","tts":"[dramatically] Faza jasna, w tylakoidach. Światło rozbija cząsteczki wody i… [excited] uwalnia się TLEN!","cam":{"to":["woda","jasna","tlen"],"zoom":1.7,"y":0.55},"actions":[{"type":"chapter","n":2,"text":"Faza jasna","t":0.2},{"type":"label","at":"jasna","text":"tylakoidy","on":"tylakoidach","style":"accent","dx":30},{"type":"packet","from":"woda","via":["jasna"],"to":"tlen","stop":"jasna","arrive":"rozbija","go":"uwalnia","text":"H₂O","color":"#2F6BFF","speed":2.6,"morph":{"text":"O₂","color":"#59B7DA","ink":"#fff"}},{"type":"burst","at":"jasna","kind":"spark","color":"#F2B53A","flash":true,"on":"rozbija","af":0.7},{"type":"label","at":"tlen","text":"H₂O → O₂","on":"tlen","style":"accent","dx":40},{"type":"impact","on":"tlen","flash":false}]},{"say":"Energia światła ląduje w nośnikach: {ATP|a te pe} i {NADPH.|en a de pe ha.} Takie naładowane baterie.","tts":"[excited] Energia światła ląduje w nośnikach: a te pe i en a de pe ha. [laughs softly] Takie naładowane baterie.","cam":{"to":["jasna","g","r"],"y":0.52},"actions":[{"type":"packet","style":"battery","from":"jasna","via":["g"],"to":"r","stop":"g","on":"ATP","go":"Dzięki@+1","charge":"naładowane","drain":true,"text":"ATP","color":"#B4FF3A","lane":-14,"speed":2.4,"sfx":"none"},{"type":"label","at":"jasna","text":"nośniki energii","on":"nośnikach","dx":-30},{"type":"label","at":"g","text":"naładowane baterie","on":"baterie","style":"accent","dy":-70}]},{"say":"Glukoza to paliwo i budulec rośliny. A tlen, którym właśnie oddychasz? Pochodzi z wody, nie z dwutlenku węgla. Produkt uboczny. Dzięki, roślinki!","tts":"[excited] Glukoza to paliwo i budulec rośliny. [whispers] A tlen, którym właśnie oddychasz? [excited] Pochodzi z WODY, nie z dwutlenku węgla. [laughs softly] Produkt UBOCZNY. Dzięki, roślinki!","cam":{"to":"glukoza","zoom":2,"y":0.56},"actions":[{"type":"label","at":"glukoza","text":"glukoza: paliwo i budulec","on":"Glukoza","dx":-40},{"type":"cam","on":"tlen","to":["woda","jasna","tlen"],"zoom":1.7,"y":0.55,"dur":0.6},{"type":"packet","from":"woda","via":["jasna"],"to":"tlen","stop":"jasna","arrive":"wody","go":"nie","text":"H₂O","color":"#2F6BFF","speed":3.2,"morph":{"text":"O₂","color":"#59B7DA","ink":"#fff"}},{"type":"label","at":"tlen","text":"produkt uboczny","on":"Produkt","style":"dark","dx":40,"dy":-90},{"type":"cam","on":"Dzięki","to":"all","zoom":"fit","y":0.44,"dur":1},{"type":"fox","pose":"thumbs","side":"right","size":"big","on":"Dzięki","dur":2.4}],"hold":0.6}],"audio":{"src":"r1.mp3","words":"r1.words.json","rate":1.15}}`;

/* ======================================================================================= AI output schemas */

/** Series plan (one call). `quiz` = `l2#q3`, `feed` = `l2#f0` or "" (labels from {@link topicDigest}). */
export const ReelSeriesPlanSchema = z.object({
  seriesTitle: z.string(),
  reels: z.array(
    z.object({
      type: z.enum(REEL_TYPES),
      title: z.string(),
      points: z.array(z.string()),
      quiz: z.string(),
      feed: z.string(),
      angle: z.string(),
    }),
  ),
});
export type ReelSeriesPlan = z.infer<typeof ReelSeriesPlanSchema>;

/** One storyboard: `storyboard` is the scenario as a JSON string (the scenario union is too big for a grammar). */
export const ReelStoryboardOutSchema = z.object({ title: z.string(), storyboard: z.string() });

/** Podcast outline (one call). */
export const PodcastOutlineSchema = z.object({
  title: z.string(),
  chapters: z.array(
    z.object({
      title: z.string(),
      points: z.array(z.string()),
      levels: z.array(z.string()),
      quiz: z.string(),
      szopMistake: z.string(),
      lead: z.string(),
    }),
  ),
});
export type PodcastOutline = z.infer<typeof PodcastOutlineSchema>;

/** One podcast chapter's dialogue. */
export const PodcastChapterOutSchema = z.object({
  lines: z.array(z.object({ s: z.enum(["lis", "szop"]), t: z.string() })),
  pauseAfter: z.number(),
});
export type PodcastChapterOut = z.infer<typeof PodcastChapterOutSchema>;

/* ======================================================================================================= fox */

export const FOX_MODES = ["explain", "quiz", "exam"] as const;
export type FoxMode = (typeof FOX_MODES)[number];
export const FOX_STEPS = ["start", "answer", "hint", "idk", "finish"] as const;
export type FoxStep = (typeof FOX_STEPS)[number];
/** Questions per mode (exam: each with exactly one follow-up). */
export const FOX_QUESTIONS: Record<FoxMode, number> = { explain: 1, quiz: 5, exam: 3 };

/** One structured answer of the fox model (the server builds the HTTP answer from it, see `@nauka/ai` fox.ts). */
export const FoxTurnOutSchema = z.object({
  reply: z.string(),
  question: z.string(),
  verdict: z.enum(["ok", "partial", "wrong", "none"]),
  point: z.string(),
  good: z.array(z.string()),
  gap: z.array(z.string()),
  wrong: z.array(z.string()),
  source: z.string(),
  scores: z.array(z.object({ q: z.string(), score: z.number(), note: z.string(), point: z.string() })),
  gaps: z.array(z.object({ title: z.string(), point: z.string(), source: z.string() })),
});
export type FoxTurnOut = z.infer<typeof FoxTurnOutSchema>;

export type FoxVerdict = "ok" | "partial" | "wrong";
export type FoxNext = "question" | "followup" | "finish" | "end";

/** `POST /api/fox` 200 (plan §2.6). Strings are plain text ≤ 600 (the app still escapes them). */
export interface FoxResponse {
  reply: string;
  next: FoxNext;
  question?: { n: number; text: string };
  /** `<topicId>:<rawPointId>` */
  pointId?: string;
  verdict?: FoxVerdict;
  feedback?: { good: string[]; gap: string[]; wrong: string[]; source?: { topicId: string; level: string; feed: number } };
  result?: {
    pct: number;
    score: { ok: number; total: number };
    perQuestion: { q: string; verdict: "DOBRZE" | "PRAWIE" | "ŹLE"; note: string; pointId?: string }[];
    gaps: { title: string; topicId: string; level: string; feed: number; pointId?: string }[];
  };
  quota: ChatQuota;
}

/* =================================================================================================== grading */

export type GradingStage = "podstawowa" | "liceum" | "studia" | "inne";
/**
 * Grade scales by stage (copy of `GRADING_BY_STAGE` in finalize.ts / BIBLIA §6.2, labels without emoji). The fox's
 * oral exam returns only `pct`; the app computes the grade from the subject's own scale. Used in prompts and tests.
 */
export const MEDIA_GRADING: Record<GradingStage, { pass: number; scale: [number, string][]; failLabel: string }> = {
  podstawowa: { pass: 50, scale: [[95, "6"], [85, "5"], [70, "4"], [50, "3"], [30, "2"]], failLabel: "1" },
  liceum: { pass: 50, scale: [[95, "6"], [85, "5"], [70, "4"], [50, "3"], [30, "2"]], failLabel: "1" },
  studia: { pass: 50, scale: [[90, "5"], [80, "4,5"], [70, "4"], [60, "3,5"], [50, "3"]], failLabel: "2" },
  inne: { pass: 60, scale: [[90, "mistrz"], [75, "solidnie"], [60, "zaliczone"]], failLabel: "jeszcze nie" },
};

export function gradingFor(stage: unknown) {
  return MEDIA_GRADING[(stage as GradingStage) in MEDIA_GRADING ? (stage as GradingStage) : "liceum"];
}

/** Grade label for a percentage on a stage's scale. */
export function gradeLabel(stage: unknown, pct: number): string {
  const g = gradingFor(stage);
  return g.scale.find(([min]) => pct >= min)?.[1] ?? g.failLabel;
}

/** „2 / 3 / 3,5 / 4 / 4,5 / 5” — the scale in ascending order (for prompts). */
export function gradeScaleText(stage: unknown): string {
  const g = gradingFor(stage);
  return [g.failLabel, ...g.scale.map(([, l]) => l).reverse()].join(" / ");
}
