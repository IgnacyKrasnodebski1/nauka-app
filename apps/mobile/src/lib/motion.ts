import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Reduce Motion = systemowe `isReduceMotionEnabled` LUB własny przełącznik z Ustawień („Ogranicz animacje”,
 * design/DESIGN.md §2). Gdy true — wszystkie presety z components/Motion.tsx są statyczne.
 */
let systemReduce: boolean | null = null;
let userReduce = false;
const listeners = new Set<() => void>();

export function setUserReduceMotion(v: boolean) {
  if (userReduce === v) return;
  userReduce = v;
  for (const l of listeners) l();
}
export function getUserReduceMotion() {
  return userReduce;
}

export function useReduceMotion(): boolean {
  const [, force] = useState(0);
  useEffect(() => {
    let alive = true;
    const bump = () => alive && force((n) => n + 1);
    listeners.add(bump);
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        systemReduce = v;
        bump();
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
      systemReduce = v;
      bump();
    });
    return () => {
      alive = false;
      listeners.delete(bump);
      sub.remove();
    };
  }, []);
  return !!systemReduce || userReduce;
}
