import React, { createContext, useContext, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { GOLD_HUE, hueFrom, withAlpha, type Hue } from "@/lib/theme";

const Ctx = createContext<Hue>(GOLD_HUE);

/** Kolor przedmiotu dla poddrzewa (subject.accent2 = hue z SUBJECT_HUES). */
export function HueProvider({ color, seed, children }: { color?: string | null; seed?: string; children: React.ReactNode }) {
  const value = useMemo(() => hueFrom(color, seed), [color, seed]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHue(): Hue {
  return useContext(Ctx);
}

/**
 * Miękka poświata (pseudo-radial): koncentryczne koła o malejącej alfie, rozmyte przez nakładanie.
 * Alfa łączna w centrum ≈ `alpha` (0.10–0.18 wg DESIGN.md). `pointerEvents="none"`.
 */
export function Glow({ color, size = 320, alpha = 0.14, style }: { color?: string; size?: number; alpha?: number; style?: StyleProp<ViewStyle> }) {
  const hue = useHue();
  const c = color ?? hue.color;
  // 14 koncentrycznych kół o bardzo małej alfie każdy → gładki spadek bez widocznych pierścieni
  const N = 14;
  const rings = Array.from({ length: N }, (_, i) => 1 - i / N);
  const step = alpha / N;
  return (
    <View pointerEvents="none" style={[s.glow, { width: size, height: size }, style]}>
      {rings.map((r, i) => (
        <View key={i} style={{ position: "absolute", width: size * r, height: size * r, borderRadius: (size * r) / 2, backgroundColor: withAlpha(c, step * (0.6 + (i / N) * 0.8)) }} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  glow: { position: "absolute", alignItems: "center", justifyContent: "center" },
});
