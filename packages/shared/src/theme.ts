/**
 * Recall design tokens 2.0 — flat saturated colours on a deep violet-black ground, hard drop edges (no blur),
 * big radii. Source of truth: design/tokens.css (mirrored 1:1 in `TOKENS`, embedded verbatim in `TOKENS_CSS`).
 * Web injects `TOKENS_CSS` as-is; mobile reads `TOKENS` / `COLORS` / `PLAY`. See docs/DESIGN.md + design/DESIGN.md.
 *
 * Older export names (COLORS, PLAY, SUBJECT_HUES, HARD_EDGE, RADIUS, SHADOW, MOTION, TYPE, cssVars, hueFromColor…)
 * are kept and re-pointed to the 2.0 palette so existing screens re-skin without code changes.
 */

/** Every CSS custom property of design/tokens.css, keyed by its name without the leading `--`. */
export const TOKENS = {
  /* tła */
  bg: "#0E0C1C",
  surface: "#1B1836",
  "surface-2": "#15122B",
  line: "#2C2850",
  "line-2": "#241F45",
  shadow: "#14122A",
  /* tekst */
  txt: "#F4F2FF",
  "txt-2": "#D6D2F0",
  muted: "#9B95C9",
  "muted-2": "#6E67A8",
  "muted-3": "#4E4778",
  /* akcenty */
  acid: "#B4FF3A", "acid-dark": "#7FC400", "on-acid": "#14210A",
  pink: "#FF2E93", "pink-dark": "#B01460", "on-pink": "#200410",
  amber: "#FFA023", "amber-dark": "#B36A08", "on-amber": "#201202",
  cyan: "#22D3EE", "cyan-dark": "#108CA1", "on-cyan": "#04232B",
  gold: "#FFC043", "gold-dark": "#B3820E", "on-gold": "#241800",
  red: "#FF4767", "red-dark": "#A8203A", "on-red": "#2A0008",
  violet: "#A855F7", "violet-dark": "#6B2AA8", "on-violet": "#1A0A2A",
  flame: "#FF7A1A",
  /* tinty pod kafle i panele */
  "tint-acid": "#1F2A12", "tint-acid-line": "#4E6B24",
  "tint-pink": "#241536", "tint-pink-line": "#46216B",
  "tint-amber": "#2A1C10", "tint-amber-line": "#5C3812",
  "tint-cyan": "#0E2430", "tint-cyan-line": "#1A4C5E",
  "tint-gold": "#2A2110", "tint-gold-line": "#574319",
  "tint-red": "#2A1017", "tint-red-line": "#5C1F2E",
  /* motyw przedmiotu — nadpisywane per przedmiot */
  accent: "var(--acid)",
  "accent-dark": "var(--acid-dark)",
  "on-accent": "var(--on-acid)",
  /* kształt */
  "r-chip": "999px", "r-sm": "13px", "r-md": "18px", "r-lg": "22px", "r-xl": "28px",
  drop: "4px", "drop-btn": "5px", "drop-node": "6px",
  /* typografia */
  "font-display": "'Bricolage Grotesque', system-ui, sans-serif",
  "font-body": "'Plus Jakarta Sans', system-ui, sans-serif",
} as const;
export type TokenName = keyof typeof TOKENS;

/** Read a token value (for RN StyleSheet / inline styles). */
export function token(name: TokenName): string {
  return TOKENS[name];
}

/** Google Fonts stylesheet used by every 2.0 preview (Bricolage Grotesque 700/800 + Plus Jakarta Sans 500–800). */
export const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap";

/** Animation utility classes defined in tokens.css (`.a-*`) plus the cascade delays (`.d1…d6`). */
export const MOTION_CLASSES = [
  "a-float", "a-bob", "a-pulse", "a-beat", "a-spin", "a-grow", "a-rise", "a-pop", "a-fall", "a-blink", "a-sway", "a-glow", "a-up", "a-shake",
  "d1", "d2", "d3", "d4", "d5", "d6",
] as const;
export type MotionClass = (typeof MOTION_CLASSES)[number];

/** Where each motion class goes (design/DESIGN.md §2) — same table for web classes and mobile Reanimated presets. */
export const MOTION_USAGE: Record<string, MotionClass> = {
  progressBarEnter: "a-grow",
  activePathNode: "a-pulse",
  startBubble: "a-bob",
  hearts: "a-beat",
  bottomSheet: "a-rise",
  wrongAnswer: "a-shake",
  correctAnswer: "a-pop",
  confetti: "a-fall",
  listEnter: "a-up",
  backgroundBlob: "a-float",
  primaryButton: "a-glow",
  timer: "a-blink",
  spinner: "a-spin",
};

/** Layered grounds + text + semantic colours, re-pointed to tokens 2.0. */
export const COLORS = {
  /** grounds — bg0 = screen, bg1 = nav/section, bg2 = card, bg3 = raised/input, bg4 = hover/active */
  bg0: TOKENS.bg,
  bg1: TOKENS["surface-2"],
  bg2: TOKENS.surface,
  bg3: TOKENS["surface-2"],
  bg4: TOKENS["line-2"],

  /** borders — flat, opaque (no more hairlines) */
  line: TOKENS.line,
  lineStrong: TOKENS["muted-3"],
  glass: TOKENS.surface,
  glassHover: TOKENS["line-2"],
  highlight: "rgba(255,255,255,0.04)",

  /** text */
  text: TOKENS.txt,
  textSoft: TOKENS["txt-2"],
  muted: TOKENS.muted,
  faint: TOKENS["muted-2"],
  faint2: TOKENS["muted-3"],

  /** action accent = acid lime (primary CTA, active states). XP/rank use `xp` (gold). */
  accent: TOKENS.acid,
  accentStrong: "#C6FF66",
  accentDeep: TOKENS["acid-dark"],
  accentInk: TOKENS["on-acid"],
  accentGlow: "rgba(180,255,58,0.28)",

  /** semantic */
  success: TOKENS.acid,
  successSoft: TOKENS["tint-acid"],
  danger: TOKENS.red,
  dangerSoft: TOKENS["tint-red"],
  info: TOKENS.cyan,
  infoSoft: TOKENS["tint-cyan"],
  streak: TOKENS.flame,
  xp: TOKENS.gold,
  shadow: TOKENS.shadow,
} as const;

/** Saturated palette. `*Deep` = the hard bottom edge, `*Soft` = tint for chips/panels. */
export const PLAY = {
  green: TOKENS.acid, greenDeep: TOKENS["acid-dark"], greenSoft: TOKENS["tint-acid"],
  blue: TOKENS.cyan, blueDeep: TOKENS["cyan-dark"], blueSoft: TOKENS["tint-cyan"],
  purple: TOKENS.violet, purpleDeep: TOKENS["violet-dark"], purpleSoft: TOKENS["tint-pink"],
  orange: TOKENS.amber, orangeDeep: TOKENS["amber-dark"], orangeSoft: TOKENS["tint-amber"],
  red: TOKENS.red, redDeep: TOKENS["red-dark"], redSoft: TOKENS["tint-red"],
  yellow: TOKENS.gold, yellowDeep: TOKENS["gold-dark"], yellowSoft: TOKENS["tint-gold"],
  pink: TOKENS.pink, pinkDeep: TOKENS["pink-dark"], pinkSoft: TOKENS["tint-pink"],
  gem: TOKENS.cyan, gemDeep: TOKENS["cyan-dark"], heart: TOKENS.red, flame: TOKENS.flame,
  /** hard edge under cards / secondary surfaces */
  surfaceDeep: TOKENS.shadow,
  ink: TOKENS.bg,
} as const;

/** Height (px) of the hard bottom edge on cards (`--drop`). Buttons and path nodes use `DROP`. */
export const HARD_EDGE = 4;
/** Drop edge per element kind (tokens `--drop`, `--drop-btn`, `--drop-node`). */
export const DROP = { card: 4, btn: 5, node: 6, nodeCurrent: 7 } as const;

export interface Hue {
  name: string;
  /** the accent itself */
  color: string;
  /** dark variant = the 3D edge */
  deep: string;
  /** tint for tiles / panels */
  soft: string;
  /** ink on top of the accent */
  on: string;
  /** tint border */
  softLine?: string;
}

/** The 6 subject accents from tokens.css. Assigned by paletteFor(); stored in subjects.accent2. */
export const SUBJECT_HUES: Hue[] = [
  { name: "acid", color: TOKENS.acid, deep: TOKENS["acid-dark"], soft: TOKENS["tint-acid"], on: TOKENS["on-acid"], softLine: TOKENS["tint-acid-line"] },
  { name: "pink", color: TOKENS.pink, deep: TOKENS["pink-dark"], soft: TOKENS["tint-pink"], on: TOKENS["on-pink"], softLine: TOKENS["tint-pink-line"] },
  { name: "amber", color: TOKENS.amber, deep: TOKENS["amber-dark"], soft: TOKENS["tint-amber"], on: TOKENS["on-amber"], softLine: TOKENS["tint-amber-line"] },
  { name: "cyan", color: TOKENS.cyan, deep: TOKENS["cyan-dark"], soft: TOKENS["tint-cyan"], on: TOKENS["on-cyan"], softLine: TOKENS["tint-cyan-line"] },
  { name: "gold", color: TOKENS.gold, deep: TOKENS["gold-dark"], soft: TOKENS["tint-gold"], on: TOKENS["on-gold"], softLine: TOKENS["tint-gold-line"] },
  { name: "violet", color: TOKENS.violet, deep: TOKENS["violet-dark"], soft: TOKENS["tint-pink"], on: TOKENS["on-violet"], softLine: TOKENS["tint-pink-line"] },
];

/** Darken a hex colour by `amount` (0..1) — used for the 3D edge of non-curated accent2 values. */
export function hueDeep(hex: string, amount = 0.28): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const f = (c: number) => Math.max(0, Math.round(c * (1 - amount)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** Ink colour readable on top of `hex` (dark ink on bright accents, light on dark ones). */
export function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return TOKENS.txt;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 140 ? hueDeep(hex, 0.88) : TOKENS.txt;
}

/** Resolve a hue record from a stored accent2 (curated) or any hex. */
export function hueFromColor(color: string): Hue {
  const found = SUBJECT_HUES.find((h) => h.color.toLowerCase() === color.toLowerCase());
  if (found) return found;
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return SUBJECT_HUES[0]!;
  const n = parseInt(m[1]!, 16);
  return { name: "custom", color, deep: hueDeep(color), soft: `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.18)`, on: inkOn(color) };
}

/** CSS for the subject theme container: `--accent`, `--accent-dark`, `--on-accent` (design/DESIGN.md §1). */
export function accentVars(color: string): string {
  const h = hueFromColor(color);
  return `--accent:${h.color};--accent-dark:${h.deep};--on-accent:${h.on};--accent-soft:${h.soft}`;
}

export const RADIUS = { xs: 8, sm: 13, md: 18, lg: 22, xl: 28, pill: 999 } as const;

export const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

/** Type scale (px). Display = Bricolage Grotesque 800, body = Plus Jakarta Sans 500–800, numbers = tabular. */
export const TYPE = {
  display: "Bricolage Grotesque",
  body: "Plus Jakarta Sans",
  displayWeight: 800,
  bodyWeights: [500, 600, 700, 800],
  scale: { xs: 12, sm: 13.5, base: 15, md: 17, lg: 20, xl: 24, "2xl": 30, "3xl": 38, "4xl": 48 },
  lineHeight: { tight: 1.1, snug: 1.25, normal: 1.5, relaxed: 1.65 },
  tracking: { tight: -0.02, normal: 0, label: 0.12 },
} as const;

/** Hard drop shadows (no blur) — tokens.css component recipes. */
export const SHADOW = {
  /** card on the screen ground */
  card: `0 ${DROP.card}px 0 ${TOKENS.shadow}`,
  /** primary button (accent-dark edge) */
  glow: `0 ${DROP.btn}px 0 ${TOKENS["acid-dark"]}`,
  /** modal / drawer — the one soft shadow that stays */
  overlay: "0 30px 80px rgba(0,0,0,0.6)",
  /** path node */
  node: `0 ${DROP.node}px 0 ${TOKENS["acid-dark"]}`,
} as const;

export const MOTION = {
  fast: 140,
  base: 220,
  slow: 360,
  /** durations of the tokens.css keyframes (ms) */
  rise: 550,
  pop: 600,
  shake: 550,
  up: 550,
  grow: 1200,
  ease: "cubic-bezier(0.2, 0.9, 0.3, 1)",
  popEase: "cubic-bezier(0.2, 1.5, 0.4, 1)",
  spring: { damping: 18, stiffness: 220 },
} as const;

/**
 * CSS custom properties string for web (inject into :root). Legacy var names (`--bg0`, `--play-*`, `--hard-edge`…)
 * stay for existing screens; values now come from tokens 2.0 and agree with TOKENS_CSS where names overlap.
 */
export function cssVars(): string {
  const lines = [
    `--bg0:${COLORS.bg0}`, `--bg1:${COLORS.bg1}`, `--bg2:${COLORS.bg2}`, `--bg3:${COLORS.bg3}`, `--bg4:${COLORS.bg4}`,
    `--line:${COLORS.line}`, `--line-strong:${COLORS.lineStrong}`, `--glass:${COLORS.glass}`, `--glass-hover:${COLORS.glassHover}`, `--highlight:${COLORS.highlight}`,
    `--text:${COLORS.text}`, `--text-soft:${COLORS.textSoft}`, `--muted:${COLORS.muted}`, `--faint:${COLORS.faint}`,
    `--accent-strong:${COLORS.accentStrong}`, `--accent-deep:${COLORS.accentDeep}`, `--accent-ink:${COLORS.accentInk}`, `--accent-glow:${COLORS.accentGlow}`,
    `--success:${COLORS.success}`, `--success-soft:${COLORS.successSoft}`, `--danger:${COLORS.danger}`, `--danger-soft:${COLORS.dangerSoft}`, `--info:${COLORS.info}`, `--info-soft:${COLORS.infoSoft}`, `--streak:${COLORS.streak}`,
    `--r-xs:${RADIUS.xs}px`, `--r-sm:${RADIUS.sm}px`, `--r-md:${RADIUS.md}px`, `--r-lg:${RADIUS.lg}px`, `--r-xl:${RADIUS.xl}px`, `--r-pill:${RADIUS.pill}px`,
    `--hard-edge:${HARD_EDGE}px`,
    ...Object.entries(PLAY).map(([k, v]) => `--play-${k.replace(/([A-Z])/g, "-$1").toLowerCase()}:${v}`),
    `--shadow-card:${SHADOW.card}`, `--shadow-glow:${SHADOW.glow}`, `--shadow-overlay:${SHADOW.overlay}`,
    `--ease:${MOTION.ease}`, `--t-fast:${MOTION.fast}ms`, `--t-base:${MOTION.base}ms`, `--t-slow:${MOTION.slow}ms`,
    // tokens 2.0 (same names/values as TOKENS_CSS so injection order does not matter)
    ...Object.entries(TOKENS).map(([k, v]) => `--${k}:${v}`),
  ];
  return `:root{${lines.join(";")}}`;
}

/** Deterministic subject hue. */
export function subjectHue(seed: string): Hue {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return SUBJECT_HUES[Math.abs(h) % SUBJECT_HUES.length]!;
}

/** design/tokens.css, verbatim. Web injects it once (global stylesheet); keep in sync with the file. */
export const TOKENS_CSS: string = "/* ============================================================\n   NAUKA 2.0 — tokeny motywu i ruch\n   Wklej na początek styles.css (albo zaimportuj jako osobny plik).\n   Zasada: płaskie kolory, grube cienie pod spodem, duże promienie.\n   ============================================================ */\n:root{\n  /* tła */\n  --bg:#0E0C1C;          /* tło ekranu */\n  --surface:#1B1836;     /* karta */\n  --surface-2:#15122B;   /* pasek nawigacji, sekcja */\n  --line:#2C2850;        /* obramowanie karty */\n  --line-2:#241F45;      /* separator, tor paska postępu */\n  --shadow:#14122A;      /* cień pod kartą na tle bg */\n\n  /* tekst */\n  --txt:#F4F2FF;\n  --txt-2:#D6D2F0;\n  --muted:#9B95C9;\n  --muted-2:#6E67A8;\n  --muted-3:#4E4778;\n\n  /* akcenty */\n  --acid:#B4FF3A;   --acid-dark:#7FC400;   --on-acid:#14210A;\n  --pink:#FF2E93;   --pink-dark:#B01460;   --on-pink:#200410;\n  --amber:#FFA023;  --amber-dark:#B36A08;  --on-amber:#201202;\n  --cyan:#22D3EE;   --cyan-dark:#108CA1;   --on-cyan:#04232B;\n  --gold:#FFC043;   --gold-dark:#B3820E;   --on-gold:#241800;\n  --red:#FF4767;    --red-dark:#A8203A;    --on-red:#2A0008;\n  --violet:#A855F7; --violet-dark:#6B2AA8; --on-violet:#1A0A2A;\n  --flame:#FF7A1A;\n\n  /* tinty pod kafle i panele */\n  --tint-acid:#1F2A12;   --tint-acid-line:#4E6B24;\n  --tint-pink:#241536;   --tint-pink-line:#46216B;\n  --tint-amber:#2A1C10;  --tint-amber-line:#5C3812;\n  --tint-cyan:#0E2430;   --tint-cyan-line:#1A4C5E;\n  --tint-gold:#2A2110;   --tint-gold-line:#574319;\n  --tint-red:#2A1017;    --tint-red-line:#5C1F2E;\n\n  /* motyw przedmiotu — nadpisywane per przedmiot */\n  --accent:var(--acid);\n  --accent-dark:var(--acid-dark);\n  --on-accent:var(--on-acid);\n\n  /* kształt */\n  --r-chip:999px; --r-sm:13px; --r-md:18px; --r-lg:22px; --r-xl:28px;\n  --drop:4px;      /* cień kart */\n  --drop-btn:5px;  /* cień przycisków */\n  --drop-node:6px; /* cień węzłów ścieżki */\n\n  /* typografia */\n  --font-display:'Bricolage Grotesque', system-ui, sans-serif; /* 800 */\n  --font-body:'Plus Jakarta Sans', system-ui, sans-serif;      /* 500/600/700/800 */\n}\n\n/* ---------- RUCH ---------- */\n@keyframes dcFloat{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-16px,0)}}\n@keyframes dcBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}\n@keyframes dcPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}\n@keyframes dcBeat{0%,100%{transform:scale(1)}18%{transform:scale(1.28)}36%{transform:scale(1)}}\n@keyframes dcSpin{to{transform:rotate(360deg)}}\n@keyframes dcGrow{from{width:0}}\n@keyframes dcRise{from{transform:translateY(105%)}to{transform:translateY(0)}}\n@keyframes dcPop{0%{transform:scale(.2);opacity:0}70%{transform:scale(1.16);opacity:1}100%{transform:scale(1);opacity:1}}\n@keyframes dcFall{0%{transform:translateY(-160px) rotate(0);opacity:0}12%{opacity:1}88%{opacity:1}100%{transform:translateY(430px) rotate(460deg);opacity:0}}\n@keyframes dcBlink{0%,100%{opacity:1}50%{opacity:.22}}\n@keyframes dcSway{0%,100%{transform:rotate(-1.4deg)}50%{transform:rotate(1.4deg)}}\n@keyframes dcGlow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.14)}}\n@keyframes dcFadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}\n@keyframes dcShake{0%,100%{transform:translateX(0)}18%{transform:translateX(-9px)}36%{transform:translateX(8px)}54%{transform:translateX(-5px)}72%{transform:translateX(3px)}}\n\n.a-float{animation:dcFloat 9s ease-in-out infinite}\n.a-bob{animation:dcBob 1.6s ease-in-out infinite}\n.a-pulse{animation:dcPulse 1.5s ease-in-out infinite}\n.a-beat{animation:dcBeat 1.9s ease-in-out infinite}\n.a-spin{animation:dcSpin 2.8s linear infinite}\n.a-grow{animation:dcGrow 1.2s cubic-bezier(.2,.9,.3,1) both}\n.a-rise{animation:dcRise .55s cubic-bezier(.2,.9,.3,1) both}\n.a-pop{animation:dcPop .6s cubic-bezier(.2,1.5,.4,1) both}\n.a-fall{animation:dcFall 3.4s linear infinite}\n.a-blink{animation:dcBlink 1.2s ease-in-out infinite}\n.a-sway{animation:dcSway 4.2s ease-in-out infinite}\n.a-glow{animation:dcGlow 2.2s ease-in-out infinite}\n.a-up{animation:dcFadeUp .55s ease-out both}\n.a-shake{animation:dcShake .55s ease-in-out .3s both}\n.d1{animation-delay:.12s}.d2{animation-delay:.26s}.d3{animation-delay:.4s}\n.d4{animation-delay:.55s}.d5{animation-delay:.72s}.d6{animation-delay:.9s}\n\n@media (prefers-reduced-motion: reduce){*{animation:none !important}}\n\n/* ---------- PRZEPISY NA KOMPONENTY ---------- */\n/* Przycisk główny: płaski kolor + cień pod spodem, wciśnięcie zjeżdża w dół. */\n.btn{\n  display:flex;align-items:center;justify-content:center;gap:8px;\n  height:58px;border:none;border-radius:var(--r-md);cursor:pointer;\n  font-family:var(--font-body);font-size:15px;font-weight:800;letter-spacing:1.2px;\n  background:var(--accent);color:var(--on-accent);\n  box-shadow:0 var(--drop-btn) 0 var(--accent-dark);\n  transition:transform .08s, box-shadow .08s;\n}\n.btn:active{transform:translateY(var(--drop-btn));box-shadow:0 0 0 var(--accent-dark)}\n.btn--ghost{background:var(--surface);border:2px solid var(--line);color:var(--txt-2);box-shadow:0 var(--drop-btn) 0 var(--shadow)}\n.btn--danger{background:var(--red);color:var(--on-red);box-shadow:0 var(--drop-btn) 0 var(--red-dark)}\n.btn[disabled]{background:#201C3E;color:#5C568F;box-shadow:none;cursor:default}\n\n/* Karta */\n.card{background:var(--surface);border:2px solid var(--line);border-radius:var(--r-lg);\n      box-shadow:0 var(--drop) 0 var(--shadow);padding:16px}\n\n/* Pasek postępu — .bar i{width:X%} animuje się od zera klasą .a-grow */\n.bar{height:10px;border-radius:999px;background:var(--line-2);overflow:hidden}\n.bar i{display:block;height:100%;border-radius:999px;background:var(--accent)}\n\n/* Plakietka */\n.chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:var(--r-chip);\n      font-size:10.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase}\n\n/* Węzeł ścieżki */\n.node{width:74px;height:74px;border-radius:50%;border:none;cursor:pointer;\n      display:flex;align-items:center;justify-content:center;\n      box-shadow:0 var(--drop-node) 0 var(--accent-dark);background:var(--accent)}\n.node--current{width:88px;height:88px;box-shadow:0 7px 0 var(--accent-dark)}\n.node--locked{background:var(--surface);border:2px solid var(--line);box-shadow:0 var(--drop-node) 0 var(--shadow);cursor:not-allowed}\n.node:active{transform:translateY(3px);box-shadow:0 3px 0 var(--accent-dark)}\n\n/* Minimalny cel dotyku: 44px. Tekst 4.5:1, duży 3:1. */\n";
