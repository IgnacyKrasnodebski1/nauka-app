/** Motyw NAUKA — port legacy/styles.css (dark, neon). Akcent per przedmiot: gradient z `accent` + kolor `accent2`. */
export const C = {
  bg: "#0a0a12",
  bg2: "#12121f",
  card: "#1a1a2e",
  card2: "#222238",
  txt: "#f2f2fa",
  muted: "#9a9ab8",
  pink: "#ff2d95",
  purple: "#a855f7",
  cyan: "#22d3ee",
  lime: "#aaff00",
  orange: "#ff7a00",
  red: "#ff3b5c",
  green: "#1ed760",
  border: "rgba(255,255,255,0.08)",
  border2: "rgba(255,255,255,0.14)",
  faint: "rgba(255,255,255,0.05)",
  faint2: "rgba(255,255,255,0.08)",
  okBg: "#13351f",
  okTxt: "#c9ffd9",
  badBg: "#35161f",
  badTxt: "#ffd0da",
  selBg: "#2a2350",
} as const;

export const DEFAULT_ACCENT = "linear-gradient(135deg,#ff2d95,#a855f7,#22d3ee)";
export const DEFAULT_ACCENT2 = "#22d3ee";

export interface Accent {
  colors: [string, string, ...string[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
  solid: string;
}

const COLOR_RE = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;

/**
 * Zamienia CSS `linear-gradient(135deg,#a,#b,#c)` (albo pojedynczy kolor) na props dla expo-linear-gradient.
 * Obsługuje kąt w stopniach i słowa kluczowe `to right/bottom/...`. Zawsze zwraca ≥ 2 kolory.
 */
export function parseAccent(accent?: string | null, accent2?: string | null): Accent {
  const src = accent && accent.trim() ? accent : DEFAULT_ACCENT;
  const colors = (src.match(COLOR_RE) ?? []).map((c) => c.trim());
  if (colors.length === 0) colors.push(C.pink, C.purple, C.cyan);
  if (colors.length === 1) colors.push(accent2 && accent2.trim() ? accent2 : colors[0]!);

  let angle = 135;
  const deg = /(-?\d+(?:\.\d+)?)deg/.exec(src);
  if (deg) angle = parseFloat(deg[1]!);
  else if (/to right/.test(src)) angle = 90;
  else if (/to left/.test(src)) angle = 270;
  else if (/to top/.test(src)) angle = 0;
  else if (/to bottom/.test(src)) angle = 180;
  const rad = ((angle - 90) * Math.PI) / 180;
  const dx = Math.cos(rad), dy = Math.sin(rad);
  const start = { x: 0.5 - dx / 2, y: 0.5 - dy / 2 };
  const end = { x: 0.5 + dx / 2, y: 0.5 + dy / 2 };
  return { colors: colors as Accent["colors"], start, end, solid: accent2 && accent2.trim() ? accent2 : colors[colors.length - 1]! };
}

/** Kolor z alfą (hex #rrggbb → rgba). */
export function alpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const R = { xl: 26, lg: 22, md: 16, sm: 12, pill: 999 } as const;
export const SP = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 } as const;
export const FONT = {
  black: "900" as const,
  bold: "800" as const,
  semi: "600" as const,
};
