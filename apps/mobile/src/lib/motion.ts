import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

let cached: boolean | null = null;

/** `AccessibilityInfo.isReduceMotionEnabled` — gdy true, animacje ozdobne są wyłączone. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState<boolean>(cached ?? false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        cached = v;
        if (alive) setReduce(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
      cached = v;
      setReduce(v);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
