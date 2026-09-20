import React, { createContext, useContext, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { GOLD_HUE, hueFrom, type Hue } from "@/lib/theme";

const Ctx = createContext<Hue>(GOLD_HUE);

/** Kolor przedmiotu dla poddrzewa (subject.accent2 = hue z SUBJECT_HUES). */
export function HueProvider({ color, seed, children }: { color?: string | null; seed?: string; children: React.ReactNode }) {
  const value = useMemo(() => hueFrom(color, seed), [color, seed]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHue(): Hue {
  return useContext(Ctx);
}

let uid = 0;

/** Miękka poświata: SVG RadialGradient (alfa `alpha` w centrum → 0 na brzegu). `pointerEvents="none"`. */
export function Glow({ color, size = 320, alpha = 0.14, style }: { color?: string; size?: number; alpha?: number; style?: StyleProp<ViewStyle> }) {
  const hue = useHue();
  const c = color ?? hue.color;
  const id = useMemo(() => `glow${++uid}`, []);
  return (
    <View pointerEvents="none" style={[s.glow, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c} stopOpacity={alpha} />
            <Stop offset="0.55" stopColor={c} stopOpacity={alpha * 0.35} />
            <Stop offset="1" stopColor={c} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  glow: { position: "absolute", alignItems: "center", justifyContent: "center" },
});
