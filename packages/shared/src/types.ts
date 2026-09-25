/**
 * Recall — shared content contract.
 * Everything the AI generates, the DB stores and the apps render goes through these types.
 * Keep in sync with schema.ts (zod) — schema.ts is the runtime source of truth.
 */

/** Education stage. Drives prompt style, difficulty and default subject presets. */
export type Stage = "podstawowa" | "liceum" | "studia" | "inne";

export const STAGES: { id: Stage; label: string; emoji: string; hint: string }[] = [
  { id: "podstawowa", label: "Podstawówka", emoji: "🎒", hint: "klasy 4–8" },
  { id: "liceum", label: "Liceum / technikum", emoji: "🎓", hint: "matura, rozszerzenia" },
  { id: "studia", label: "Studia", emoji: "🏛️", hint: "kolokwia, egzaminy, sesja" },
  { id: "inne", label: "Inne", emoji: "✨", hint: "kursy, certyfikaty, języki" },
];

/** Micro-dose of knowledge shown in the feed ("roladka"). `body` may contain simple HTML (b, i, br, ul/li). */
export interface FeedItem {
  title: string;
  body: string;
  /** plain-language translation ("po ludzku") */
  real?: string;
  /** mnemonic */
  mnemo?: string;
}

export interface Flashcard {
  /** term / front */
  t: string;
  /** definition / back */
  d: string;
}

/**
 * Where a question / task came from (design/DESIGN.md §4.1) — powers `SourceView`.
 * `material` = materials row id (stamped by the API), `page` = page / photo number, `quote` = the sentence it was built from.
 */
export interface TaskSource {
  material?: string;
  page?: number;
  quote?: string;
}

/** Multiple choice. `c` = index of the correct answer (0 = A). */
export interface QuizQuestion {
  q: string;
  a: string[];
  c: number;
  /** explanation — always present */
  e: string;
  /** optional source pointer (materials mode) */
  src?: TaskSource;
}

/** Mini-game: match pairs (left ↔ right). */
export interface MatchGame {
  type: "match";
  title?: string;
  pairs: { l: string; r: string }[];
}

/** Mini-game: fill the blank. Sentence uses `___` for the gap. */
export interface ClozeGame {
  type: "cloze";
  title?: string;
  items: { s: string; answer: string; options: string[]; e?: string }[];
}

/** Mini-game: true / false swipe. */
export interface TrueFalseGame {
  type: "truefalse";
  title?: string;
  items: { s: string; v: boolean; e?: string }[];
}

/** Mini-game: put steps in order. `steps` are given in the correct order; UI shuffles. */
export interface OrderGame {
  type: "order";
  title?: string;
  prompt: string;
  steps: string[];
}

export type MiniGame = MatchGame | ClozeGame | TrueFalseGame | OrderGame;
export type MiniGameType = MiniGame["type"];

/* ---------------- tasks 2.0 (design/DESIGN.md §4.1, legacy engine.js KROK 5/5b) ----------------
 * 15 task types + flashcards = the 16 task screens. Every field beyond `type` follows the legacy data shape,
 * so legacy `data/*.js` subjects and AI output share one contract. All optional on Level (old content stays valid). */

interface TaskBase {
  /** heading over the task (falls back to TASK_META label) */
  title?: string;
  /** explanation shown in the feedback panel */
  e?: string;
  src?: TaskSource;
}

/** Pairs: left ↔ right, two shuffled columns, tap-tap. */
export interface MatchTask extends TaskBase {
  type: "match";
  pairs: [string, string][];
}
/** Fill the gaps: `text` uses `{0}`, `{1}`… placeholders; `blanks[i]` is the answer for `{i}`; `bank` = distractor tiles. */
export interface FillTask extends TaskBase {
  type: "fill";
  text: string;
  blanks: string[];
  bank: string[];
  hint?: string;
}
/** Put items in order. `items` are in the CORRECT order; the UI shuffles (never starts solved). */
export interface OrderTask extends TaskBase {
  type: "order";
  items: string[];
}
/** Sort tiles into 2–4 buckets. */
export interface SortTask extends TaskBase {
  type: "sort";
  buckets: { name: string; items: string[] }[];
}
/** True / false run, optionally timed (whole round in `seconds`). Passed only when every statement is right. */
export interface TfTask extends TaskBase {
  type: "tf";
  seconds?: number;
  statements: { s: string; v: boolean; e?: string }[];
}
/** Pin events to years on a vertical axis. Equal years are interchangeable. */
export interface TimelineTask extends TaskBase {
  type: "timeline";
  events: { label: string; year: number }[];
}
/** Exactly one sentence is false: `wrong` = its index, `fix` = the correct word / phrase. */
export interface FindErrorTask extends TaskBase {
  type: "finderror";
  sentences: string[];
  wrong: number;
  fix: string;
}
/** "Whose thesis": a quote → author / school. `c` = index into `options`. */
export interface ThesisTask extends TaskBase {
  type: "thesis";
  thesis: string;
  q?: string;
  options: { name: string; sub?: string }[];
  c: number;
}
/** Cause chain: `steps` in order, `given` = indexes visible from the start, `bank` = distractors mixed with the missing steps. */
export interface ChainTask extends TaskBase {
  type: "chain";
  steps: string[];
  given: number[];
  bank: string[];
}
/** Scenario: a situation, a question and A–D answers. */
export interface ScenarioTask extends TaskBase {
  type: "scenario";
  scene: string;
  q: string;
  a: string[];
  c: number;
}
/** Two categories: swipe each card left or right. */
export interface SwipeTask extends TaskBase {
  type: "swipe";
  left: string;
  right: string;
  cards: { front: string; sub?: string; side: "left" | "right"; e?: string }[];
}
/** Type the term from its definition. Compared with `foldAnswer()`; `typo` = allowed edit distance (default 1). */
export interface TypeTermTask extends TaskBase {
  type: "typeterm";
  definition: string;
  answer: string;
  accept?: string[];
  typo?: number;
}
/** Read a one-series bar / line chart, then answer A–D. Values ≥ 0. */
export interface ChartTask extends TaskBase {
  type: "chart";
  chart: { kind: "bar" | "line"; label?: string; x: string[]; y: number[] };
  q: string;
  a: string[];
  c: number;
}
/** Solve step by step: each step = pick the right transformation from `options` (`expr` = expression after the step). */
export interface MathStepsTask extends TaskBase {
  type: "mathsteps";
  start: string;
  steps: { expr: string; note?: string; options: string[]; c: number }[];
}
/** Point at targets on a schematic. `x`,`y` = centre in % of the image, `r` = radius in % of the width. Asked in order. */
export interface HotspotTask extends TaskBase {
  type: "hotspot";
  image: string;
  alt?: string;
  targets: { name: string; x: number; y: number; r: number }[];
}

export type Task =
  | MatchTask
  | FillTask
  | OrderTask
  | SortTask
  | TfTask
  | TimelineTask
  | FindErrorTask
  | ThesisTask
  | ChainTask
  | ScenarioTask
  | SwipeTask
  | TypeTermTask
  | ChartTask
  | MathStepsTask
  | HotspotTask;
export type TaskType = Task["type"];

/** All 15 `tasks` types in the order the practice tab lists them (simple → drag → chart/math/hotspot). */
export const TASK_TYPES: TaskType[] = ["tf", "fill", "typeterm", "swipe", "thesis", "scenario", "finderror", "match", "order", "sort", "timeline", "chain", "chart", "mathsteps", "hotspot"];

/** Text-only task types the AI may generate (no chart / mathsteps / hotspot — those need curated data or images). */
export const AI_TASK_TYPES = ["tf", "fill", "typeterm", "swipe", "thesis", "scenario", "finderror", "timeline", "chain", "match", "order", "sort"] as const;
export type AiTaskType = (typeof AI_TASK_TYPES)[number];

export interface Level {
  id: string;
  title: string;
  emoji: string;
  /** one-line summary used on the path */
  summary?: string;
  feed: FeedItem[];
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  games?: MiniGame[];
  /** tasks 2.0 — when absent, `levelTasks()` derives them from `games` */
  tasks?: Task[];
  /** id of the material this level was generated from (design/DESIGN.md §4.2) */
  fromMaterial?: string;
}

export interface Grading {
  /** pass threshold in % */
  pass: number;
  /** exam time limit in minutes */
  examMin: number;
  /** [threshold %, label] DESC */
  scale: [number, string][];
  failLabel: string;
}

/**
 * Topic content — one AI-generated learning unit (e.g. "Fotosynteza" inside subject "Biologia").
 * This is what AI produces and what a `topics` row stores in `content` JSONB.
 */
export interface TopicContent {
  name: string;
  short: string;
  emoji: string;
  tagline: string;
  /** CSS gradient or colour */
  accent: string;
  accent2: string;
  /** language-learning topic: flashcards are vocab, quizzes are translations */
  lang?: boolean;
  grading: Grading;
  /** HTML info block(s) */
  info: string;
  levels: Level[];
}
/** @deprecated use TopicContent */
export type SubjectContent = TopicContent;

/** Subject = the user's container (Matematyka, Biologia, Makroekonomia…). Starts empty; topics are generated into it. */
export interface Subject {
  id: string;
  ownerId: string;
  name: string;
  emoji: string;
  /** curriculum category key, see CURRICULUM */
  category: string;
  stage: Stage;
  accent: string;
  accent2: string;
  /** optional upcoming test: drives the study plan */
  examDate?: string | null;
  examLabel?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Topic row (DB shape used by both apps). */
export interface Topic extends TopicContent {
  id: string;
  subjectId: string;
  ownerId: string;
  /** display order inside the subject */
  position: number;
  /** "materials" (from uploads) or "prompt" (from a typed topic) */
  source: "materials" | "prompt";
  generationId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Per-user progress for one topic. */
export interface SubjectProgress {
  xp: number;
  levels: Record<string, LevelProgress>;
  bestExam?: number;
  /** opened chest indexes on the path (see gems.ts chestIndexes) */
  chests?: number[];
  /** chapter boss record (boss.ts) */
  boss?: BossRecord;
  /** best run per level id (ghost.ts) */
  ghost?: Record<string, GhostRecord>;
}

/** Chapter boss — one per topic (legacy `PROGRESS[sid].boss`). */
export interface BossRecord {
  done: boolean;
  /** wins */
  n: number;
  /** YYYY-MM-DD of the last win */
  at?: string;
  /** best time in seconds */
  best?: number;
}

/** One answer of a lesson run: `t` = ms since the first item, `correct`. */
export interface GhostStep {
  t: number;
  correct: boolean;
}
/** Best run of a level (legacy `PROGRESS.ghost["sid:lid"]`). */
export interface GhostRecord {
  run: GhostStep[];
  /** YYYY-MM-DD */
  at: string;
}

export type AlbumRarity = "common" | "rare" | "epic";
/** Collected flashcard (legacy `PROGRESS.album["sid:lid:idx"]`). */
export interface AlbumEntry {
  rarity: AlbumRarity;
  /** YYYY-MM-DD */
  at: string;
}
export type AlbumMap = Record<string, AlbumEntry>;

export interface LevelProgress {
  done: boolean;
  best: number; // best quiz % 0..100
  stars: 0 | 1 | 2 | 3;
  attempts: number;
}

export type DailyGoal = 20 | 50 | 100;

/** Lifetime counters used by achievements and the profile stats grid. */
export interface UserStats {
  cardsReviewed: number;
  levelsDone: number;
  perfectLevels: number;
  examsPassed: number;
  comboBest: number;
  questsDone: number;
  chestsOpened: number;
  nightOwl: boolean;
  earlyBird: boolean;
  /** YYYY-MM-DD of the last day the daily-goal bonus was granted */
  goalBonusDay?: string;
  /* ---- 2.0 counters (optional: older rows lack them; emptyStats() fills zeros) ---- */
  /** flashcards collected in the album (album.ts) */
  albumCount?: number;
  /** best exam score in % */
  bestExamPct?: number;
  /** chapter bosses beaten (first wins) */
  bosses?: number;
  /** days the whole daily plan was completed */
  planDays?: number;
  /** topics with every level done */
  subjectsDone?: number;
  /** timed tasks (tf with `seconds`) finished without a mistake */
  timedPerfect?: number;
  /** tasks 2.0 solved correctly */
  tasksDone?: number;
}

/** Streak / wallet / settings — one row per user (user_meta). */
export interface UserMeta {
  streak: number;
  best: number;
  /** YYYY-MM-DD */
  lastDay: string | null;
  gems: number;
  hearts: number;
  /** ISO timestamp of the last hearts change (regen folds from here) */
  heartsUpdatedAt: string;
  dailyGoal: DailyGoal;
  streakFreezes: number;
  soundOn: boolean;
  stats: UserStats;
}

export interface ActivityDay {
  /** YYYY-MM-DD */
  day: string;
  xp: number;
  minutes: number;
}

export interface LeaderboardRow {
  rank: number;
  displayName: string;
  xp: number;
  isMe: boolean;
}

export type QuestKind = "xp" | "combo" | "review" | "perfect" | "levels" | "games" | "minutes" | "correct";

export interface Quest {
  id: string;
  kind: QuestKind;
  title: string;
  target: number;
  progress: number;
  reward: number;
  done: boolean;
  claimed: boolean;
  /** weekly mission (quests.ts weeklyQuestFor) — ids start with `w:` */
  weekly?: boolean;
}

export interface Achievement {
  key: string;
  title: string;
  desc: string;
  icon: string;
  gems: number;
}

/** AI generation job */
export type GenerationStatus = "queued" | "running" | "done" | "failed";

export interface GenerationOptions {
  stage: Stage;
  /** subject the topic belongs to (name, e.g. "Biologia") — gives AI the curriculum context */
  subjectName?: string;
  /** "materials": teach only what's in the uploads. "prompt": no uploads — build the topic from `hint` per the Polish curriculum. */
  mode?: "materials" | "prompt";
  /** the user's description of the material, or (mode=prompt) the topic itself, e.g. "fotosynteza, klasa 7" */
  hint?: string;
  /** target number of levels (1–8) */
  levels?: number;
  /** language subject */
  lang?: boolean;
  /** UI/content language, default "pl" */
  locale?: "pl" | "en";
}

export type Plan = "free" | "pro";

/** Standard subject presets per stage (Polish curriculum). Users can also type their own. */
export const CURRICULUM: Record<Stage, { key: string; name: string; emoji: string }[]> = {
  podstawowa: [
    { key: "matematyka", name: "Matematyka", emoji: "➗" },
    { key: "polski", name: "Język polski", emoji: "📖" },
    { key: "angielski", name: "Angielski", emoji: "🇬🇧" },
    { key: "historia", name: "Historia", emoji: "🏰" },
    { key: "przyroda", name: "Przyroda", emoji: "🌿" },
    { key: "biologia", name: "Biologia", emoji: "🧬" },
    { key: "geografia", name: "Geografia", emoji: "🗺️" },
    { key: "chemia", name: "Chemia", emoji: "⚗️" },
    { key: "fizyka", name: "Fizyka", emoji: "🧲" },
    { key: "wos", name: "WOS", emoji: "🏛️" },
    { key: "informatyka", name: "Informatyka", emoji: "💻" },
    { key: "inny-jezyk", name: "Drugi język", emoji: "🌍" },
  ],
  liceum: [
    { key: "matematyka", name: "Matematyka", emoji: "➗" },
    { key: "polski", name: "Język polski", emoji: "📖" },
    { key: "angielski", name: "Angielski", emoji: "🇬🇧" },
    { key: "historia", name: "Historia", emoji: "🏰" },
    { key: "biologia", name: "Biologia", emoji: "🧬" },
    { key: "chemia", name: "Chemia", emoji: "⚗️" },
    { key: "fizyka", name: "Fizyka", emoji: "🧲" },
    { key: "geografia", name: "Geografia", emoji: "🗺️" },
    { key: "wos", name: "WOS", emoji: "🏛️" },
    { key: "informatyka", name: "Informatyka", emoji: "💻" },
    { key: "hit", name: "HiT", emoji: "📰" },
    { key: "pp", name: "Podstawy przedsiębiorczości", emoji: "💼" },
    { key: "inny-jezyk", name: "Drugi język", emoji: "🌍" },
  ],
  studia: [
    { key: "matematyka", name: "Matematyka / analiza", emoji: "∫" },
    { key: "statystyka", name: "Statystyka", emoji: "📊" },
    { key: "ekonomia", name: "Ekonomia", emoji: "💹" },
    { key: "prawo", name: "Prawo", emoji: "⚖️" },
    { key: "psychologia", name: "Psychologia", emoji: "🧠" },
    { key: "medycyna", name: "Medycyna / anatomia", emoji: "🩺" },
    { key: "informatyka", name: "Informatyka", emoji: "💻" },
    { key: "zarzadzanie", name: "Zarządzanie", emoji: "🏢" },
    { key: "jezyk", name: "Język obcy", emoji: "🌍" },
    { key: "inne", name: "Inny przedmiot", emoji: "📘" },
  ],
  inne: [
    { key: "jezyk", name: "Język obcy", emoji: "🌍" },
    { key: "certyfikat", name: "Certyfikat / egzamin zawodowy", emoji: "📜" },
    { key: "prawo-jazdy", name: "Prawo jazdy", emoji: "🚗" },
    { key: "hobby", name: "Hobby / własny temat", emoji: "✨" },
  ],
};
