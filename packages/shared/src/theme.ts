/**
 * Recall design tokens — "Duolingo in dark": dark layered grounds + saturated PLAY colours + 3D hard edges.
 * Single source of truth for web (Tailwind @theme / CSS vars) and mobile (RN StyleSheet).
 * See docs/DESIGN.md for the rationale and component rules.
 */

export const COLORS = {
  /** grounds — layered, cool-tinted near-black (never pure #000) */
  bg0: "#07080C", // page ground
  bg1: "#0C0D14", // app shell / sections
  bg2: "#12141C", // cards
  bg3: "#181B25", // raised cards / inputs
  bg4: "#1F2330", // hover / active surfaces

  /** hairlines and glass */
  line: "rgba(255,255,255,0.08)",
  lineStrong: "rgba(255,255,255,0.14)",
  glass: "rgba(255,255,255,0.035)",
  glassHover: "rgba(255,255,255,0.06)",
  highlight: "rgba(255,255,255,0.10)", // 1px top inner highlight on raised cards

  /** text */
  text: "#F3F4F8",
  textSoft: "#C9CCDA",
  muted: "#8D92A6",
  faint: "#5C6176",

  /** brand accent — warm gold on cool dark = premium; used sparingly (primary CTA, XP, active states) */
  accent: "#F2C14E",
  accentStrong: "#FFD36A",
  accentDeep: "#B98A1C",
  accentInk: "#1A1300", // text on accent surfaces
  accentGlow: "rgba(242,193,78,0.28)",

  /** semantic */
  success: "#58CC02",
  successSoft: "rgba(88,204,2,0.16)",
  danger: "#FF4B4B",
  dangerSoft: "rgba(255,75,75,0.16)",
  info: "#1CB0F6",
  infoSoft: "rgba(28,176,246,0.16)",
  streak: "#FF9600", // flame
  xp: "#F2C14E", // = accent
} as const;

/** Playful saturated palette (Duolingo-like). `*Deep` = the 3D bottom edge colour. */
export const PLAY = {
  green: "#58CC02", greenDeep: "#3E9A00", greenSoft: "rgba(88,204,2,0.16)",
  blue: "#1CB0F6", blueDeep: "#1487C0", blueSoft: "rgba(28,176,246,0.16)",
  purple: "#CE82FF", purpleDeep: "#9E56D6", purpleSoft: "rgba(206,130,255,0.16)",
  orange: "#FF9600", orangeDeep: "#CC7200", orangeSoft: "rgba(255,150,0,0.16)",
  red: "#FF4B4B", redDeep: "#C93A3A", redSoft: "rgba(255,75,75,0.16)",
  yellow: "#FFC800", yellowDeep: "#CC9F00", yellowSoft: "rgba(255,200,0,0.16)",
  pink: "#FF86D0", pinkDeep: "#D25FA6", pinkSoft: "rgba(255,134,208,0.16)",
  gem: "#5EC8FF", gemDeep: "#2E9BD6", heart: "#FF4B4B", flame: "#FF9600",
  /** 3D edge for glass/secondary surfaces */
  surfaceDeep: "#05060A",
  ink: "#0B0C12",
} as const;

/** Height (px) of the 3D bottom edge on buttons, tiles and path nodes. */
export const HARD_EDGE = 4;

/** Curated per-subject hues (saturated). Assigned by paletteFor(); stored in subjects.accent2. */
export const SUBJECT_HUES: { name: string; color: string; deep: string; soft: string }[] = [
  { name: "lilac", color: "#A66BFF", deep: "#7A44D6", soft: "rgba(166,107,255,0.18)" },
  { name: "sky", color: "#2EB8FF", deep: "#1B8AC4", soft: "rgba(46,184,255,0.18)" },
  { name: "mint", color: "#2EE6A6", deep: "#1FAE7C", soft: "rgba(46,230,166,0.18)" },
  { name: "coral", color: "#FF7A5C", deep: "#CC5540", soft: "rgba(255,122,92,0.18)" },
  { name: "amber", color: "#FFC53D", deep: "#CC9A24", soft: "rgba(255,197,61,0.18)" },
  { name: "rose", color: "#FF6FB5", deep: "#C94F8A", soft: "rgba(255,111,181,0.18)" },
  { name: "sage", color: "#9BE04A", deep: "#6FAA2E", soft: "rgba(155,224,74,0.18)" },
  { name: "ice", color: "#7DE3F5", deep: "#4FB4C7", soft: "rgba(125,227,245,0.18)" },
];

/** Darken a hex colour by `amount` (0..1) — used for the 3D edge of legacy accent2 values. */
export function hueDeep(hex: string, amount = 0.28): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const f = (c: number) => Math.max(0, Math.round(c * (1 - amount)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** Resolve a hue record from a stored accent2 (curated) or any hex. */
export function hueFromColor(color: string): { color: string; deep: string; soft: string } {
  const found = SUBJECT_HUES.find((h) => h.color.toLowerCase() === color.toLowerCase());
  if (found) return found;
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return SUBJECT_HUES[0]!;
  const n = parseInt(m[1]!, 16);
  return { color, deep: hueDeep(color), soft: `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.18)` };
}

export const RADIUS = { xs: 8, sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

/** Type scale (px). Display = Bricolage Grotesque, body = Manrope, numbers = tabular. */
export const TYPE = {
  display: "Bricolage Grotesque",
  body: "Manrope",
  scale: { xs: 12, sm: 13.5, base: 15, md: 17, lg: 20, xl: 24, "2xl": 30, "3xl": 38, "4xl": 48 },
  lineHeight: { tight: 1.1, snug: 1.25, normal: 1.5, relaxed: 1.65 },
  tracking: { tight: -0.02, normal: 0, label: 0.12 },
} as const;

export const SHADOW = {
  /** raised glass card */
  card: "0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 32px rgba(0,0,0,0.45)",
  /** primary CTA glow */
  glow: "0 8px 30px rgba(242,193,78,0.25), 0 1px 0 rgba(255,255,255,0.25) inset",
  /** modal / drawer */
  overlay: "0 30px 80px rgba(0,0,0,0.6)",
} as const;

export const MOTION = {
  fast: 140,
  base: 220,
  slow: 360,
  ease: "cubic-bezier(0.2, 0.8, 0.2, 1)", // ease-out-quint-ish
  spring: { damping: 18, stiffness: 220 },
} as const;

/** CSS custom properties string for web (inject into :root). */
export function cssVars(): string {
  const lines = [
    `--bg0:${COLORS.bg0}`, `--bg1:${COLORS.bg1}`, `--bg2:${COLORS.bg2}`, `--bg3:${COLORS.bg3}`, `--bg4:${COLORS.bg4}`,
    `--line:${COLORS.line}`, `--line-strong:${COLORS.lineStrong}`, `--glass:${COLORS.glass}`, `--glass-hover:${COLORS.glassHover}`, `--highlight:${COLORS.highlight}`,
    `--text:${COLORS.text}`, `--text-soft:${COLORS.textSoft}`, `--muted:${COLORS.muted}`, `--faint:${COLORS.faint}`,
    `--accent:${COLORS.accent}`, `--accent-strong:${COLORS.accentStrong}`, `--accent-deep:${COLORS.accentDeep}`, `--accent-ink:${COLORS.accentInk}`, `--accent-glow:${COLORS.accentGlow}`,
    `--success:${COLORS.success}`, `--success-soft:${COLORS.successSoft}`, `--danger:${COLORS.danger}`, `--danger-soft:${COLORS.dangerSoft}`, `--info:${COLORS.info}`, `--info-soft:${COLORS.infoSoft}`, `--streak:${COLORS.streak}`,
    `--r-xs:${RADIUS.xs}px`, `--r-sm:${RADIUS.sm}px`, `--r-md:${RADIUS.md}px`, `--r-lg:${RADIUS.lg}px`, `--r-xl:${RADIUS.xl}px`, `--r-pill:${RADIUS.pill}px`,
    `--hard-edge:${HARD_EDGE}px`,
    ...Object.entries(PLAY).map(([k, v]) => `--play-${k.replace(/([A-Z])/g, "-$1").toLowerCase()}:${v}`),
    `--shadow-card:${SHADOW.card}`, `--shadow-glow:${SHADOW.glow}`, `--shadow-overlay:${SHADOW.overlay}`,
    `--ease:${MOTION.ease}`, `--t-fast:${MOTION.fast}ms`, `--t-base:${MOTION.base}ms`, `--t-slow:${MOTION.slow}ms`,
    `--font-display:"${TYPE.display}", "Manrope", system-ui, sans-serif`, `--font-body:"${TYPE.body}", system-ui, sans-serif`,
  ];
  return `:root{${lines.join(";")}}`;
}

/** Deterministic subject hue. */
export function subjectHue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return SUBJECT_HUES[Math.abs(h) % SUBJECT_HUES.length]!;
}
