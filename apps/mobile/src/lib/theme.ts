/**
 * Recall 2.0 — skóra mobilna. Wszystko z `@nauka/shared` (`TOKENS` = design/tokens.css 1:1). Zero literałów kolorów
 * w ekranach: komponenty biorą `T.*` (tokeny), `TONES[tone]` (płaski kolor + ciemna krawędź + tint) i `accentOf(color)`
 * (motyw przedmiotu = odpowiednik `--accent`, `--accent-dark`, `--on-accent`).
 */
import { COLORS, DROP, HARD_EDGE, PLAY, RADIUS, SPACE, SUBJECT_HUES, TOKENS, TYPE, accentVars, hueDeep, hueFromColor, inkOn, token, type TokenName } from "@nauka/shared";
import type { TextStyle } from "react-native";

export { COLORS, DROP, HARD_EDGE, PLAY, RADIUS, SPACE, SUBJECT_HUES, TOKENS, TYPE, accentVars, hueFromColor, token };
export type { TokenName };

/** Krótkie aliasy tokenów (`T.acid`, `T.surface2`, `T.txt2`…) — nazwy z tokens.css bez myślników. */
export const T = {
  bg: TOKENS.bg,
  surface: TOKENS.surface,
  surface2: TOKENS["surface-2"],
  line: TOKENS.line,
  line2: TOKENS["line-2"],
  shadow: TOKENS.shadow,
  txt: TOKENS.txt,
  txt2: TOKENS["txt-2"],
  muted: TOKENS.muted,
  muted2: TOKENS["muted-2"],
  muted3: TOKENS["muted-3"],
  acid: TOKENS.acid,
  acidDark: TOKENS["acid-dark"],
  onAcid: TOKENS["on-acid"],
  pink: TOKENS.pink,
  pinkDark: TOKENS["pink-dark"],
  onPink: TOKENS["on-pink"],
  amber: TOKENS.amber,
  amberDark: TOKENS["amber-dark"],
  onAmber: TOKENS["on-amber"],
  cyan: TOKENS.cyan,
  cyanDark: TOKENS["cyan-dark"],
  onCyan: TOKENS["on-cyan"],
  gold: TOKENS.gold,
  goldDark: TOKENS["gold-dark"],
  onGold: TOKENS["on-gold"],
  red: TOKENS.red,
  redDark: TOKENS["red-dark"],
  onRed: TOKENS["on-red"],
  violet: TOKENS.violet,
  violetDark: TOKENS["violet-dark"],
  onViolet: TOKENS["on-violet"],
  flame: TOKENS.flame,
  /** wyłączony przycisk (tokens.css `.btn[disabled]`) */
  disabledBg: "#201C3E",
  disabledTxt: "#5C568F",
  /** kreskowana ramka (kafel „dodaj”, zablokowane pola) */
  dash: "#3E3870",
  /** przyciemnione tło pod arkuszem */
  dim: "rgba(8,6,20,0.72)",
} as const;

export type Tone = "acid" | "pink" | "amber" | "cyan" | "gold" | "red" | "violet";

export interface ToneSet {
  name: Tone;
  /** płaski kolor */
  color: string;
  /** ciemna krawędź 3D (`--*-dark`) */
  dark: string;
  /** tusz na kolorze (`--on-*`) */
  on: string;
  /** tint pod kafle i panele */
  tint: string;
  tintLine: string;
  /** jasny tekst na tincie (z podglądów) */
  txt: string;
  /** przygaszony tekst na tincie */
  sub: string;
  /** cień pod kartą w tincie */
  tintShadow: string;
}

export const TONES: Record<Tone, ToneSet> = {
  acid: { name: "acid", color: T.acid, dark: T.acidDark, on: T.onAcid, tint: TOKENS["tint-acid"], tintLine: TOKENS["tint-acid-line"], txt: "#E8FFC7", sub: "#A8C98A", tintShadow: "#16200B" },
  pink: { name: "pink", color: T.pink, dark: T.pinkDark, on: T.onPink, tint: TOKENS["tint-pink"], tintLine: TOKENS["tint-pink-line"], txt: "#FFD6EC", sub: "#C0A8D8", tintShadow: "#170E24" },
  amber: { name: "amber", color: T.amber, dark: T.amberDark, on: T.onAmber, tint: TOKENS["tint-amber"], tintLine: TOKENS["tint-amber-line"], txt: "#FFE3C0", sub: "#D6B48A", tintShadow: "#1B1208" },
  cyan: { name: "cyan", color: T.cyan, dark: T.cyanDark, on: T.onCyan, tint: TOKENS["tint-cyan"], tintLine: TOKENS["tint-cyan-line"], txt: "#C9E8F2", sub: "#7FAEBC", tintShadow: "#071720" },
  gold: { name: "gold", color: T.gold, dark: T.goldDark, on: T.onGold, tint: TOKENS["tint-gold"], tintLine: TOKENS["tint-gold-line"], txt: "#FFD98A", sub: "#D6B48A", tintShadow: "#1A1409" },
  red: { name: "red", color: T.red, dark: T.redDark, on: T.onRed, tint: TOKENS["tint-red"], tintLine: TOKENS["tint-red-line"], txt: "#FFD4DC", sub: "#C98FA0", tintShadow: "#14060A" },
  violet: { name: "violet", color: T.violet, dark: T.violetDark, on: T.onViolet, tint: TOKENS["tint-pink"], tintLine: TOKENS["tint-pink-line"], txt: "#D6B4F5", sub: "#C0A8D8", tintShadow: "#12081C" },
};

/** Jasne odcienie do liczników w pigułkach (podglądy: seria #FFB27A, gemy #7EE8FA, serca #FF8FA3). */
export const PILL_TXT = { streak: "#FFB27A", gems: "#7EE8FA", hearts: "#FF8FA3", acidSoft: "#C6F58A" } as const;

/** Motyw przedmiotu: `accent` (kolor), `dark` (krawędź), `on` (tusz), tint — odpowiednik `accentVars()` dla RN. */
export type Accent = ToneSet;

const BY_HEX = new Map<string, ToneSet>(Object.values(TONES).map((t) => [t.color.toLowerCase(), t]));

/** Kolor przedmiotu (`subjects.accent2`, jeden z SUBJECT_HUES) → pełny zestaw. Obce hexy dostają krawędź z `hueDeep`. */
export function accentOf(color?: string | null, seed?: string): Accent {
  const c = color && /^#[0-9a-f]{6}$/i.test(color.trim()) ? color.trim() : null;
  if (!c) return seed ? accentOf(SUBJECT_HUES[hash(seed) % SUBJECT_HUES.length]!.color) : TONES.acid;
  const known = BY_HEX.get(c.toLowerCase());
  if (known) return known;
  const h = hueFromColor(c);
  return { name: "acid", color: c, dark: h.deep || hueDeep(c), on: h.on || inkOn(c), tint: h.soft, tintLine: h.softLine ?? h.deep, txt: T.txt, sub: T.muted, tintShadow: T.shadow };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Nazwy rodzin fontów = klucze, pod którymi expo-font ładuje pliki (app/_layout.tsx). */
export const FONT = {
  display700: "BricolageGrotesque_700Bold",
  display800: "BricolageGrotesque_800ExtraBold",
  body500: "PlusJakartaSans_500Medium",
  body600: "PlusJakartaSans_600SemiBold",
  body700: "PlusJakartaSans_700Bold",
  body800: "PlusJakartaSans_800ExtraBold",
} as const;

export function display(weight: 700 | 800 = 800): string {
  return weight === 700 ? FONT.display700 : FONT.display800;
}
export function body(weight: 500 | 600 | 700 | 800 = 600): string {
  return weight === 800 ? FONT.body800 : weight === 700 ? FONT.body700 : weight === 600 ? FONT.body600 : FONT.body500;
}

export function withAlpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const tabular: TextStyle = { fontVariant: ["tabular-nums"] };

/** Wymiary z podglądów 390×844. */
export const UI = {
  gutter: 18,
  btnH: 58,
  btnHsm: 46,
  node: 74,
  nodeCurrent: 88,
  round: 40,
  tabBarH: 64,
} as const;
