import { comboMultiplier, nextComboAt } from "@nauka/shared";
import React, { useEffect } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useReduceMotion } from "@/lib/motion";
import { COLORS, MOTION, PLAY, RADIUS, SPACE, display } from "@/lib/theme";
import { useHue } from "./Accent";
import { Icon } from "./Icon";
import { Body, Muted, Num } from "./Text";

/** Badge combo: od 2 z rzędu licznik; ×2 (niebieski) od 5, ×3 (fiolet) od 10 — puls przy zmianie. */
export function ComboBadge({ streak }: { streak: number }) {
  const reduce = useReduceMotion();
  const sc = useSharedValue(1);
  const mult = comboMultiplier(streak);
  useEffect(() => {
    if (reduce || streak < 2) return;
    sc.set(withSequence(withSpring(1.28, { damping: 6, stiffness: 320 }), withSpring(1, MOTION.spring)));
  }, [streak, sc, reduce]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  if (streak < 2) return null;
  const color = mult === 3 ? PLAY.purple : mult === 2 ? PLAY.blue : PLAY.orange;
  const deep = mult === 3 ? PLAY.purpleDeep : mult === 2 ? PLAY.blueDeep : PLAY.orangeDeep;
  const next = nextComboAt(streak);
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={[s.combo, { backgroundColor: color, borderBottomColor: deep }, st]}>
      <Icon name="flame" size={14} color="#fff" />
      <Text style={s.comboTxt}>
        {streak}
        {mult > 1 ? ` ×${mult}` : ""}
      </Text>
      {next ? <Text style={s.comboNext}>/{next}</Text> : null}
    </Animated.View>
  );
}

/** Pasek segmentowy lekcji: jeden segment na krok, wypełnienie zielone z animacją; `done` = ile zrobione. */
export function SegmentedProgress({ done, total, color, style }: { done: number; total: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const hue = useHue();
  const c = color ?? hue.color;
  const n = Math.max(1, Math.min(total, 40));
  const step = total / n;
  return (
    <View style={[s.seg, style]}>
      {Array.from({ length: n }, (_, i) => {
        const filled = done >= (i + 1) * step - 0.001;
        const partial = !filled && done > i * step;
        return <Segment key={i} filled={filled} partial={partial} color={c} />;
      })}
    </View>
  );
}

function Segment({ filled, partial, color }: { filled: boolean; partial: boolean; color: string }) {
  const reduce = useReduceMotion();
  const w = useSharedValue(filled ? 1 : partial ? 0.5 : 0);
  useEffect(() => {
    const t = filled ? 1 : partial ? 0.5 : 0;
    w.set(reduce ? t : withTiming(t, { duration: 260 }));
  }, [filled, partial, w, reduce]);
  const st = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={s.segTrack}>
      <Animated.View style={[s.segFill, { backgroundColor: color }, st]} />
    </View>
  );
}

/** Karta statystyki (wynik): kafel 3D z ikoną, etykietą i dużą liczbą (licznik animowany). */
export function StatCard({ icon, label, value, suffix, color, deep, delay = 0, children, style }: { icon?: React.ReactNode; label: string; value?: number | string; suffix?: string; color: string; deep: string; delay?: number; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const sc = useSharedValue(reduce ? 1 : 0.6);
  const op = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    sc.set(withSpring(1, { damping: 12, stiffness: 240 }));
    op.set(withTiming(1, { duration: 220 }));
  }, [sc, op, reduce]);
  const st = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: sc.value }] }));
  useEffect(() => {
    if (reduce) return;
    sc.set(0.6);
    op.set(0);
    const t = setTimeout(() => {
      sc.set(withSpring(1, { damping: 12, stiffness: 240 }));
      op.set(withTiming(1, { duration: 220 }));
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay]);
  return (
    <Animated.View style={[s.stat, { backgroundColor: deep }, st, style]}>
      <View style={[s.statFace, { backgroundColor: color }]}>
        <View style={s.statHead}>
          {icon}
          <Muted size="xs" weight={700} color="rgba(255,255,255,0.85)" style={{ textTransform: "uppercase", letterSpacing: 1 }} numberOfLines={1}>
            {label}
          </Muted>
        </View>
        {children ??
          (typeof value === "number" ? (
            <CountUp value={value} suffix={suffix} />
          ) : (
            <Num size="xl" weight={800} color="#fff" style={{ fontSize: 28, lineHeight: 34 }}>
              {value}
              {suffix ? <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}> {suffix}</Text> : null}
            </Num>
          ))}
      </View>
    </Animated.View>
  );
}

/** Licznik 0 → value (display 800). */
export function CountUp({ value, suffix, size = 28, color = "#fff", duration = 800, prefix = "" }: { value: number; suffix?: string; size?: number; color?: string; duration?: number; prefix?: string }) {
  const reduce = useReduceMotion();
  const [n, setN] = React.useState(0);
  useEffect(() => {
    const start = Date.now();
    const total = reduce ? 1 : duration;
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - start) / total);
      const e = 1 - Math.pow(1 - k, 3);
      setN(Math.round(value * e));
      if (k >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [value, reduce, duration]);
  return (
    <Text style={{ fontFamily: display(800), fontSize: size, lineHeight: Math.round(size * 1.2), color, fontVariant: ["tabular-nums"] }}>
      {prefix}
      {n}
      {suffix ? <Text style={{ fontSize: Math.round(size * 0.5), color, opacity: 0.85 }}> {suffix}</Text> : null}
    </Text>
  );
}

/** Chip XP „+5 XP ×2”. */
export function XpChip({ xp, mult = 1, color = COLORS.xp }: { xp: number; mult?: number; color?: string }) {
  return (
    <View style={[s.chip, { borderColor: color }]}>
      <Icon name="flash" size={14} color={color} />
      <Body size="sm" weight={700} color={color}>
        +{xp} XP{mult > 1 ? ` ×${mult}` : ""}
      </Body>
    </View>
  );
}

const s = StyleSheet.create({
  combo: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, borderBottomWidth: 3 },
  comboTxt: { color: "#fff", fontFamily: display(800), fontSize: 14 },
  comboNext: { color: "rgba(255,255,255,0.7)", fontFamily: display(700), fontSize: 11 },
  seg: { flexDirection: "row", gap: 3, height: 10 },
  segTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: COLORS.bg3, overflow: "hidden" },
  segFill: { height: "100%", borderRadius: 5 },
  stat: { flex: 1, minWidth: "46%", borderRadius: RADIUS.lg, paddingBottom: 5 },
  statFace: { borderRadius: RADIUS.lg, padding: SPACE[4], gap: SPACE[2], minHeight: 96 },
  statHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", borderWidth: 1.5, borderRadius: RADIUS.pill, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: COLORS.bg2 },
});
