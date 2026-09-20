/**
 * Motyw „Duolingo in dark” — tokeny z @nauka/shared (docs/DESIGN.md). Nic nie hardkodujemy w komponentach.
 */
import { COLORS, HARD_EDGE, MOTION, PLAY, RADIUS, SHADOW, SPACE, SUBJECT_HUES, TYPE, hueDeep, hueFromColor, subjectHue } from "@nauka/shared";
import type { TextStyle, ViewStyle } from "react-native";

export { COLORS, HARD_EDGE, MOTION, PLAY, RADIUS, SHADOW, SPACE, SUBJECT_HUES, TYPE, hueDeep, hueFromColor, subjectHue };

/** Nazwy rodzin fontów = klucze pod którymi expo-font je ładuje (identyczne na iOS/Android/web). */
export const FONT = {
  display600: "BricolageGrotesque_600SemiBold",
  display700: "BricolageGrotesque_700Bold",
  display800: "BricolageGrotesque_800ExtraBold",
  body400: "Manrope_400Regular",
  body500: "Manrope_500Medium",
  body600: "Manrope_600SemiBold",
  body700: "Manrope_700Bold",
} as const;

export function display(weight: 600 | 700 | 800 = 700): string {
  return weight === 800 ? FONT.display800 : weight === 600 ? FONT.display600 : FONT.display700;
}
export function body(weight: 400 | 500 | 600 | 700 = 400): string {
  return weight === 700 ? FONT.body700 : weight === 600 ? FONT.body600 : weight === 500 ? FONT.body500 : FONT.body400;
}

/** Kolor przedmiotu: `subjects.accent2` (SUBJECT_HUES) → warianty do ringów, poświat, pasków i krawędzi 3D (`deep`). */
export interface Hue {
  color: string;
  /** ciemniejszy odcień pod krawędź 3D */
  deep: string;
  soft: string;
  ring: string;
  glow: string;
}

export function withAlpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function hueFrom(color?: string | null, seed?: string): Hue {
  let c = color && /^#[0-9a-f]{6}$/i.test(color.trim()) ? color.trim() : null;
  if (!c) c = subjectHue(seed ?? "recall").color;
  const known = hueFromColor(c);
  return { color: c, deep: known.deep, soft: known.soft, ring: withAlpha(c, 0.4), glow: withAlpha(c, 0.14) };
}

export const GOLD_HUE: Hue = { color: COLORS.accent, deep: COLORS.accentDeep, soft: withAlpha(COLORS.accent, 0.16), ring: withAlpha(COLORS.accent, 0.4), glow: COLORS.accentGlow };
export const GREEN_HUE: Hue = { color: PLAY.green, deep: PLAY.greenDeep, soft: PLAY.greenSoft, ring: withAlpha(PLAY.green, 0.4), glow: withAlpha(PLAY.green, 0.14) };

/** Cienie (RN nie ma inset — górny highlight robimy osobnym 1px View, patrz <Card>). */
export const shadowCard: ViewStyle = { shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 };
export const shadowGlow: ViewStyle = { shadowColor: COLORS.accent, shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 };
export const shadowOverlay: ViewStyle = { shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 40, shadowOffset: { width: 0, height: 24 }, elevation: 16 };

export const tabular: TextStyle = { fontVariant: ["tabular-nums"] };

/** Wysokości/kształty z DESIGN.md */
export const UI = { buttonH: 52, buttonHsm: 40, inputH: 48, tile: 52, node: 76, gutter: SPACE[4] } as const;
