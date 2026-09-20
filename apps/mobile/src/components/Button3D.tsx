import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { haptic } from "@/lib/app-state";
import { useReduceMotion } from "@/lib/motion";
import { play } from "@/lib/sfx";
import { COLORS, HARD_EDGE, PLAY, RADIUS, SPACE, UI, display } from "@/lib/theme";

export type Button3DVariant = "green" | "blue" | "purple" | "gold" | "red" | "ghost" | "orange";

const VARIANTS: Record<Button3DVariant, { color: string; deep: string; text: string; border?: string }> = {
  green: { color: PLAY.green, deep: PLAY.greenDeep, text: "#FFFFFF" },
  blue: { color: PLAY.blue, deep: PLAY.blueDeep, text: "#FFFFFF" },
  purple: { color: PLAY.purple, deep: PLAY.purpleDeep, text: "#FFFFFF" },
  gold: { color: PLAY.yellow, deep: PLAY.yellowDeep, text: COLORS.accentInk },
  red: { color: PLAY.red, deep: PLAY.redDeep, text: "#FFFFFF" },
  orange: { color: PLAY.orange, deep: PLAY.orangeDeep, text: "#FFFFFF" },
  ghost: { color: COLORS.bg3, deep: PLAY.surfaceDeep, text: COLORS.textSoft, border: COLORS.lineStrong },
};

export interface Button3DProps {
  label: string;
  onPress?: () => void;
  variant?: Button3DVariant;
  /** własny kolor (np. hue przedmiotu) — nadpisuje wariant */
  color?: string;
  deep?: string;
  textColor?: string;
  size?: "md" | "sm" | "lg";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** bez dźwięku/haptyki (np. w gęstych listach) */
  silent?: boolean;
  accessibilityLabel?: string;
}

/**
 * Przycisk 3D „Duolingo”: zewnętrzny View w kolorze `deep` (krawędź HARD_EDGE), wewnętrzna ścianka przesuwa się
 * o HARD_EDGE w dół przy wciśnięciu (Reanimated). Etykieta Bricolage 700 uppercase. Dźwięk `tap` + lekka haptyka.
 */
export function Button3D({ label, onPress, variant = "green", color, deep, textColor, size = "md", disabled, style, left, right, silent, accessibilityLabel }: Button3DProps) {
  const v = VARIANTS[variant];
  const face = color ?? v.color;
  const edge = deep ?? (color ? darken(color) : v.deep);
  const txt = textColor ?? v.text;
  const h = size === "sm" ? UI.buttonHsm : size === "lg" ? 58 : UI.buttonH;
  const reduce = useReduceMotion();
  const y = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPressIn={() => y.set(withTiming(HARD_EDGE, { duration: reduce ? 0 : 60 }))}
      onPressOut={() => y.set(withTiming(0, { duration: reduce ? 0 : 120 }))}
      onPress={() => {
        if (!silent) {
          haptic.tap();
          play("tap");
        }
        onPress?.();
      }}
      style={[s.wrap, { backgroundColor: edge, borderRadius: size === "sm" ? RADIUS.sm : RADIUS.md }, disabled && { opacity: 0.45 }, style]}
    >
      <Animated.View style={[s.face, { backgroundColor: face, height: h, borderRadius: size === "sm" ? RADIUS.sm : RADIUS.md, paddingHorizontal: size === "sm" ? SPACE[3] : SPACE[5] }, v.border && !color ? { borderWidth: 1, borderColor: v.border } : null, anim]}>
        {left ? <View style={s.side}>{left}</View> : null}
        <Text style={[s.txt, { color: txt, fontSize: size === "sm" ? 13 : size === "lg" ? 17 : 15 }]} numberOfLines={1}>
          {label}
        </Text>
        {right ? <View style={s.side}>{right}</View> : null}
      </Animated.View>
    </Pressable>
  );
}

/** Kafel 3D (przedmiot, CTA, karta statystyk): ten sam mechanizm, dowolna zawartość. */
export function Tile3D({ children, onPress, color, deep, style, faceStyle, edge = HARD_EDGE, disabled, silent, radius = RADIUS.lg, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; color: string; deep?: string; style?: StyleProp<ViewStyle>; faceStyle?: StyleProp<ViewStyle>; edge?: number; disabled?: boolean; silent?: boolean; radius?: number; accessibilityLabel?: string }) {
  const reduce = useReduceMotion();
  const y = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const pressable = !!onPress && !disabled;
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!pressable}
      onPressIn={() => y.set(withTiming(edge, { duration: reduce ? 0 : 60 }))}
      onPressOut={() => y.set(withTiming(0, { duration: reduce ? 0 : 120 }))}
      onPress={() => {
        if (!silent) {
          haptic.tap();
          play("tap");
        }
        onPress?.();
      }}
      style={[{ backgroundColor: deep ?? darken(color), borderRadius: radius, paddingBottom: edge }, style]}
    >
      <Animated.View style={[{ backgroundColor: color, borderRadius: radius, overflow: "hidden" }, faceStyle, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

function darken(hex: string, amount = 0.28): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const f = (c: number) => Math.max(0, Math.round(c * (1 - amount)));
  const r = f((n >> 16) & 255),
    g = f((n >> 8) & 255),
    b = f(n & 255);
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

const s = StyleSheet.create({
  wrap: { paddingBottom: HARD_EDGE, alignSelf: "stretch" },
  face: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[2] },
  side: { alignItems: "center", justifyContent: "center" },
  txt: { fontFamily: display(700), textTransform: "uppercase", letterSpacing: 0.6 },
});
