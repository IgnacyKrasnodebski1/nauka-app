import { z } from "zod";
import { AI_TASK_TYPES } from "./types.js";

/** Runtime schemas. Used to validate AI output, imports and DB reads. */

export const StageSchema = z.enum(["podstawowa", "liceum", "studia", "inne"]);

export const FeedItemSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  real: z.string().max(1000).optional(),
  mnemo: z.string().max(1000).optional(),
});

export const FlashcardSchema = z.object({
  t: z.string().min(1).max(300),
  d: z.string().min(1).max(2000),
});

/** Source pointer of a question / task (design/DESIGN.md §4.1) — all fields optional. */
export const TaskSourceSchema = z.object({
  material: z.string().max(80).optional(),
  page: z.number().int().min(0).optional(),
  quote: z.string().max(600).optional(),
});

export const QuizQuestionSchema = z
  .object({
    q: z.string().min(1).max(1000),
    a: z.array(z.string().min(1).max(500)).min(2).max(5),
    c: z.number().int().min(0),
    e: z.string().min(1).max(2000),
    src: TaskSourceSchema.optional(),
  })
  .refine((v) => v.c < v.a.length, { message: "c must index into a", path: ["c"] });

export const MatchGameSchema = z.object({
  type: z.literal("match"),
  title: z.string().max(200).optional(),
  pairs: z.array(z.object({ l: z.string().min(1).max(300), r: z.string().min(1).max(300) })).min(3).max(10),
});

export const ClozeGameSchema = z.object({
  type: z.literal("cloze"),
  title: z.string().max(200).optional(),
  items: z
    .array(
      z.object({
        s: z.string().min(1).max(600),
        answer: z.string().min(1).max(200),
        options: z.array(z.string().min(1).max(200)).min(2).max(5),
        e: z.string().max(1000).optional(),
      }),
    )
    .min(2)
    .max(12),
});

export const TrueFalseGameSchema = z.object({
  type: z.literal("truefalse"),
  title: z.string().max(200).optional(),
  items: z.array(z.object({ s: z.string().min(1).max(600), v: z.boolean(), e: z.string().max(1000).optional() })).min(3).max(15),
});

export const OrderGameSchema = z.object({
  type: z.literal("order"),
  title: z.string().max(200).optional(),
  prompt: z.string().min(1).max(400),
  steps: z.array(z.string().min(1).max(300)).min(3).max(8),
});

export const MiniGameSchema = z.discriminatedUnion("type", [MatchGameSchema, ClozeGameSchema, TrueFalseGameSchema, OrderGameSchema]);

/* ---------------- tasks 2.0 (design/DESIGN.md §4.1) ---------------- */

const str = (max: number) => z.string().min(1).max(max);
const taskBase = {
  title: z.string().max(200).optional(),
  e: z.string().max(2000).optional(),
  src: TaskSourceSchema.optional(),
};
const idx = z.number().int().min(0);

export const MatchTaskSchema = z.object({ type: z.literal("match"), ...taskBase, pairs: z.array(z.tuple([str(300), str(300)])).min(2).max(10) });

export const FillTaskSchema = z
  .object({ type: z.literal("fill"), ...taskBase, text: str(1500), blanks: z.array(str(120)).min(1).max(6), bank: z.array(str(120)).max(10), hint: z.string().max(300).optional() })
  .refine(
    (v) => {
      const slots = [...v.text.matchAll(/\{(\d+)\}/g)].map((m) => +m[1]!);
      return slots.length > 0 && slots.every((i) => i < v.blanks.length);
    },
    { message: "text placeholders {n} must index into blanks", path: ["text"] },
  );

export const OrderTaskSchema = z.object({ type: z.literal("order"), ...taskBase, items: z.array(str(300)).min(2).max(8) });

export const SortTaskSchema = z.object({
  type: z.literal("sort"),
  ...taskBase,
  buckets: z.array(z.object({ name: str(80), items: z.array(str(200)).min(1).max(8) })).min(2).max(4),
});

export const TfTaskSchema = z.object({
  type: z.literal("tf"),
  ...taskBase,
  seconds: z.number().int().min(10).max(600).optional(),
  statements: z.array(z.object({ s: str(600), v: z.boolean(), e: z.string().max(1000).optional() })).min(1).max(15),
});

export const TimelineTaskSchema = z.object({
  type: z.literal("timeline"),
  ...taskBase,
  events: z.array(z.object({ label: str(200), year: z.number() })).min(2).max(8),
});

export const FindErrorTaskSchema = z
  .object({ type: z.literal("finderror"), ...taskBase, sentences: z.array(str(400)).min(2).max(6), wrong: idx, fix: str(200) })
  .refine((v) => v.wrong < v.sentences.length, { message: "wrong must index into sentences", path: ["wrong"] });

export const ThesisTaskSchema = z
  .object({
    type: z.literal("thesis"),
    ...taskBase,
    thesis: str(800),
    q: z.string().max(300).optional(),
    options: z.array(z.object({ name: str(120), sub: z.string().max(200).optional() })).min(2).max(6),
    c: idx,
  })
  .refine((v) => v.c < v.options.length, { message: "c must index into options", path: ["c"] });

export const ChainTaskSchema = z
  .object({ type: z.literal("chain"), ...taskBase, steps: z.array(str(300)).min(2).max(8), given: z.array(idx).max(8), bank: z.array(str(300)).max(8) })
  .refine((v) => v.given.every((i) => i < v.steps.length) && new Set(v.given).size < v.steps.length, { message: "given must leave at least one step to fill", path: ["given"] });

export const ScenarioTaskSchema = z
  .object({ type: z.literal("scenario"), ...taskBase, scene: str(1500), q: str(400), a: z.array(str(400)).min(2).max(5), c: idx })
  .refine((v) => v.c < v.a.length, { message: "c must index into a", path: ["c"] });

export const SwipeTaskSchema = z.object({
  type: z.literal("swipe"),
  ...taskBase,
  left: str(60),
  right: str(60),
  cards: z.array(z.object({ front: str(200), sub: z.string().max(200).optional(), side: z.enum(["left", "right"]), e: z.string().max(600).optional() })).min(2).max(12),
});

export const TypeTermTaskSchema = z.object({
  type: z.literal("typeterm"),
  ...taskBase,
  definition: str(800),
  answer: str(80),
  accept: z.array(str(80)).max(8).optional(),
  typo: z.number().int().min(0).max(3).optional(),
});

export const ChartTaskSchema = z
  .object({
    type: z.literal("chart"),
    ...taskBase,
    chart: z.object({ kind: z.enum(["bar", "line"]), label: z.string().max(120).optional(), x: z.array(str(40)).min(2).max(12), y: z.array(z.number().min(0)).min(2).max(12) }),
    q: str(400),
    a: z.array(str(200)).min(2).max(5),
    c: idx,
  })
  .refine((v) => v.c < v.a.length && v.chart.x.length === v.chart.y.length, { message: "c must index into a; x and y same length", path: ["c"] });

export const MathStepsTaskSchema = z.object({
  type: z.literal("mathsteps"),
  ...taskBase,
  start: str(200),
  steps: z
    .array(
      z
        .object({ expr: str(200), note: z.string().max(400).optional(), options: z.array(str(200)).min(2).max(6), c: idx })
        .refine((s) => s.c < s.options.length, { message: "c must index into options", path: ["c"] }),
    )
    .min(1)
    .max(8),
});

export const HotspotTaskSchema = z.object({
  type: z.literal("hotspot"),
  ...taskBase,
  image: str(20000),
  alt: z.string().max(200).optional(),
  targets: z.array(z.object({ name: str(80), x: z.number().min(0).max(100), y: z.number().min(0).max(100), r: z.number().min(1).max(60) })).min(1).max(10),
});

export const TaskSchema = z.discriminatedUnion("type", [
  MatchTaskSchema,
  FillTaskSchema,
  OrderTaskSchema,
  SortTaskSchema,
  TfTaskSchema,
  TimelineTaskSchema,
  FindErrorTaskSchema,
  ThesisTaskSchema,
  ChainTaskSchema,
  ScenarioTaskSchema,
  SwipeTaskSchema,
  TypeTermTaskSchema,
  ChartTaskSchema,
  MathStepsTaskSchema,
  HotspotTaskSchema,
]);

export const LevelSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  emoji: z.string().min(1).max(8),
  summary: z.string().max(300).optional(),
  feed: z.array(FeedItemSchema).max(30),
  flashcards: z.array(FlashcardSchema).max(60),
  quiz: z.array(QuizQuestionSchema).max(60),
  games: z.array(MiniGameSchema).max(6).optional(),
  tasks: z.array(TaskSchema).max(20).optional(),
  fromMaterial: z.string().max(80).optional(),
});

export const GradingSchema = z.object({
  pass: z.number().min(0).max(100),
  examMin: z.number().int().min(1).max(240),
  scale: z.array(z.tuple([z.number(), z.string()])).min(1),
  failLabel: z.string().min(1),
});

export const TopicContentSchema = z.object({
  name: z.string().min(1).max(120),
  short: z.string().min(1).max(30),
  emoji: z.string().min(1).max(8),
  tagline: z.string().max(300),
  accent: z.string().min(1).max(200),
  accent2: z.string().min(1).max(40),
  lang: z.boolean().optional(),
  grading: GradingSchema,
  info: z.string().max(20000),
  levels: z.array(LevelSchema).min(1).max(30),
});

/** @deprecated use TopicContentSchema */
export const SubjectContentSchema = TopicContentSchema;
export type TopicContentInput = z.input<typeof TopicContentSchema>;

/* ---------------- AI output shapes (flat: every field present, unused ones empty) ---------------- */

/** Mini-game as the AI returns it — one object with every type's fields. */
export const GenGameSchema = z.object({
  type: z.enum(["match", "cloze", "truefalse", "order"]),
  title: z.string(),
  /** match */
  pairs: z.array(z.object({ l: z.string(), r: z.string() })),
  /** cloze */
  cloze: z.array(z.object({ s: z.string(), answer: z.string(), options: z.array(z.string()), e: z.string() })),
  /** truefalse */
  tf: z.array(z.object({ s: z.string(), v: z.boolean(), e: z.string() })),
  /** order */
  prompt: z.string(),
  steps: z.array(z.string()),
});
export type GenGame = z.infer<typeof GenGameSchema>;

/**
 * Task as the AI returns it — one flat object with every field of every text-only type; fill ONLY your type's
 * fields, leave the rest empty (`""`, `[]`, `0`). `finalizeGenerated()` turns it into a valid `Task` or drops it.
 */
export const GenTaskSchema = z.object({
  type: z.enum(AI_TASK_TYPES),
  title: z.string(),
  /** explanation for the feedback panel */
  e: z.string(),
  /** match: pairs left↔right (4–8) */
  pairs: z.array(z.object({ l: z.string(), r: z.string() })),
  /** fill: text with {0} {1}… gaps, blanks[i] = answer for {i}, bank = distractor tiles, hint */
  text: z.string(),
  blanks: z.array(z.string()),
  bank: z.array(z.string()),
  hint: z.string(),
  /** order: items in the CORRECT order */
  items: z.array(z.string()),
  /** sort: 2–4 buckets with items */
  buckets: z.array(z.object({ name: z.string(), items: z.array(z.string()) })),
  /** tf: statements; seconds = 0 (untimed) or 30–90 */
  seconds: z.number(),
  statements: z.array(z.object({ s: z.string(), v: z.boolean(), e: z.string() })),
  /** timeline: events with years */
  events: z.array(z.object({ label: z.string(), year: z.number() })),
  /** finderror: sentences, wrong = index of the false one, fix = the correct word/phrase */
  sentences: z.array(z.string()),
  wrong: z.number(),
  fix: z.string(),
  /** thesis: quote → options {name, sub}, c = index */
  thesis: z.string(),
  options: z.array(z.object({ name: z.string(), sub: z.string() })),
  /** scenario: scene + q + a (4) + c */
  scene: z.string(),
  q: z.string(),
  a: z.array(z.string()),
  c: z.number(),
  /** chain: steps in order, given = indexes shown from the start, bank = distractors (reuses `bank`) */
  steps: z.array(z.string()),
  given: z.array(z.number()),
  /** swipe: two category names + cards */
  left: z.string(),
  right: z.string(),
  cards: z.array(z.object({ front: z.string(), sub: z.string(), side: z.enum(["left", "right"]), e: z.string() })),
  /** typeterm: definition → answer, accept = variants */
  definition: z.string(),
  answer: z.string(),
  accept: z.array(z.string()),
  /** source (materials mode): page / photo number (0 = unknown) and the sentence it came from ("" = none) */
  src_page: z.number(),
  src_quote: z.string(),
});
export type GenTask = z.infer<typeof GenTaskSchema>;

/**
 * Compact task shape for structured output (the flat GenTaskSchema makes the output grammar too large):
 * `payload` is a JSON string with the type-specific fields (same names as GenTaskSchema). Expanded by `expandGenTask()`.
 */
export const GenTaskCompactSchema = z.object({
  type: z.enum(AI_TASK_TYPES),
  title: z.string(),
  e: z.string(),
  payload: z.string(),
  src_page: z.number(),
  src_quote: z.string(),
});
export type GenTaskCompact = z.infer<typeof GenTaskCompactSchema>;
export const LevelTasksGenSchema = z.object({ tasks: z.array(GenTaskCompactSchema) });

const GenQuizSchema = z.object({ q: z.string(), a: z.array(z.string()), c: z.number(), e: z.string(), src_page: z.number(), src_quote: z.string() });
const GenFeedSchema = z.object({ title: z.string(), body: z.string(), real: z.string(), mnemo: z.string() });
const GenCardSchema = z.object({ t: z.string(), d: z.string() });

/**
 * Schema for what the AI returns (whole topic). Kept slightly simpler than TopicContentSchema so the
 * structured-output grammar stays small; `finalizeGenerated()` fills the rest.
 */
export const GeneratedTopicSchema = z.object({
  name: z.string(),
  short: z.string(),
  emoji: z.string(),
  tagline: z.string(),
  category: z.string(),
  info_html: z.string(),
  levels: z.array(
    z.object({
      title: z.string(),
      emoji: z.string(),
      summary: z.string(),
      feed: z.array(GenFeedSchema),
      flashcards: z.array(GenCardSchema),
      quiz: z.array(z.object({ q: z.string(), a: z.array(z.string()), c: z.number(), e: z.string(), src_page: z.number().optional(), src_quote: z.string().optional() })),
      games: z.array(GenGameSchema),
      /** tasks 2.0 (optional here so older callers / fixtures stay valid) */
      tasks: z.array(GenTaskSchema).optional(),
    }),
  ),
});
export type GeneratedTopic = z.infer<typeof GeneratedTopicSchema>;
/** @deprecated */
export const GeneratedSubjectSchema = GeneratedTopicSchema;
/** @deprecated */
export type GeneratedSubject = GeneratedTopic;

/** Subject shell (container) — validated on create/update. */
export const SubjectInputSchema = z.object({
  name: z.string().min(1).max(60),
  emoji: z.string().min(1).max(8),
  category: z.string().min(1).max(40),
  stage: StageSchema,
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  examLabel: z.string().max(80).nullable().optional(),
});

/** Phase 1 of generation: topic metadata + level outline (small, fast). */
export const OutlineSchema = z.object({
  name: z.string(),
  short: z.string(),
  emoji: z.string(),
  tagline: z.string(),
  category: z.string(),
  info_html: z.string(),
  levels: z.array(
    z.object({
      title: z.string(),
      emoji: z.string(),
      summary: z.string(),
      /** what exactly this level covers (bullet list as text) — used to generate the level in phase 2 */
      scope: z.string(),
    }),
  ),
});
export type Outline = z.infer<typeof OutlineSchema>;

/** Phase 2 of generation: content of ONE level (generated in parallel per level). */
export const LevelGenSchema = z.object({
  feed: z.array(GenFeedSchema),
  flashcards: z.array(GenCardSchema),
  quiz: z.array(GenQuizSchema),
  games: z.array(GenGameSchema),
  tasks: z.array(GenTaskSchema).optional(),
});
export type LevelGen = z.infer<typeof LevelGenSchema>;
/** Core level content without tasks — used as the structured-output format of the level call. */
export const LevelCoreGenSchema = LevelGenSchema.omit({ tasks: true });

export const GenerationOptionsSchema = z.object({
  stage: StageSchema,
  subjectName: z.string().max(80).optional(),
  mode: z.enum(["materials", "prompt"]).optional(),
  hint: z.string().max(2000).optional(),
  levels: z.number().int().min(1).max(8).optional(),
  lang: z.boolean().optional(),
  locale: z.enum(["pl", "en"]).optional(),
});
