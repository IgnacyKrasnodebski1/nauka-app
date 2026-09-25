import { dayDiff, todayStr } from "@nauka/shared";

/** Polskie daty i liczebniki (legacy engine.js: DAYS, MONTHS, fmt, etaText, inDays…). */
export const DAYS = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
export const DAYS_S = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];
export const DAY_OF = ["niedzieli", "poniedziałku", "wtorku", "środy", "czwartku", "piątku", "soboty"];
export const MONTHS = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
export const MONTHS_S = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

export function pl(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n);
  if (a === 1) return one;
  const m10 = a % 10,
    m100 = a % 100;
  return m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
}
export const npl = (n: number, one: string, few: string, many: string) => `${n} ${pl(n, one, few, many)}`;

export function dateHeader(d = new Date()): string {
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function dateOf(ds: string): Date {
  const p = ds.split("-").map(Number);
  return new Date(p[0]!, (p[1] ?? 1) - 1, p[2] ?? 1);
}
export function fmtDate(ds: string): string {
  const d = dateOf(ds);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function fmtDateShort(ds: string): string {
  const d = dateOf(ds);
  return `${DAYS[d.getDay()]!.toLowerCase()}, ${d.getDate()} ${MONTHS_S[d.getMonth()]}`;
}
export function addDays(ds: string, k: number): string {
  const d = dateOf(ds);
  d.setDate(d.getDate() + k);
  return todayStr(d);
}
export function inDays(n: number): string {
  return n === 0 ? "dziś" : n === 1 ? "jutro" : n < 0 ? "minął" : `za ${npl(n, "dzień", "dni", "dni")}`;
}
export function daysUntil(ds: string): number {
  return dayDiff(todayStr(), ds);
}
/** m:ss */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
/** „23 minuty” / „1 h 5 min” z ms */
export function etaText(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : npl(m, "minutę", "minuty", "minut");
}
export function fmtNum(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
/** Czas „teraz” przez funkcję pomocniczą — komponenty nie wołają Date bezpośrednio w renderze (react-hooks/purity). */
export const nowMs = () => Date.now();
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const dateFromIso = (iso: string) => new Date(iso);
/** ms do północy (misje, cram) */
export function msToMidnight(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}
export function minutesSince(startMs: number): number {
  return Math.max(1, Math.round((Date.now() - startMs) / 60000));
}
/** tytuły z danych bez emoji (zero emoji w UI) */
export function noEmoji(t: string | undefined | null): string {
  return String(t ?? "")
    .replace(/[\p{Extended_Pictographic}️‍]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
export const ORD = ["", "Pierwsza", "Druga", "Trzecia", "Czwarta", "Piąta", "Szósta", "Siódma", "Ósma", "Dziewiąta", "Dziesiąta"];
export function comboText(c: number): string {
  return c >= 2 ? `${ORD[c] ?? c + "."} poprawna z rzędu` : "Tak trzymaj";
}
export const KEYS_ABC = ["A", "B", "C", "D", "E"] as const;
/** „Twoje imię” z profilu / maila → „IK” */
export function initials(name: string | null | undefined, email?: string | null): string {
  const src = (name && name.trim()) || (email ? email.split("@")[0] : "") || "";
  const parts = src.replace(/[._-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const a = parts[0]![0] ?? "";
  const b = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : (parts[0]![1] ?? "");
  return (a + b).toUpperCase();
}
export function firstName(name: string | null | undefined, email?: string | null): string {
  const src = (name && name.trim()) || (email ? email.split("@")[0]! : "") || "Ty";
  const p = src.replace(/[._-]+/g, " ").trim().split(/\s+/)[0] ?? "Ty";
  return p.charAt(0).toUpperCase() + p.slice(1);
}
