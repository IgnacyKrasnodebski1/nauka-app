import { z } from "zod";

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

export const QuizQuestionSchema = z
  .object({
    q: z.string().min(1).max(1000),
    a: z.array(z.string().min(1).max(500)).min(2).max(5),
    c: z.number().int().min(0),
    e: z.string().min(1).max(2000),
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

export const LevelSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  emoji: z.string().min(1).max(8),
  summary: z.string().max(300).optional(),
  feed: z.array(FeedItemSchema).max(30),
  flashcards: z.array(FlashcardSchema).max(60),
  quiz: z.array(QuizQuestionSchema).max(60),
  games: z.array(MiniGameSchema).max(6).optional(),
});

export const GradingSchema = z.object({
  pass: z.number().min(0).max(100),
  examMin: z.number().int().min(1).max(240),
  scale: z.array(z.tuple([z.number(), z.string()])).min(1),
  failLabel: z.string().min(1),
});

export const SubjectContentSchema = z.object({
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

export type SubjectContentInput = z.input<typeof SubjectContentSchema>;

/**
 * Schema for what the AI returns. Kept slightly simpler than SubjectContentSchema so the
 * structured-output grammar stays small; `finalizeGenerated()` fills the rest.
 */
export const GeneratedSubjectSchema = z.object({
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
      feed: z.array(z.object({ title: z.string(), body: z.string(), real: z.string(), mnemo: z.string() })),
      flashcards: z.array(z.object({ t: z.string(), d: z.string() })),
      quiz: z.array(z.object({ q: z.string(), a: z.array(z.string()), c: z.number(), e: z.string() })),
      games: z.array(
        z.object({
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
        }),
      ),
    }),
  ),
});
export type GeneratedSubject = z.infer<typeof GeneratedSubjectSchema>;

export const GenerationOptionsSchema = z.object({
  stage: StageSchema,
  hint: z.string().max(2000).optional(),
  levels: z.number().int().min(1).max(8).optional(),
  lang: z.boolean().optional(),
  locale: z.enum(["pl", "en"]).optional(),
});
