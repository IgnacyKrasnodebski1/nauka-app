import React, { useEffect, useMemo, useState } from "react";
import { Animated as RNAnimated, Easing as RNEasing, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from "react-native-reanimated";
import { useReduceMotion } from "@/lib/motion";
import { COLORS, MOTION, SPACE, display, tabular } from "@/lib/theme";
import { useHue } from "./Accent";
import { Body, Display, Muted } from "./Text";

/** Jedna cząstka confetti (plain RN Animated). */
function Particle({ color, delay, dx, size, run }: { color: string; delay: number; dx: number; size: number; run: boolean }) {
  const [t] = useState(() => new RNAnimated.Value(0));
  useEffect(() => {
    if (!run) return;
    RNAnimated.timing(t, { toValue: 1, duration: 1200, delay, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: true }).start();
  }, [t, delay, run]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, 260] });
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const opacity = t.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${dx > 0 ? 360 : -360}deg`] });
  return <RNAnimated.View pointerEvents="none" style={{ position: "absolute", top: 0, left: "50%", width: size, height: size * 0.5, borderRadius: 2, backgroundColor: color, opacity, transform: [{ translateX }, { translateY }, { rotate }] }} />;
}

/** Deterministyczny pseudo-los (czysta funkcja — bez Math.random w renderze). */
const pr = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Powściągliwe confetti: max 40 cząstek, hue przedmiotu + złoto, 1.2 s, tylko gdy `celebrate`. */
export function Confetti({ celebrate }: { celebrate: boolean }) {
  const hue = useHue();
  const reduce = useReduceMotion();
  const parts = useMemo(
    () => Array.from({ length: 40 }, (_, i) => ({ id: i, color: i % 3 === 0 ? COLORS.accent : hue.color, delay: Math.round(pr(i, 1) * 250), dx: Math.round((pr(i, 2) - 0.5) * 320), size: 6 + Math.round(pr(i, 3) * 6) })),
    [hue.color],
  );
  if (!celebrate || reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {parts.map((p) => (
        <Particle key={p.id} color={p.color} delay={p.delay} dx={p.dx} size={p.size} run />
      ))}
    </View>
  );
}

/** Animowany licznik XP (display 48, złoto, tabular). */
export function XpCounter({ value, size = 48 }: { value: number; size?: number }) {
  const reduce = useReduceMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const start = Date.now();
    const dur = 900;
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setN(Math.round(value * e));
      if (k >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [value, reduce]);
  return (
    <Text style={[{ fontFamily: display(800), fontSize: size, lineHeight: Math.round(size * 1.1), color: COLORS.accent, letterSpacing: -size * 0.02 }, tabular]}>
      +{reduce ? value : n} <Text style={{ fontSize: Math.round(size * 0.4), color: COLORS.accentDeep }}>XP</Text>
    </Text>
  );
}

function Star({ on, i }: { on: boolean; i: number }) {
  const reduce = useReduceMotion();
  const sc = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) sc.set(withDelay(200 + i * 140, withSpring(1, MOTION.spring)));
  }, [sc, i, reduce]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Animated.Text style={[{ fontSize: 30, color: on ? COLORS.accent : COLORS.faint, fontFamily: display(700) }, st]}>★</Animated.Text>
  );
}

/** Gwiazdki wpadające springiem. */
export function Stars({ count }: { count: 0 | 1 | 2 | 3 }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[0, 1, 2].map((i) => (
        <Star key={i} on={i < count} i={i} />
      ))}
    </View>
  );
}

/** Ekran wyniku (lekcja/quiz/egzamin): eyebrow, tytuł display, opcjonalny licznik XP/gwiazdki, werdykt, akcje. */
export function ResultView({ eyebrow, title, xp, stars, score, verdict, celebrate = false, children }: { eyebrow?: string; title: string; xp?: number; stars?: 0 | 1 | 2 | 3; score?: React.ReactNode; verdict?: string; celebrate?: boolean; children?: React.ReactNode }) {
  return (
    <View style={s.wrap}>
      <Confetti celebrate={celebrate} />
      {eyebrow ? (
        <Muted size="xs" weight={600} center style={{ letterSpacing: 1.4, textTransform: "uppercase" }}>
          {eyebrow}
        </Muted>
      ) : null}
      <Display size="2xl" weight={700} center>
        {title}
      </Display>
      {xp !== undefined ? <XpCounter value={xp} /> : null}
      {stars !== undefined ? <Stars count={stars} /> : null}
      {score ? (
        <Body weight={600} color={COLORS.text} center style={tabular}>
          {score}
        </Body>
      ) : null}
      {verdict ? (
        <Body center color={COLORS.muted} style={{ maxWidth: 320 }}>
          {verdict}
        </Body>
      ) : null}
      {children ? <View style={{ alignSelf: "stretch", gap: SPACE[2], marginTop: SPACE[2] }}>{children}</View> : null}
    </View>
  );
}

export function ScoreLine({ correct, total, extra }: { correct: number; total: number; extra?: string }) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  return (
    <>
      Trafione <Text style={{ color: COLORS.accent }}>{correct}/{total}</Text> ({pct}%){extra ? ` · ${extra}` : ""}
    </>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", gap: SPACE[3], paddingVertical: SPACE[6], paddingHorizontal: SPACE[4] },
});
