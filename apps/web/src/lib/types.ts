import type { Stage, Subject, SubjectContent } from "@nauka/shared";

/** Subject as used by the web UI: shared `Subject` + slug (seed subjects are addressable by slug). */
export interface AppSubject extends Subject {
  slug?: string | null;
}

export interface SubjectRow {
  id: string;
  slug: string | null;
  owner_id: string | null;
  name: string;
  stage: Stage;
  category: string | null;
  is_public: boolean;
  content: SubjectContent;
  created_at?: string;
  updated_at?: string;
}

export function rowToSubject(r: SubjectRow): AppSubject {
  return {
    ...r.content,
    id: r.id,
    slug: r.slug,
    ownerId: r.owner_id,
    stage: r.stage,
    isPublic: r.is_public,
    category: r.category,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Seed subject JSON shape from @nauka/content. */
export interface SeedSubject {
  id: string;
  stage: Stage;
  category: string;
  isPublic: boolean;
  content: SubjectContent;
}

export function seedToSubject(s: SeedSubject): AppSubject {
  return { ...s.content, id: s.id, slug: s.id, ownerId: null, stage: s.stage, isPublic: true, category: s.category };
}

/** Key under which progress for this subject is stored locally (legacy-compatible: seed slug). */
export function localKeyFor(s: Pick<AppSubject, "id" | "slug">): string {
  return s.slug || s.id;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID_RE.test(s);

export type ProgressMap = Record<string, import("@nauka/shared").SubjectProgress>;
