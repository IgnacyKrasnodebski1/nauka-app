import React, { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { useReduceMotion } from "@/lib/motion";
import { COLORS, PLAY, display, tabular } from "@/lib/theme";
import { Icon } from "./Icon";
import { Muted, Num } from "./Text";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Ring postępu (SVG): animowany strokeDashoffset przez useAnimatedProps. `pct` 0..100. */
export function Ring({ pct, size = 64, stroke = 8, color = PLAY.green, track = COLORS.bg3, children, style, duration = 700 }: { pct: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode; style?: StyleProp<ViewStyle>; duration?: number }) {
  const reduce = useReduceMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(reduce ? Math.max(0, Math.min(100, pct)) : 0);
  useEffect(() => {
    const target = Math.max(0, Math.min(100, pct));
    p.set(reduce ? target : withTiming(target, { duration, easing: Easing.out(Easing.cubic) }));
  }, [pct, p, reduce, duration]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value / 100) }));
  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} animatedProps={props} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {children}
    </View>
  );
}

/** Ring celu dziennego: pomarańcz → zielony po osiągnięciu; w środku XP / cel. */
export function DailyGoalRing({ xp, goal, size = 104 }: { xp: number; goal: number; size?: number }) {
  const pct = Math.min(100, Math.round((xp / goal) * 100));
  const met = xp >= goal;
  const color = met ? PLAY.green : PLAY.orange;
  return (
    <Ring pct={pct} size={size} stroke={Math.round(size * 0.1)} color={color}>
      {met ? (
        <View style={{ alignItems: "center" }}>
          <Icon name="checkmark" size={Math.round(size * 0.3)} color={PLAY.green} />
          <Muted size="xs" weight={700} color={PLAY.green} style={{ marginTop: -2 }}>
            cel
          </Muted>
        </View>
      ) : (
        <View style={{ alignItems: "center" }}>
          <Num size="lg" weight={800} color={COLORS.text} style={[tabular, { fontSize: Math.round(size * 0.24), lineHeight: Math.round(size * 0.28), fontFamily: display(800) }]}>
            {xp}
          </Num>
          <Muted size="xs" weight={600} style={tabular}>
            / {goal} XP
          </Muted>
        </View>
      )}
    </Ring>
  );
}
