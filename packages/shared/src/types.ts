/**
 * NAUKA — shared content contract.
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

/** Multiple choice. `c` = index of the correct answer (0 = A). */
export interface QuizQuestion {
  q: string;
  a: string[];
  c: number;
  /** explanation — always present */
  e: string;
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

/** Full subject content — what AI produces and what a subject row stores in `content` JSONB. */
export interface SubjectContent {
  name: string;
  short: string;
  emoji: string;
  tagline: string;
  /** CSS gradient or colour */
  accent: string;
  accent2: string;
  /** language-learning subject: flashcards are vocab, quizzes are translations */
  lang?: boolean;
  grading: Grading;
  /** HTML info block(s) */
  info: string;
  levels: Level[];
}

/** Subject as stored / listed (DB row shape used by both apps). */
export interface Subject extends SubjectContent {
  id: string;
  ownerId: string | null;
  stage: Stage;
  isPublic: boolean;
  /** free-form: "matematyka", "historia", "makroekonomia" … */
  category?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Per-user progress for one subject. */
export interface SubjectProgress {
  xp: number;
  levels: Record<string, LevelProgress>;
  bestExam?: number;
}

export interface LevelProgress {
  done: boolean;
  best: number; // best quiz % 0..100
  stars: 0 | 1 | 2 | 3;
  attempts: number;
}

/** Streak / meta */
export interface UserMeta {
  streak: number;
  best: number;
  /** YYYY-MM-DD */
  lastDay: string | null;
}

/** AI generation job */
export type GenerationStatus = "queued" | "running" | "done" | "failed";

export interface GenerationOptions {
  stage: Stage;
  /** the user's own description of what the material is */
  hint?: string;
  /** target number of levels (1–8) */
  levels?: number;
  /** language subject */
  lang?: boolean;
  /** UI/content language, default "pl" */
  locale?: "pl" | "en";
}

export type Plan = "free" | "pro";
