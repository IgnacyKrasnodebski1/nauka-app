import React, { useEffect, useMemo, useState } from "react";
import { Animated as RNAnimated, Easing as RNEasing, StyleSheet, View, useWindowDimensions } from "react-native";
import { useReduceMotion } from "@/lib/motion";
import { PLAY } from "@/lib/theme";
import { useHue } from "./Accent";

/** Jedna cząstka confetti (plain RN Animated, native driver). */
function Particle({ color, delay, dx, dy, size, rot, round }: { color: string; delay: number; dx: number; dy: number; size: number; rot: number; round: boolean }) {
  const [t] = useState(() => new RNAnimated.Value(0));
  useEffect(() => {
    RNAnimated.timing(t, { toValue: 1, duration: 1500, delay, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: true }).start();
  }, [t, delay]);
  const translateY = t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, -dy, 320] });
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const opacity = t.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${rot}deg`] });
  return <RNAnimated.View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, width: size, height: round ? size : size * 0.45, borderRadius: round ? size / 2 : 2, backgroundColor: color, opacity, transform: [{ translateX }, { translateY }, { rotate }] }} />;
}

/** Deterministyczny pseudo-los (czysta funkcja — bez Math.random w renderze). */
const pr = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Confetti: ≤ 80 cząstek, kolor przedmiotu + złoto + zielony, wystrzał z punktu `origin` (0..1 szerokości). */
export function Confetti({ run, count = 80, origin = 0.5, color, top = 0 }: { run: boolean; count?: number; origin?: number; color?: string; top?: number }) {
  const hue = useHue();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const base = color ?? hue.color;
  const parts = useMemo(
    () =>
      Array.from({ length: Math.min(80, count) }, (_, i) => ({
        id: i,
        color: i % 3 === 0 ? PLAY.yellow : i % 3 === 1 ? PLAY.green : base,
        delay: Math.round(pr(i, 1) * 320),
        dx: Math.round((pr(i, 2) - 0.5) * width * 1.4),
        dy: 60 + Math.round(pr(i, 4) * 160),
        size: 6 + Math.round(pr(i, 3) * 7),
        rot: Math.round((pr(i, 5) - 0.5) * 900),
        round: pr(i, 6) > 0.7,
      })),
    [base, count, width],
  );
  if (!run || reduce) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      <View style={{ position: "absolute", left: width * origin, top }}>
        {parts.map((p) => (
          <Particle key={p.id} {...p} />
        ))}
      </View>
    </View>
  );
}
