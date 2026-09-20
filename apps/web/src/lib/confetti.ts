/**
 * canvas-confetti wrapper. Colours = subject hue + gold + green (DESIGN.md), ≤ 80 particles, no-op under reduced motion.
 */
import { PLAY } from "@nauka/shared";
import type confettiType from "canvas-confetti";

export type BurstKind = "level" | "perfect" | "chest" | "trophy" | "levelup" | "small";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type ConfettiFn = typeof confettiType;
let mod: ConfettiFn | null = null;
async function lib(): Promise<ConfettiFn> {
  if (!mod) {
    const m = (await import("canvas-confetti")) as unknown as { default?: ConfettiFn } & ConfettiFn;
    mod = typeof m.default === "function" ? m.default : m;
  }
  return mod;
}

export async function burst(kind: BurstKind = "level", hue?: string) {
  if (reduced() || typeof window === "undefined") return;
  const confetti = await lib();
  const colors = [hue ?? PLAY.blue, PLAY.yellow, PLAY.green, "#FFFFFF"];
  const base = { colors, disableForReducedMotion: true, zIndex: 120, ticks: 180 };
  switch (kind) {
    case "small":
      confetti({ ...base, particleCount: 30, spread: 55, startVelocity: 28, origin: { x: 0.5, y: 0.6 }, scalar: 0.9 });
      break;
    case "chest":
      confetti({ ...base, particleCount: 60, spread: 80, startVelocity: 38, origin: { x: 0.5, y: 0.55 }, colors: [PLAY.yellow, PLAY.gem, PLAY.orange, "#fff"], shapes: ["circle", "square"] });
      break;
    case "trophy":
    case "levelup":
      confetti({ ...base, particleCount: 80, spread: 100, startVelocity: 42, origin: { x: 0.5, y: 0.5 }, colors: [PLAY.yellow, PLAY.purple, hue ?? PLAY.blue, "#fff"] });
      break;
    case "perfect":
      confetti({ ...base, particleCount: 45, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } });
      confetti({ ...base, particleCount: 45, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } });
      break;
    default:
      confetti({ ...base, particleCount: 70, spread: 75, startVelocity: 36, origin: { x: 0.5, y: 0.55 } });
  }
}
