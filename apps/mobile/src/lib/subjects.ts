import type { Stage, Subject, SubjectContent } from "@nauka/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KEYS, getJson, setJson } from "./storage";

/** Przedmiot w UI: shared `Subject` + slug (seedy adresowane po slugu, żeby postępy gościa były kompatybilne z legacy). */
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

export interface SeedSubject {
  id: string;
  stage: Stage;
  category: string;
  isPublic: boolean;
  content: SubjectContent;
}

export const SELECT = "id,slug,owner_id,name,stage,category,is_public,content,created_at,updated_at";

export function rowToSubject(r: SubjectRow): AppSubject {
  return { ...r.content, id: r.id, slug: r.slug, ownerId: r.owner_id, stage: r.stage, isPublic: r.is_public, category: r.category, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function seedToSubject(s: SeedSubject): AppSubject {
  return { ...s.content, id: s.id, slug: s.id, ownerId: null, stage: s.stage, isPublic: s.isPublic, category: s.category };
}

/**
 * Seedy z @nauka/content. Metro nie wspiera `import x from "./a.json" with { type: "json" }`
 * (packages/content/index.js), więc ładujemy pliki JSON bezpośrednio przez require — lista taka sama jak w index.js.
 */
export function loadSeedSubjects(): AppSubject[] {
  const files: SeedSubject[] = [
    require("@nauka/content/subjects/makro.json"),
    require("@nauka/content/subjects/makrokolos.json"),
    require("@nauka/content/subjects/krypto.json"),
    require("@nauka/content/subjects/hiszpanski.json"),
    require("@nauka/content/subjects/angielski.json"),
    require("@nauka/content/subjects/psychologia.json"),
    require("@nauka/content/subjects/globalizacja.json"),
  ];
  return files.map(seedToSubject);
}

/** Klucz postępów: gość + seed → slug (legacy), reszta → uuid. */
export function progressKey(s: Pick<AppSubject, "id" | "slug" | "ownerId">, kind: "local" | "supabase"): string {
  if (kind === "local" && s.ownerId === null && s.slug) return s.slug;
  return s.id;
}

/* ------------------------------------------------------------ remote */

export async function fetchPublicSubjects(sb: SupabaseClient): Promise<AppSubject[] | null> {
  const { data, error } = await sb.from("subjects").select(SELECT).eq("is_public", true).order("created_at", { ascending: true });
  if (error || !data) return null;
  return (data as SubjectRow[]).map(rowToSubject);
}

export async function fetchOwnSubjects(sb: SupabaseClient, userId: string): Promise<AppSubject[]> {
  const { data } = await sb.from("subjects").select(SELECT).eq("owner_id", userId).order("created_at", { ascending: false });
  return ((data ?? []) as SubjectRow[]).map(rowToSubject);
}

export async function fetchLibraryIds(sb: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await sb.from("library").select("subject_id").eq("user_id", userId);
  return ((data ?? []) as { subject_id: string }[]).map((r) => r.subject_id);
}

export async function fetchSubjectById(sb: SupabaseClient, idOrSlug: string, uuid: boolean): Promise<AppSubject | null> {
  const q = uuid ? sb.from("subjects").select(SELECT).eq("id", idOrSlug) : sb.from("subjects").select(SELECT).eq("slug", idOrSlug).is("owner_id", null);
  const { data } = await q.maybeSingle();
  return data ? rowToSubject(data as SubjectRow) : null;
}

/* ------------------------------------------------------------- cache (offline) */

export interface SubjectsCache {
  /** wszystkie znane przedmioty (public + własne) */
  subjects: AppSubject[];
  savedAt: string;
}

export async function readSubjectsCache(): Promise<AppSubject[]> {
  const c = await getJson<SubjectsCache | null>(KEYS.subjectsCache, null);
  return c?.subjects ?? [];
}

export async function writeSubjectsCache(subjects: AppSubject[]): Promise<void> {
  await setJson(KEYS.subjectsCache, { subjects, savedAt: new Date().toISOString() } satisfies SubjectsCache);
}

/** Scala listy po id (późniejsze wygrywają). */
export function mergeById(...lists: AppSubject[][]): AppSubject[] {
  const map = new Map<string, AppSubject>();
  for (const l of lists) for (const s of l) map.set(s.id, s);
  return [...map.values()];
}
