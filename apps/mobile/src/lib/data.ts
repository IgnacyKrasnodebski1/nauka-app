import { normalizeMeta, paletteFor, todayStr, type ActivityMap, type BossRecord, type GhostRecord, type Plan, type Quest, type Stage, type Subject, type SubjectProgress, type Topic, type TopicContent, type SrsCard, type UserMeta, type WeakMap } from "@nauka/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyExtra, normalizeExtra, type Extra, type Goal } from "./extra";
import { KEYS, getJson, setJson } from "./storage";

/** Mapowanie wierszy Supabase → typy shared. Wszystko tylko własne (RLS). */

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

/** true, gdy baza ma kolumny z 0003_recall2.sql (ustawiane po pierwszym pełnym pobraniu; bez nich zapisy pomijają nowe kolumny). */
export let hasV2Columns = true;

export const SUBJECT_SELECT = "id,owner_id,name,emoji,category,stage,accent,accent2,exam_date,exam_label,position,created_at,updated_at";
export const TOPIC_SELECT = "id,subject_id,owner_id,name,emoji,source,content,generation_id,position,created_at,updated_at";

export function rowToSubject(r: SubjectRow): Subject {
  return { id: r.id, ownerId: r.owner_id, name: r.name, emoji: r.emoji, category: r.category, stage: r.stage, accent: r.accent, accent2: r.accent2, examDate: r.exam_date, examLabel: r.exam_label, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function rowToTopic(r: TopicRow): Topic {
  return { ...r.content, name: r.name || r.content.name, emoji: r.emoji || r.content.emoji, id: r.id, subjectId: r.subject_id, ownerId: r.owner_id, position: r.position, source: r.source, generationId: r.generation_id, createdAt: r.created_at, updatedAt: r.updated_at };
}

export type SrsMap = Record<string, SrsCard>;

export interface UserData {
  subjects: Subject[];
  topics: Topic[];
  progress: Record<string, SubjectProgress>;
  srs: Record<string, SrsMap>;
  weak: WeakMap;
  meta: UserMeta;
  stage: Stage | null;
  /** profiles.plan — zmienia tylko webhook Stripe */
  plan: Plan;
  showOnLeaderboard: boolean;
  displayName: string | null;
  /** questy z `quests_daily` na dziś (null = brak wiersza) */
  quests: Quest[] | null;
  /** klucze odblokowanych odznak */
  achievements: string[];
  /** aktywność z ostatnich dni (dzień → xp/minuty) */
  activity: ActivityMap;
  /** Recall 2.0: user_meta.* z migracji 0003 + profiles.goal */
  extra: Extra;
}

/** Wiersz `user_meta` → UserMeta (brakujące pola uzupełnia `normalizeMeta`). */
export interface MetaRow {
  streak: number;
  best: number;
  last_day: string | null;
  gems?: number;
  hearts?: number;
  hearts_updated_at?: string;
  daily_goal?: number;
  streak_freezes?: number;
  sound_on?: boolean;
  stats?: Partial<UserMeta["stats"]> | null;
  /* 0003_recall2 */
  themes?: Extra["themes"] | null;
  boost_until?: string | null;
  album?: Extra["album"] | null;
  overrides?: Extra["overrides"] | null;
  tests?: Extra["tests"] | null;
  weekly_quest?: Quest | null;
  history?: Extra["history"] | null;
  daily?: Extra["daily"] | null;
  reduce_motion?: boolean | null;
  reminder?: Extra["reminder"] | null;
  exams?: Extra["exams"] | null;
}
export function rowToMeta(m: MetaRow | null): UserMeta {
  if (!m) return normalizeMeta(null);
  return normalizeMeta({
    streak: m.streak,
    best: m.best,
    lastDay: m.last_day,
    gems: m.gems,
    hearts: m.hearts,
    heartsUpdatedAt: m.hearts_updated_at,
    dailyGoal: m.daily_goal as UserMeta["dailyGoal"] | undefined,
    streakFreezes: m.streak_freezes,
    soundOn: m.sound_on,
    stats: (m.stats ?? undefined) as UserMeta["stats"] | undefined,
  });
}
export const META_SELECT_V1 = "streak,best,last_day,gems,hearts,hearts_updated_at,daily_goal,streak_freezes,sound_on,stats";
export const META_SELECT = META_SELECT_V1 + ",themes,boost_until,album,overrides,tests,weekly_quest,history,daily,reduce_motion,reminder,exams";

export function rowToExtra(m: MetaRow | null, goal: Goal | null | undefined): Extra {
  const e = emptyExtra();
  if (!m) return { ...e, goal: goal ?? null };
  return normalizeExtra({
    goal: goal ?? null,
    themes: m.themes ?? undefined,
    boostUntil: m.boost_until ? new Date(m.boost_until).getTime() : null,
    album: m.album ?? undefined,
    overrides: m.overrides ?? undefined,
    tests: m.tests ?? undefined,
    weekly: m.weekly_quest ?? null,
    history: m.history ?? undefined,
    daily: m.daily ?? null,
    reduceMotion: !!m.reduce_motion,
    reminder: m.reminder ?? null,
    exams: m.exams ?? undefined,
  });
}

/** Ostatnie N dni (YYYY-MM-DD) do zapytania o aktywność. */
export function daysAgoStr(n: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return todayStr(d);
}

const clampStars = (n: number) => Math.max(0, Math.min(3, Math.round(n || 0))) as 0 | 1 | 2 | 3;

export function normaliseProgress(p: Partial<SubjectProgress> | null | undefined): SubjectProgress {
  const levels: SubjectProgress["levels"] = {};
  for (const [id, l] of Object.entries(p?.levels ?? {})) {
    const lv = l as Partial<SubjectProgress["levels"][string]>;
    levels[id] = { done: !!lv.done, best: Number(lv.best ?? 0), stars: clampStars(Number(lv.stars ?? 0)), attempts: Number(lv.attempts ?? (lv.done ? 1 : 0)) };
  }
  const out: SubjectProgress = { xp: Number(p?.xp ?? 0), levels };
  if (p?.bestExam !== undefined && p.bestExam !== null) out.bestExam = p.bestExam;
  if (Array.isArray(p?.chests) && p.chests.length) out.chests = p.chests.map(Number);
  if (p?.boss && typeof p.boss === "object") out.boss = { done: !!p.boss.done, n: Number(p.boss.n ?? 0), at: p.boss.at, best: p.boss.best };
  if (p?.ghost && typeof p.ghost === "object" && Object.keys(p.ghost).length) out.ghost = p.ghost as Record<string, GhostRecord>;
  return out;
}

/** Pełne pobranie danych usera (jedno „odświeżenie”). */
export async function fetchUserData(sb: SupabaseClient, userId: string): Promise<UserData> {
  const today = todayStr();
  // kolumny z migracji 0003 — gdy baza ich jeszcze nie ma, wracamy do starego zestawu (apka nie może się wywalić)
  const [subj, top, prog0, srs, meta0, prof0, quests, ach, act] = await Promise.all([
    sb.from("subjects").select(SUBJECT_SELECT).eq("owner_id", userId).order("position", { ascending: true }).order("created_at", { ascending: true }),
    sb.from("topics").select(TOPIC_SELECT).eq("owner_id", userId).order("position", { ascending: true }).order("created_at", { ascending: true }),
    sb.from("progress").select("topic_id,xp,levels,weak,best_exam,chests,boss,ghost").eq("user_id", userId),
    sb.from("srs_cards").select("topic_id,card_key,state").eq("user_id", userId),
    sb.from("user_meta").select(META_SELECT).eq("user_id", userId).maybeSingle(),
    sb.from("profiles").select("stage,plan,show_on_leaderboard,display_name,goal").eq("id", userId).maybeSingle(),
    sb.from("quests_daily").select("day,quests").eq("user_id", userId).eq("day", today).maybeSingle(),
    sb.from("achievements").select("key").eq("user_id", userId),
    sb.from("activity").select("day,xp,minutes").eq("user_id", userId).gte("day", daysAgoStr(13)),
  ]);
  type Res = { data: unknown; error: { message: string } | null };
  let prog: Res = prog0, meta: Res = meta0, prof: Res = prof0;
  let v2 = true;
  if (prog.error || meta.error || prof.error) {
    v2 = false;
    console.warn("[data] 0003 columns missing → v1 selects", (prog.error ?? meta.error ?? prof.error)?.message);
    [prog, meta, prof] = await Promise.all([
      sb.from("progress").select("topic_id,xp,levels,weak,best_exam,chests").eq("user_id", userId),
      sb.from("user_meta").select(META_SELECT_V1).eq("user_id", userId).maybeSingle(),
      sb.from("profiles").select("stage,plan,show_on_leaderboard,display_name").eq("id", userId).maybeSingle(),
    ]);
  }
  hasV2Columns = v2;
  const firstErr = [subj, top, prog, srs, meta, prof].find((r) => r.error)?.error;
  if (firstErr) throw new Error(firstErr.message);
  // tabele z migracji 0002 — gdy brak (stara baza), nie blokujemy ładowania
  for (const r of [quests, ach, act]) if (r.error) console.warn("[data] optional query failed", r.error.message);

  const progress: Record<string, SubjectProgress> = {};
  const weak: WeakMap = {};
  for (const r of (prog.data ?? []) as { topic_id: string; xp: number; levels: SubjectProgress["levels"]; weak: Record<string, number[]> | null; best_exam: number | null; chests?: number[] | null; boss?: BossRecord | null; ghost?: Record<string, GhostRecord> | null }[]) {
    progress[r.topic_id] = normaliseProgress({ xp: r.xp, levels: r.levels, bestExam: r.best_exam ?? undefined, chests: r.chests ?? undefined, boss: r.boss ?? undefined, ghost: r.ghost ?? undefined });
    if (r.weak && Object.keys(r.weak).length) weak[r.topic_id] = r.weak;
  }
  const srsMap: Record<string, SrsMap> = {};
  for (const r of (srs.data ?? []) as { topic_id: string; card_key: string; state: SrsCard }[]) (srsMap[r.topic_id] ??= {})[r.card_key] = r.state;
  const p = prof.data as { stage: Stage | null; plan: Plan | null; show_on_leaderboard: boolean | null; display_name: string | null; goal?: Goal | null } | null;
  const activity: ActivityMap = {};
  for (const r of (act.data ?? []) as { day: string; xp: number; minutes: number }[]) activity[r.day] = { day: r.day, xp: Number(r.xp ?? 0), minutes: Number(r.minutes ?? 0) };
  const q = quests.data as { day: string; quests: Quest[] } | null;
  return {
    subjects: ((subj.data ?? []) as SubjectRow[]).map(rowToSubject),
    topics: ((top.data ?? []) as TopicRow[]).map(rowToTopic),
    progress,
    srs: srsMap,
    weak,
    meta: rowToMeta(meta.data as MetaRow | null),
    stage: p?.stage ?? null,
    plan: p?.plan ?? "free",
    showOnLeaderboard: p?.show_on_leaderboard ?? true,
    displayName: p?.display_name ?? null,
    quests: q && Array.isArray(q.quests) ? q.quests : null,
    achievements: ((ach.data ?? []) as { key: string }[]).map((r) => r.key),
    activity,
    extra: rowToExtra(meta.data as MetaRow | null, p?.goal ?? null),
  };
}


export async function fetchTopic(sb: SupabaseClient, topicId: string): Promise<Topic | null> {
  const { data } = await sb.from("topics").select(TOPIC_SELECT).eq("id", topicId).maybeSingle();
  return data ? rowToTopic(data as TopicRow) : null;
}

export interface SubjectInput {
  name: string;
  emoji: string;
  category: string;
  stage: Stage;
  examDate?: string | null;
  examLabel?: string | null;
}

/** Wstawia przedmioty (kolor z `paletteFor(name)`). Zwraca wiersze. */
export async function insertSubjects(sb: SupabaseClient, userId: string, inputs: SubjectInput[], startPosition = 0): Promise<Subject[]> {
  if (!inputs.length) return [];
  const rows = inputs.map((s, i) => {
    const [accent, accent2] = paletteFor(s.name);
    return { owner_id: userId, name: s.name.trim(), emoji: s.emoji || "📘", category: s.category, stage: s.stage, accent, accent2, exam_date: s.examDate ?? null, exam_label: s.examLabel ?? null, position: startPosition + i };
  });
  const { data, error } = await sb.from("subjects").insert(rows).select(SUBJECT_SELECT);
  if (error) throw new Error(error.message);
  return ((data ?? []) as SubjectRow[]).map(rowToSubject);
}

/* ------------------------------------------------------------- cache (offline read) */

export async function readCache(userId: string): Promise<UserData | null> {
  const c = await getJson<Partial<UserData> | null>(`${KEYS.cache}:${userId}`, null);
  if (!c || !c.subjects || !c.topics) return null;
  return {
    subjects: c.subjects,
    topics: c.topics,
    progress: c.progress ?? {},
    srs: c.srs ?? {},
    weak: c.weak ?? {},
    meta: normalizeMeta(c.meta ?? null),
    stage: c.stage ?? null,
    plan: c.plan ?? "free",
    showOnLeaderboard: c.showOnLeaderboard ?? true,
    displayName: c.displayName ?? null,
    quests: c.quests ?? null,
    achievements: c.achievements ?? [],
    activity: c.activity ?? {},
    extra: normalizeExtra(c.extra ?? null),
  };
}
export async function writeCache(userId: string, d: UserData): Promise<void> {
  await setJson(`${KEYS.cache}:${userId}`, d);
}
