/**
 * "Rec" — the Recall mascot: a luminous memory orb with big eyes, cheeks and a small flame plume
 * that grows with the streak. Pure data; rendered by web (inline SVG) and mobile (react-native-svg).
 */
export type MascotState = "idle" | "happy" | "cheer" | "sad" | "think" | "sleep";

export const MASCOT = {
  viewBox: "0 0 120 120",
  body: { cx: 60, cy: 66, r: 40 },
  colors: { core: "#E9E1FF", mid: "#A78BFF", edge: "#6C4DE6", glow: "#B79CFF", eye: "#FFFFFF", pupil: "#141A33", cheek: "#FF86D0", plume: ["#FFC800", "#FF9600"] as [string, string], mouth: "#2A1B5C" },
  /** flame plume above the head; scale from plumeForStreak() */
  plume: { d: "M60 30 C50 20 52 8 60 2 C68 8 70 20 60 30 Z", inner: "M60 26 C56 20 57 13 60 9 C63 13 64 20 60 26 Z", base: [60, 30] as [number, number] },
  eyes: [
    { cx: 47, cy: 62 },
    { cx: 73, cy: 62 },
  ],
  eyeR: { rx: 7.5, ry: 9.5 },
  pupilR: 3.6,
  shine: { dx: -2.2, dy: -3, r: 1.6 },
  cheeks: [
    { cx: 38, cy: 74, r: 4.5 },
    { cx: 82, cy: 74, r: 4.5 },
  ],
  mouths: {
    smile: "M50 80 Q60 88 70 80",
    grin: "M46 78 Q60 98 74 78 Z",
    open: "M51 80 Q60 100 69 80 Z",
    flat: "M52 82 H68",
    frown: "M50 86 Q60 78 70 86",
    sleep: "M55 82 Q60 85 65 82",
  },
  brows: {
    none: null,
    sad: ["M39 50 L53 55", "M81 50 L67 55"],
    think: ["M39 52 L53 49", "M67 47 L81 44"],
    happy: ["M40 50 Q47 45 54 50", "M66 50 Q73 45 80 50"],
  },
} as const;

export interface MascotPose {
  mouth: keyof typeof MASCOT.mouths;
  /** eye open amount 0..1 (0 = closed arc) */
  eyeOpen: number;
  /** pupil offset */
  pupil: [number, number];
  brow: keyof typeof MASCOT.brows;
  /** plume scale multiplier on top of streak scale */
  plume: number;
  motion: "bob" | "bounce" | "jump" | "droop" | "none";
  extras?: "confetti" | "zzz" | "sweat";
}

export const MASCOT_STATES: Record<MascotState, MascotPose> = {
  idle: { mouth: "smile", eyeOpen: 1, pupil: [0, 0], brow: "none", plume: 1, motion: "bob" },
  happy: { mouth: "grin", eyeOpen: 0.85, pupil: [0, 0.5], brow: "happy", plume: 1.15, motion: "bounce" },
  cheer: { mouth: "open", eyeOpen: 0.6, pupil: [0, 0], brow: "happy", plume: 1.3, motion: "jump", extras: "confetti" },
  sad: { mouth: "frown", eyeOpen: 0.8, pupil: [0, 1.5], brow: "sad", plume: 0.6, motion: "droop", extras: "sweat" },
  think: { mouth: "flat", eyeOpen: 0.9, pupil: [2.5, -2], brow: "think", plume: 0.9, motion: "bob" },
  sleep: { mouth: "sleep", eyeOpen: 0, pupil: [0, 0], brow: "none", plume: 0.4, motion: "none", extras: "zzz" },
};

/** Plume size from streak: no streak = ember, week = flame, month = torch. */
export function plumeForStreak(streak: number): number {
  if (streak <= 0) return 0.5;
  if (streak < 7) return 0.8;
  if (streak < 30) return 1;
  return 1.3;
}

/** One-liners the mascot says, per state and context. */
export const MASCOT_LINES: Record<MascotState, string[]> = {
  idle: ["Gotowy na 10 minut?", "Co dziś ogarniamy?", "Twoje notatki czekają."],
  happy: ["Dobrze!", "O to chodzi!", "Siedzi!"],
  cheer: ["Poziom zaliczony!", "Świetna robota!", "Jesteś w formie!"],
  sad: ["Prawie. Zerknij na wyjaśnienie.", "Spokojnie, następne będzie Twoje.", "To wchodzi za drugim razem."],
  think: ["Hmm, zastanówmy się…", "Zobaczmy, co tu mamy.", "Wybierz temat, a ja robię resztę."],
  sleep: ["Seria zagrożona… obudź mnie 10 minutami.", "Zzz… jeszcze dziś się uczymy?"],
};
