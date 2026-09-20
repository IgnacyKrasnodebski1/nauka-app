import type { Achievement, Rank } from "@nauka/shared";

/** App-wide gamification events — consumed by the sfx layer, the mascot and the modal queue. */
export type AppEvent =
  | { type: "xp"; amount: number; topicId: string }
  | { type: "levelup"; rank: Rank }
  | { type: "achievement"; achievement: Achievement }
  | { type: "heart"; delta: number; hearts: number }
  | { type: "gem"; delta: number; gems: number }
  | { type: "combo"; streak: number; mult: number }
  | { type: "streak"; days: number; usedFreeze: boolean }
  | { type: "goal"; xp: number; goal: number };

export type AppEventType = AppEvent["type"];
type Handler<T extends AppEventType> = (e: Extract<AppEvent, { type: T }>) => void;

/** Tiny synchronous emitter (no deps). */
export class Emitter {
  private handlers = new Map<AppEventType, Set<(e: AppEvent) => void>>();

  on<T extends AppEventType>(type: T, fn: Handler<T>): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(fn as (e: AppEvent) => void);
    this.handlers.set(type, set);
    return () => set.delete(fn as (e: AppEvent) => void);
  }

  emit(e: AppEvent) {
    this.handlers.get(e.type)?.forEach((fn) => {
      try {
        fn(e);
      } catch (err) {
        console.warn("[events]", err);
      }
    });
  }
}
