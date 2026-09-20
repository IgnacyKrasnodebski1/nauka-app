import type { MascotState } from "@nauka/shared";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from "react-native-reanimated";
import { useReduceMotion } from "@/lib/motion";
import { COLORS, PLAY, SPACE, display, tabular } from "@/lib/theme";
import { useHue } from "./Accent";
import { Confetti } from "./Confetti";
import { Icon } from "./Icon";
import { CountUp, StatCard } from "./Lesson";
import { Mascot } from "./Mascot";
import { GemIcon } from "./Pills";
import { Ring } from "./Ring";
import { Body, Display, Muted } from "./Text";

export { Confetti };

/** Animowany licznik XP (display 48, złoto, tabular). */
export function XpCounter({ value, size = 48 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline" }}>
      <CountUp value={value} prefix="+" size={size} color={COLORS.accent} />
      <Text style={[{ fontFamily: display(800), fontSize: Math.round(size * 0.4), color: COLORS.accentDeep, marginLeft: 6 }, tabular]}>XP</Text>
    </View>
  );
}

function Star({ on, i }: { on: boolean; i: number }) {
  const reduce = useReduceMotion();
  const sc = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) sc.set(withDelay(300 + i * 160, withSpring(1, { damping: 8, stiffness: 260 })));
  }, [sc, i, reduce]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }, { rotate: `${(sc.value - 1) * 40}deg` }] }));
  return (
    <Animated.View style={st}>
      <Icon name="star" size={i === 1 ? 44 : 36} color={on ? PLAY.yellow : COLORS.bg4} />
    </Animated.View>
  );
}

/** Gwiazdki wpadające springiem (środkowa większa, jak w Duolingo). */
export function Stars({ count }: { count: 0 | 1 | 2 | 3 }) {
  return (
    <View style={{ flexDirection: "row", gap: 4, alignItems: "flex-end" }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ marginBottom: i === 1 ? 6 : 0 }}>
          <Star on={i < count} i={i} />
        </View>
      ))}
    </View>
  );
}

export interface ResultStats {
  xp: number;
  /** mnożnik combo (dla etykiety) */
  comboBest?: number;
  accuracy?: number;
  seconds?: number;
  gems?: number;
}

/**
 * Ekran wyniku: maskotka cheer/sad + confetti, eyebrow, tytuł, gwiazdki, 4 karty statystyk 3D (XP z combo,
 * celność jako ring, czas, klejnoty), werdykt, akcje. Bez `stats` → prosty licznik XP.
 */
export function ResultView({ eyebrow, title, xp, stars, score, verdict, celebrate = false, stats, mascot, children }: { eyebrow?: string; title: string; xp?: number; stars?: 0 | 1 | 2 | 3; score?: React.ReactNode; verdict?: string; celebrate?: boolean; stats?: ResultStats; mascot?: MascotState; children?: React.ReactNode }) {
  const hue = useHue();
  const state: MascotState = mascot ?? (celebrate ? "cheer" : "sad");
  return (
    <View style={s.wrap}>
      <Confetti run={celebrate} count={80} origin={0.5} top={40} />
      <Mascot state={state} size={132} streak={celebrate ? 7 : 0} />
      {eyebrow ? (
        <Muted size="xs" weight={700} center color={celebrate ? PLAY.green : PLAY.red} style={{ letterSpacing: 1.4, textTransform: "uppercase" }}>
          {eyebrow}
        </Muted>
      ) : null}
      <Display size="2xl" weight={800} center>
        {title}
      </Display>
      {stars !== undefined ? <Stars count={stars} /> : null}
      {stats ? (
        <View style={s.grid}>
          <StatCard label={stats.comboBest && stats.comboBest >= 5 ? `XP · combo ×${stats.comboBest >= 10 ? 3 : 2}` : "XP"} color={PLAY.yellow} deep={PLAY.yellowDeep} icon={<Icon name="flash" size={16} color="#fff" />} delay={100}>
            <CountUp value={stats.xp} prefix="+" size={30} />
          </StatCard>
          {stats.accuracy !== undefined ? (
            <StatCard label="Celność" color={hue.color} deep={hue.deep} icon={<Icon name="locate" size={16} color="#fff" />} delay={200}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ring pct={stats.accuracy} size={44} stroke={6} color="#fff" track="rgba(0,0,0,0.25)" />
                <CountUp value={stats.accuracy} suffix="%" size={26} />
              </View>
            </StatCard>
          ) : null}
          {stats.seconds !== undefined ? (
            <StatCard label="Czas" color={PLAY.blue} deep={PLAY.blueDeep} icon={<Icon name="time" size={16} color="#fff" />} delay={300}>
              <Text style={[{ fontFamily: display(800), fontSize: 30, lineHeight: 36, color: "#fff" }, tabular]}>
                {Math.floor(stats.seconds / 60)}:{String(stats.seconds % 60).padStart(2, "0")}
              </Text>
            </StatCard>
          ) : null}
          {stats.gems !== undefined ? (
            <StatCard label="Klejnoty" color={PLAY.gemDeep} deep="#1B6B9A" icon={<GemIcon size={16} color="#fff" />} delay={400}>
              <CountUp value={stats.gems} prefix="+" size={30} />
            </StatCard>
          ) : null}
        </View>
      ) : xp !== undefined ? (
        <XpCounter value={xp} />
      ) : null}
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
      {children ? <View style={{ alignSelf: "stretch", gap: SPACE[3], marginTop: SPACE[2] }}>{children}</View> : null}
    </View>
  );
}

export function ScoreLine({ correct, total, extra }: { correct: number; total: number; extra?: string }) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  return (
    <>
      Trafione{" "}
      <Text style={{ color: COLORS.accent }}>
        {correct}/{total}
      </Text>{" "}
      ({pct}%){extra ? ` · ${extra}` : ""}
    </>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", gap: SPACE[3], paddingVertical: SPACE[4], paddingHorizontal: SPACE[2] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE[3], alignSelf: "stretch", marginTop: SPACE[2] },
});
