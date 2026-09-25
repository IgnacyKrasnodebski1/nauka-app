import React, { useEffect, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type WithTimingConfig } from "react-native-reanimated";
import { useReduceMotion } from "@/lib/motion";

/**
 * Odpowiedniki klas `.a-*` z design/tokens.css w Reanimated (design/DESIGN.md §2). `<Motion kind="up" d={2}>` = `.a-up.d2`.
 * Reduce Motion (system albo przełącznik w Ustawieniach) = zero ruchu, stan końcowy od razu.
 */
export type MotionKind = "float" | "bob" | "pulse" | "beat" | "spin" | "rise" | "pop" | "blink" | "sway" | "glow" | "up" | "shake" | "none";

/** `.d1…d6` — opóźnienia kaskady (s → ms). */
export const DELAYS = [0, 120, 260, 400, 550, 720, 900] as const;
export const delayOf = (d?: number) => DELAYS[Math.max(0, Math.min(6, d ?? 0))]!;

const ease = Easing.bezier(0.2, 0.9, 0.3, 1);
const popEase = Easing.bezier(0.2, 1.5, 0.4, 1);
const inOut = Easing.inOut(Easing.ease);

export interface MotionProps {
  kind: MotionKind;
  /** indeks opóźnienia 0–6 (`.d1…d6`) */
  d?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** dla `rise`: wysokość elementu w px (bez pomiaru) */
  distance?: number;
  pointerEvents?: "auto" | "none" | "box-none" | "box-only";
  onLayout?: (e: LayoutChangeEvent) => void;
}

export function Motion({ kind, d, style, children, distance, pointerEvents, onLayout }: MotionProps) {
  const reduce = useReduceMotion();
  const v = useSharedValue(0); // postęp 0..1 (jednorazowe) albo faza (pętle)
  const [h, setH] = useState(distance ?? 400);
  const delay = delayOf(d);

  useEffect(() => {
    cancelAnimation(v);
    if (reduce || kind === "none") {
      v.set(1);
      return;
    }
    const loop = (ms: number, e = inOut) => withRepeat(withSequence(withTiming(1, { duration: ms / 2, easing: e }), withTiming(0, { duration: ms / 2, easing: e })), -1, false);
    const t = (to: number, cfg: WithTimingConfig) => withTiming(to, cfg);
    v.set(0);
    switch (kind) {
      case "float":
        v.set(withDelay(delay, loop(9000)));
        break;
      case "bob":
        v.set(withDelay(delay, loop(1600)));
        break;
      case "pulse":
        v.set(withDelay(delay, loop(1500)));
        break;
      case "sway":
        v.set(withDelay(delay, loop(4200)));
        break;
      case "blink":
        v.set(withDelay(delay, loop(1200)));
        break;
      case "glow":
        v.set(withDelay(delay, loop(2200)));
        break;
      case "beat":
        // 0%→1 w 18%, →0 w 36%, cisza do 100% (1.9 s)
        v.set(withDelay(delay, withRepeat(withSequence(t(1, { duration: 340, easing: inOut }), t(0, { duration: 340, easing: inOut }), t(0, { duration: 1220 })), -1, false)));
        break;
      case "spin":
        v.set(withDelay(delay, withRepeat(t(1, { duration: 2800, easing: Easing.linear }), -1, false)));
        break;
      case "up":
        v.set(withDelay(delay, t(1, { duration: 550, easing: Easing.out(Easing.ease) })));
        break;
      case "rise":
        v.set(withDelay(delay, t(1, { duration: 550, easing: ease })));
        break;
      case "pop":
        // .2→1.16 (70%)→1 (100%), .6 s
        v.set(withDelay(delay, withSequence(t(0.7, { duration: 420, easing: popEase }), t(1, { duration: 180, easing: Easing.out(Easing.ease) }))));
        break;
      case "shake":
        v.set(withDelay(delay + 300, t(1, { duration: 550, easing: Easing.linear })));
        break;
    }
  }, [kind, reduce, delay, v]);

  const st = useAnimatedStyle(() => {
    const p = v.value;
    switch (kind) {
      case "float":
        return { transform: [{ translateY: -16 * p }] };
      case "bob":
        return { transform: [{ translateY: -7 * p }] };
      case "pulse":
        return { transform: [{ scale: 1 + 0.06 * p }] };
      case "beat":
        return { transform: [{ scale: 1 + 0.28 * p }] };
      case "spin":
        return { transform: [{ rotate: `${360 * p}deg` }] };
      case "sway":
        return { transform: [{ rotate: `${-1.4 + 2.8 * p}deg` }] };
      case "blink":
        return { opacity: 1 - 0.78 * p };
      case "glow":
        return { opacity: 1 - 0.12 * p };
      case "up":
        return { opacity: p, transform: [{ translateY: 18 * (1 - p) }] };
      case "rise":
        return { transform: [{ translateY: h * 1.05 * (1 - p) }] };
      case "pop": {
        // 0..0.7 → skala .2→1.16, 0.7..1 → 1.16→1
        const s = p <= 0.7 ? 0.2 + (0.96 * p) / 0.7 : 1.16 - (0.16 * (p - 0.7)) / 0.3;
        return { opacity: Math.min(1, p / 0.5), transform: [{ scale: s }] };
      }
      case "shake": {
        // 0,18,36,54,72,100 % → 0,-9,8,-5,3,0
        const k = [0, -9, 8, -5, 3, 0];
        const stops = [0, 0.18, 0.36, 0.54, 0.72, 1];
        let x = 0;
        for (let i = 1; i < stops.length; i++) {
          if (p <= stops[i]!) {
            const f = (p - stops[i - 1]!) / (stops[i]! - stops[i - 1]!);
            x = k[i - 1]! + (k[i]! - k[i - 1]!) * f;
            break;
          }
        }
        return { transform: [{ translateX: x }] };
      }
      default:
        return {};
    }
  });

  const measure = (e: LayoutChangeEvent) => {
    if (kind === "rise" && distance == null) setH(e.nativeEvent.layout.height || 400);
    onLayout?.(e);
  };
  return (
    <Animated.View style={[style, st]} pointerEvents={pointerEvents} onLayout={measure}>
      {children}
    </Animated.View>
  );
}

/** Pasek postępu z `.a-grow`: wypełnienie rośnie od zera (1.2 s) po wejściu i przy zmianie `pct`. */
export function Bar({ pct, color, track, height = 10, radius = 999, d, style, animate = true }: { pct: number; color: string; track?: string; height?: number; radius?: number; d?: number; style?: StyleProp<ViewStyle>; animate?: boolean }) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const v = useSharedValue(0);
  const target = Math.max(0, Math.min(100, pct));
  useEffect(() => {
    if (reduce || !animate) {
      v.set(target);
      return;
    }
    v.set(withDelay(delayOf(d), withTiming(target, { duration: 1200, easing: ease })));
  }, [target, reduce, animate, d, v]);
  const st = useAnimatedStyle(() => ({ width: (w * v.value) / 100 }));
  return (
    <View style={[{ height, borderRadius: radius, backgroundColor: track ?? "#241F45", overflow: "hidden" }, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Animated.View style={[{ height: "100%", borderRadius: radius, backgroundColor: color }, st]} />
    </View>
  );
}

/** Konfetti (`.a-fall`): n kawałków z różnym opóźnieniem, kolory tylko z tokenów. Absolutne, `pointerEvents="none"`. */
export function Confetti({ n = 7, colors, top = 60 }: { n?: number; colors: string[]; top?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      {Array.from({ length: n }, (_, i) => (
        <Piece key={i} i={i} color={colors[i % colors.length]!} top={top} />
      ))}
    </View>
  );
}
function Piece({ i, color, top }: { i: number; color: string; top: number }) {
  const reduce = useReduceMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    v.set(withDelay(delayOf(i % 7), withRepeat(withTiming(1, { duration: 3400, easing: Easing.linear }), -1, false)));
  }, [reduce, i, v]);
  const st = useAnimatedStyle(() => ({ opacity: reduce ? 0 : v.value < 0.12 ? v.value / 0.12 : v.value > 0.88 ? (1 - v.value) / 0.12 : 1, transform: [{ translateY: -160 + 590 * v.value }, { rotate: `${460 * v.value}deg` }] }));
  const size = 7 + ((i * 5) % 7);
  return <Animated.View style={[{ position: "absolute", left: `${(i * 37 + 11) % 92}%`, top: top + ((i * 53 + 40) % 300), width: size, height: size, borderRadius: i % 3 === 1 ? size / 2 : 3, backgroundColor: color }, st]} />;
}
