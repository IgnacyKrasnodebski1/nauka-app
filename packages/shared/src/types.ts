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
