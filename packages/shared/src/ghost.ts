/**
 * Ghost — race against your own best run of a level (design/DESIGN.md §3 "Ghost", legacy engine.js KROK 8).
 * A run = one `{t, correct}` per session item (`t` = ms since the first item). A passed level without a ghost saves
 * the run; a better run (more correct, tie → faster) replaces it and grants GHOST_WIN_XP. Pure helpers.
 */
import type { GhostRecord, GhostStep } from "./types.js";
import { dayDiff } from "./gamification.js";

export const GHOST_WIN_XP = 10;
/** UI polling interval for the ghost bar (ms) */
export const GHOST_TICK_MS = 400;

export type GhostRun = GhostStep[];

/** Append one answer to the run (call with the lesson start timestamp). */
export function recordStep(run: GhostRun, correct: boolean, t0: number, now = Date.now()): GhostRun {
  return [...run, { t: Math.max(0, now - t0), correct }];
}

export function runScore(run: readonly GhostStep[]): number {
  return run.filter((x) => x.correct).length;
}
export function runTime(run: readonly GhostStep[]): number {
  return run.length ? run[run.length - 1]!.t : 0;
}
/** More correct answers wins; on a tie the faster run. */
export function ghostBetter(run: readonly GhostStep[], old: readonly GhostStep[]): boolean {
  const a = runScore(run), b = runScore(old);
  return a > b || (a === b && runTime(run) < runTime(old));
}
/** How many items the ghost had answered after `elapsed` ms. */
export function ghostIndex(ghost: readonly GhostStep[], elapsed: number): number {
  let k = 0;
  while (k < ghost.length && ghost[k]!.t <= elapsed) k++;
  return k;
}

/** Accept both the 2.0 record and the legacy bare-array shape. */
export function ghostRun(rec: GhostRecord | GhostStep[] | null | undefined): GhostRun {
  if (!rec) return [];
  return Array.isArray(rec) ? rec : rec.run;
}

export type GhostResult =
  | { kind: "none" }
  | { kind: "saved"; record: GhostRecord; xp: 0; title: string; sub: string }
  | { kind: "win"; record: GhostRecord; xp: number; title: string; sub: string }
  | { kind: "lose"; record: GhostRecord; xp: 0; title: string; sub: string };

export function fmtSec(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * End of a lesson: save / compare the run. `record` in the result is what to store under progress.ghost[levelId]
 * (unchanged on "lose"). XP goes through the store's addXp.
 */
export function ghostFinish(old: GhostRecord | GhostStep[] | null | undefined, run: GhostRun, passed: boolean, total: number, today: string): GhostResult {
  if (!run.length || !total) return { kind: "none" };
  const score = runScore(run);
  const oldRun = ghostRun(old);
  if (!oldRun.length) {
    if (!passed) return { kind: "none" };
    return { kind: "saved", record: { run, at: today }, xp: 0, title: "Przebieg zapisany jako duch", sub: `Następnym razem ścigasz się z sobą — ${score} z ${total} w ${fmtSec(runTime(run))}.` };
  }
  const oldRec: GhostRecord = Array.isArray(old) ? { run: old, at: today } : (old as GhostRecord);
  if (ghostBetter(run, oldRun)) {
    return {
      kind: "win",
      record: { run, at: today },
      xp: GHOST_WIN_XP,
      title: `Pokonany duch: +${GHOST_WIN_XP} XP`,
      sub: `${score} z ${total} w ${fmtSec(runTime(run))} — poprzednio ${runScore(oldRun)} w ${fmtSec(runTime(oldRun))}. Ten przebieg jest nowym duchem.`,
    };
  }
  const dt = Math.round((runTime(run) - runTime(oldRun)) / 1000);
  return {
    kind: "lose",
    record: oldRec,
    xp: 0,
    title: "Duch był lepszy tym razem",
    sub: runScore(oldRun) > score ? `Duch miał ${runScore(oldRun)} z ${total}, ty ${score}.` : `Duch był szybszy o ${Math.max(1, dt)} s. Spróbuj jeszcze raz.`,
  };
}

export interface GhostStatus {
  /** items the ghost has answered so far */
  ghostIdx: number;
  /** "lead" | "behind" | "tie" */
  state: "lead" | "behind" | "tie";
  text: string;
}

/** Live comparison during a lesson: `youIdx` = items you answered, `elapsed` = ms since the start. */
export function ghostStatus(ghost: readonly GhostStep[], run: readonly GhostStep[], youIdx: number, elapsed: number, total: number): GhostStatus {
  const gi = Math.min(total, ghostIndex(ghost, elapsed));
  if (youIdx > gi) {
    const g = ghost[youIdx - 1], r = run[youIdx - 1];
    const dt = g && r ? Math.round((g.t - r.t) / 100) / 10 : 0;
    const slip = ghost[youIdx] && !ghost[youIdx]!.correct ? ` — duch pomylił się tu na pytaniu ${youIdx + 1}.` : ".";
    return { ghostIdx: gi, state: "lead", text: `Prowadzisz${dt > 0 ? ` o ${String(dt).replace(".", ",")} s` : ""}${slip}` };
  }
  if (youIdx < gi) {
    const gt = ghost[youIdx] ? ghost[youIdx]!.t : 0;
    return { ghostIdx: gi, state: "behind", text: `Duch prowadzi — odpowiedział na to pytanie w ${fmtSec(gt)}.` };
  }
  return { ghostIdx: gi, state: "tie", text: "Łeb w łeb. Odpowiedz, zanim duch ruszy dalej." };
}

/** "dzisiaj" / "wczoraj" / weekday / date label for "Ty z <kiedy>". */
export function ghostWhen(at: string | undefined, today: string): string {
  if (!at) return "ostatnio";
  const k = dayDiff(at, today);
  if (k === 0) return "dzisiaj";
  if (k === 1) return "wczoraj";
  if (k > 6) return at.split("-").reverse().join(".");
  const d = new Date(at + "T00:00:00");
  return ["niedzieli", "poniedziałku", "wtorku", "środy", "czwartku", "piątku", "soboty"][d.getDay()]!;
}
