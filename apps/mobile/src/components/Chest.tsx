import React, { useEffect } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import { useReduceMotion } from "@/lib/motion";
import { COLORS, HARD_EDGE, PLAY, RADIUS } from "@/lib/theme";
import { Icon } from "./Icon";

/** Skrzynia (SVG): zamknięta szara / złota (otwieralna, trzęsie się co 3 s) / otwarta (wieko uniesione, blask). */
export function ChestIcon({ size = 40, state }: { size?: number; state: "locked" | "openable" | "opened" }) {
  const gold = state !== "locked";
  const body = gold ? "#C98A1E" : COLORS.bg4;
  const lid = gold ? "#F2B93B" : COLORS.faint;
  const band = gold ? "#7A4E0A" : COLORS.bg2;
  const openLid = state === "opened";
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {openLid ? <Path d="M24 4 L26 14 L36 12 L27 18 L34 26 L24 20 L14 26 L21 18 L12 12 L22 14 Z" fill={PLAY.yellow} opacity={0.9} /> : null}
      <Rect x={6} y={22} width={36} height={20} rx={4} fill={body} />
      <Rect x={6} y={22} width={36} height={4} fill={band} opacity={0.6} />
      <Rect x={20} y={22} width={8} height={20} fill={band} opacity={0.55} />
      {openLid ? <Path d="M6 22 Q6 8 24 8 Q42 8 42 22 L42 16 Q42 4 24 4 Q6 4 6 16 Z" fill={lid} transform="translate(0 -6)" /> : <Path d="M6 24 Q6 10 24 10 Q42 10 42 24 Z" fill={lid} />}
      <Rect x={20} y={20} width={8} height={9} rx={2} fill={band} />
      <Rect x={22.5} y={23} width={3} height={4} rx={1} fill={gold ? "#FFF3C4" : COLORS.muted} />
    </Svg>
  );
}

/** Węzeł skrzynki na ścieżce: kafel 64 px z krawędzią 3D. */
export function Chest({ state, onPress, style, size = 64 }: { state: "locked" | "openable" | "opened"; onPress?: () => void; style?: StyleProp<ViewStyle>; size?: number }) {
  const reduce = useReduceMotion();
  const rot = useSharedValue(0);
  useEffect(() => {
    if (reduce || state !== "openable") {
      rot.set(0);
      return;
    }
    rot.set(withRepeat(withDelay(2400, withSequence(withTiming(-8, { duration: 70 }), withTiming(8, { duration: 70 }), withTiming(-6, { duration: 70 }), withTiming(6, { duration: 70 }), withTiming(0, { duration: 70 }))), -1, false));
  }, [state, rot, reduce]);
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const face = state === "openable" ? PLAY.yellow : state === "opened" ? "rgba(255,200,0,0.18)" : COLORS.bg3;
  const deep = state === "openable" ? PLAY.yellowDeep : PLAY.surfaceDeep;
  return (
    <Pressable onPress={onPress} disabled={state !== "openable"} accessibilityLabel="Skrzynka" style={[{ width: size, height: size + HARD_EDGE + 2 }, style]}>
      <Animated.View style={[s.tile, { width: size, height: size + HARD_EDGE + 2, backgroundColor: deep, borderRadius: RADIUS.md }, st]}>
        <View style={[s.face, { width: size, height: size, backgroundColor: face, borderRadius: RADIUS.md }, state === "locked" && { borderWidth: 1, borderColor: COLORS.line }]}>
          <ChestIcon size={Math.round(size * 0.68)} state={state} />
        </View>
      </Animated.View>
      {state === "openable" ? <Sparkle size={size} /> : null}
    </Pressable>
  );
}

function Sparkle({ size }: { size: number }) {
  const reduce = useReduceMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    v.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [v, reduce]);
  const st = useAnimatedStyle(() => ({ opacity: 0.5 + v.value * 0.5, transform: [{ scale: 0.8 + v.value * 0.4 }, { rotate: `${v.value * 30}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -8, right: -8 }, st]}>
      <Icon name="sparkles" size={Math.round(size * 0.3)} color={PLAY.yellow} />
    </Animated.View>
  );
}

/** Trofeum na końcu ścieżki: złoty puchar (76 px), `claimable` = trzęsie się i błyszczy, `claimed` = spokojne. */
export function Trophy({ state, onPress, size = 76, style }: { state: "locked" | "claimable" | "claimed"; onPress?: () => void; size?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const rot = useSharedValue(0);
  useEffect(() => {
    if (reduce || state !== "claimable") {
      rot.set(0);
      return;
    }
    rot.set(withRepeat(withDelay(2000, withSequence(withTiming(-7, { duration: 80 }), withTiming(7, { duration: 80 }), withTiming(-5, { duration: 80 }), withTiming(5, { duration: 80 }), withTiming(0, { duration: 80 }))), -1, false));
  }, [state, rot, reduce]);
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const gold = state !== "locked";
  return (
    <Pressable onPress={onPress} disabled={state !== "claimable"} accessibilityLabel="Trofeum" style={[{ width: size, height: size + 6 }, style]}>
      <Animated.View style={[{ width: size, height: size + 6, borderRadius: size / 2, backgroundColor: gold ? PLAY.yellowDeep : PLAY.surfaceDeep }, st]}>
        <View style={[{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: gold ? PLAY.yellow : COLORS.bg3 }, !gold && { borderWidth: 1, borderColor: COLORS.line }]}>
          <Icon name="trophy" size={Math.round(size * 0.46)} color={gold ? "#7A4E0A" : COLORS.faint} />
        </View>
      </Animated.View>
      {state === "claimable" ? <Sparkle size={size} /> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  tile: { alignItems: "center" },
  face: { alignItems: "center", justifyContent: "center" },
});
