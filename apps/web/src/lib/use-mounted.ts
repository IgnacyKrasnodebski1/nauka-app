"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** false during SSR + hydration, true after mount. Use to defer randomised UI (shuffles) so markup matches. */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
