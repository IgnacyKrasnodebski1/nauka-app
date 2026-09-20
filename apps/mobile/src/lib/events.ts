import type { Achievement, Rank } from "@nauka/shared";

/** Zdarzenia gamifikacji — dla dźwięków, maskotki i overlayu (level-up / odznaka). */
export type AppEvent =
  | { type: "xp"; amount: number; topicId: string }
  | { type: "levelup"; rank: Rank }
  | { type: "achievement"; achievement: Achievement }
  | { type: "heart"; delta: number; hearts: number }
  | { type: "gem"; delta: number; gems: number }
  | { type: "combo"; streak: number; mult: number }
  | { type: "streak"; days: number; usedFreeze: boolean }
  | { type: "goal"; xp: number };

type Listener = (e: AppEvent) => void;

export class Emitter {
  private ls = new Set<Listener>();
  on(fn: Listener): () => void {
    this.ls.add(fn);
    return () => this.ls.delete(fn);
  }
  emit(e: AppEvent) {
    for (const fn of this.ls) {
      try {
        fn(e);
      } catch (err) {
        console.warn("[events]", err);
      }
    }
  }
}
