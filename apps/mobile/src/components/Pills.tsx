import { HEARTS_MAX, formatCountdown, type HeartsView } from "@nauka/shared";
import React, { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useReduceMotion } from "@/lib/motion";
import { COLORS, MOTION, PLAY, RADIUS, SPACE, tabular } from "@/lib/theme";
import { Icon } from "./Icon";
import { Muted, Num } from "./Text";

/** Płomień serii (SVG) z migotaniem Reanimated; `lit=false` = wygasły (szary). */
let flameUid = 0;

export function StreakFlame({ size = 22, lit = true }: { size?: number; lit?: boolean }) {
  const reduce = useReduceMotion();
  const id = React.useMemo(() => `fl${++flameUid}`, []);
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduce || !lit) return;
    v.set(withRepeat(withSequence(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 520, easing: Easing.inOut(Easing.quad) })), -1, true));
  }, [v, reduce, lit]);
  const st = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 - v.value * 0.08 }, { scaleY: 1 + v.value * 0.1 }] }));
  return (
    <Animated.View style={[{ width: size, height: size, alignItems: "center", justifyContent: "flex-end" }, st]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient id={id} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={lit ? PLAY.orange : "#6B7089"} />
            <Stop offset="1" stopColor={lit ? PLAY.yellow : "#A3A9BF"} />
          </LinearGradient>
        </Defs>
        <Path d="M12 2 C13 7 18 9 18 15 A6 6 0 0 1 6 15 C6 11 9 10 9 7 C10 9 11 9 12 2 Z" fill={`url(#${id})`} />
        <Path d="M12 11 C12.5 14 15 14.5 15 17 A3 3 0 0 1 9 17 C9 15 11 14 12 11 Z" fill={lit ? "#FFF3C4" : COLORS.bg3} opacity={0.9} />
      </Svg>
    </Animated.View>
  );
}

function PillBase({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  void onPress;
  return <View style={[s.pill, style]}>{children}</View>;
}

/** Pill serii: płomień + liczba dni (pomarańcz; szary gdy 0). */
export function StreakPill({ streak, compact }: { streak: number; compact?: boolean }) {
  const lit = streak > 0;
  return (
    <PillBase>
      <StreakFlame size={20} lit={lit} />
      <Num size="sm" weight={700} color={lit ? PLAY.orange : COLORS.muted} style={{ fontSize: 15, lineHeight: 18 }}>
        {streak}
      </Num>
      {!compact ? <Muted size="xs">{streak === 1 ? "dzień" : "dni"}</Muted> : null}
    </PillBase>
  );
}

/** Pill klejnotów (błękit). Liczba skacze springiem przy zmianie. */
export function GemsPill({ gems, compact }: { gems: number; compact?: boolean }) {
  const reduce = useReduceMotion();
  const sc = useSharedValue(1);
  const first = React.useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) return;
    sc.set(withSequence(withSpring(1.25, { damping: 8, stiffness: 300 }), withSpring(1, MOTION.spring)));
  }, [gems, sc, reduce]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <PillBase>
      <Animated.View style={st}>
        <GemIcon size={18} />
      </Animated.View>
      <Num size="sm" weight={700} color={PLAY.gem} style={{ fontSize: 15, lineHeight: 18 }}>
        {gems}
      </Num>
      {!compact ? <Muted size="xs">💎</Muted> : null}
    </PillBase>
  );
}

/** Klejnot (SVG). */
export function GemIcon({ size = 18, color = PLAY.gem }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 3 H18 L22 9 L12 21 L2 9 Z" fill={color} />
      <Path d="M6 3 L9 9 L12 21 L2 9 Z" fill="#FFFFFF" opacity={0.28} />
      <Path d="M9 9 H15 L12 21 Z" fill="#000" opacity={0.12} />
      <Path d="M2 9 H22" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1} />
    </Svg>
  );
}

/** Pill serc: 5 serc (pełne czerwone / puste) albo ∞ dla Pro; pod spodem odliczanie do kolejnego. */
export function HeartsPill({ hearts, compact, showTimer }: { hearts: HeartsView; compact?: boolean; showTimer?: boolean }) {
  const reduce = useReduceMotion();
  const sc = useSharedValue(1);
  const first = React.useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) return;
    sc.set(withSequence(withSpring(1.3, { damping: 7, stiffness: 320 }), withSpring(1, MOTION.spring)));
  }, [hearts.hearts, sc, reduce]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  if (hearts.unlimited) {
    return (
      <PillBase>
        <Animated.View style={st}>
          <Icon name="heart" size={17} color={PLAY.heart} />
        </Animated.View>
        <Icon name="infinite" size={18} color={PLAY.heart} />
      </PillBase>
    );
  }
  if (compact) {
    return (
      <PillBase>
        <Animated.View style={st}>
          <Icon name="heart" size={17} color={hearts.hearts > 0 ? PLAY.heart : COLORS.faint} />
        </Animated.View>
        <Num size="sm" weight={700} color={hearts.hearts > 0 ? PLAY.heart : COLORS.muted} style={{ fontSize: 15, lineHeight: 18 }}>
          {hearts.hearts}
        </Num>
      </PillBase>
    );
  }
  return (
    <PillBase style={{ gap: 3 }}>
      {Array.from({ length: HEARTS_MAX }, (_, i) => (
        <Animated.View key={i} style={i === hearts.hearts - 1 ? st : undefined}>
          <Icon name={i < hearts.hearts ? "heart" : "heart-outline"} size={16} color={i < hearts.hearts ? PLAY.heart : COLORS.faint} />
        </Animated.View>
      ))}
      {showTimer && hearts.nextInMs !== null ? (
        <Muted size="xs" weight={600} style={[tabular, { marginLeft: 4 }]}>
          +1 za {formatCountdown(hearts.nextInMs)}
        </Muted>
      ) : null}
    </PillBase>
  );
}

/** Pill XP (złoto). */
export function XpPill({ xp, label = "XP" }: { xp: number; label?: string }) {
  return (
    <PillBase>
      <Icon name="flash" size={16} color={COLORS.xp} />
      <Num size="sm" weight={700} color={COLORS.xp} style={{ fontSize: 15, lineHeight: 18 }}>
        {xp}
      </Num>
      <Muted size="xs">{label}</Muted>
    </PillBase>
  );
}

const s = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.line, paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.pill, minHeight: 34 },
  _u: { padding: SPACE[1] },
});
