/**
 * Recall design tokens — "Premium dark".
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
  success: "#4ADE9B",
  successSoft: "rgba(74,222,155,0.14)",
  danger: "#FF6B7A",
  dangerSoft: "rgba(255,107,122,0.14)",
  info: "#7DB4FF",
  infoSoft: "rgba(125,180,255,0.14)",
  streak: "#FF8A3D", // flame
  xp: "#F2C14E", // = accent
} as const;

/** Curated per-subject hues (muted, premium). Assigned by paletteFor(); stored in subjects.accent2. */
export const SUBJECT_HUES: { name: string; color: string; soft: string }[] = [
  { name: "lilac", color: "#A78BFA", soft: "rgba(167,139,250,0.16)" },
  { name: "sky", color: "#67B7FF", soft: "rgba(103,183,255,0.16)" },
  { name: "mint", color: "#5EE0B5", soft: "rgba(94,224,181,0.16)" },
  { name: "coral", color: "#FF8C7A", soft: "rgba(255,140,122,0.16)" },
  { name: "amber", color: "#F2C14E", soft: "rgba(242,193,78,0.16)" },
  { name: "rose", color: "#F48FB1", soft: "rgba(244,143,177,0.16)" },
  { name: "sage", color: "#9CCC65", soft: "rgba(156,204,101,0.16)" },
  { name: "ice", color: "#8FD3E8", soft: "rgba(143,211,232,0.16)" },
];

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
    `--r-xs:${RADIUS.xs}px`, `--r-sm:${RADIUS.sm}px`, `--r-md:${RADIUS.md}px`, `--r-lg:${RADIUS.lg}px`, `--r-xl:${RADIUS.xl}px`,
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
