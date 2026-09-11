import type { Stage, Subject, Topic, TopicContent } from "@nauka/shared";

/** `subjects` row (user's container shell). */
export interface SubjectRow {
  id: string;
  owner_id: string;
  name: string;
  emoji: string;
  category: string;
  stage: Stage;
  accent: string;
  accent2: string;
  exam_date: string | null;
  exam_label: string | null;
  position: number;
  created_at?: string;
  updated_at?: string;
}

export const SUBJECT_SELECT = "id,owner_id,name,emoji,category,stage,accent,accent2,exam_date,exam_label,position,created_at,updated_at";

export function rowToSubject(r: SubjectRow): Subject {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    emoji: r.emoji,
    category: r.category,
    stage: r.stage,
    accent: r.accent,
    accent2: r.accent2,
    examDate: r.exam_date,
    examLabel: r.exam_label,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** `topics` row (AI-generated unit inside a subject). */
export interface TopicRow {
  id: string;
  subject_id: string;
  owner_id: string;
  name: string;
  emoji: string;
  source: "materials" | "prompt";
  content: TopicContent;
  generation_id: string | null;
  position: number;
  created_at?: string;
  updated_at?: string;
}

export const TOPIC_SELECT = "id,subject_id,owner_id,name,emoji,source,content,generation_id,position,created_at,updated_at";

export function rowToTopic(r: TopicRow): Topic {
  return {
    ...r.content,
    name: r.name || r.content.name,
    emoji: r.emoji || r.content.emoji,
    id: r.id,
    subjectId: r.subject_id,
    ownerId: r.owner_id,
    position: r.position,
    source: r.source,
    generationId: r.generation_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Topic without feed bodies / games — enough for progress, sessions, flashcards and exams; keeps payloads small. */
export type SlimTopic = Topic;

export function slimTopic(t: Topic): SlimTopic {
  return { ...t, info: "", levels: t.levels.map((l) => ({ ...l, feed: [], games: [] })) };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID_RE.test(s);

/** Days until `date` (YYYY-MM-DD) from today, negative when past. */
export function daysUntil(date: string, today = new Date()): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const target = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - now) / 86400000);
}

export function examBadge(examDate: string | null | undefined, label?: string | null): string | null {
  if (!examDate) return null;
  const n = daysUntil(examDate);
  const what = label?.trim() || "sprawdzian";
  if (n < 0) return `${what} był ${-n} dni temu`;
  if (n === 0) return `${what} DZIŚ`;
  if (n === 1) return `${what} jutro`;
  return `${what} za ${n} dni`;
}
