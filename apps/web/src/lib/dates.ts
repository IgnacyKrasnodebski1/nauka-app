import { dayDiff, pl, todayStr } from "@nauka/shared";

export const DAYS = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
export const DAYS_S = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];
export const MONTHS = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
export const MONTHS_S = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
export const DAY_OF = ["niedzieli", "poniedziałku", "wtorku", "środy", "czwartku", "piątku", "soboty"];
export const DAY_IN = ["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"];

export function dateOf(ds: string): Date {
  const p = ds.split("-").map(Number) as [number, number, number];
  return new Date(p[0], p[1] - 1, p[2]);
}
export function addDays(ds: string, k: number): string {
  const p = ds.split("-").map(Number) as [number, number, number];
  return todayStr(new Date(p[0], p[1] - 1, p[2] + k));
}
export function fmtDate(ds: string): string {
  const d = dateOf(ds);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function dateHeader(d = new Date()): string {
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function inDays(n: number): string {
  return n === 0 ? "dziś" : n === 1 ? "jutro" : `za ${n} ${pl(n, "dzień", "dni", "dni")}`;
}
export function fmtNum(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
export function fmtSecs(s: number): string {
  const m = Math.floor(s / 60), x = s % 60;
  return `${m}:${String(x).padStart(2, "0")}`;
}
export function etaText(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} ${pl(m, "minutę", "minuty", "minut")}`;
}
export function untilDate(ds: string): number {
  return dayDiff(todayStr(), ds);
}
/** Monday..Sunday (YYYY-MM-DD) of the week `offset` weeks from the current one. */
export function weekRange(offset = 0, now = new Date()): string[] {
  const dow = (now.getDay() + 6) % 7;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + offset * 7);
  return Array.from({ length: 7 }, (_, i) => todayStr(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i)));
}
/** Strip emoji from data titles (zero emoji in the UI; feed HTML stays). */
export function noEmoji(t: string | undefined | null): string {
  return String(t ?? "").replace(/[\p{Extended_Pictographic}️‍]/gu, "").replace(/\s+/g, " ").trim();
}
/** First letter / digit of a name — monogram in a coloured tile instead of an emoji. */
export function initial(s: string | undefined | null): string {
  const m = String(s ?? "").match(/[\p{L}\p{N}]/u);
  return m ? m[0]!.toUpperCase() : "?";
}
/** Two-letter initials for avatars (Profile.html "IK"). */
export function initials(s: string | undefined | null): string {
  const parts = String(s ?? "").trim().split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}
export const KEYS = ["A", "B", "C", "D", "E"] as const;
