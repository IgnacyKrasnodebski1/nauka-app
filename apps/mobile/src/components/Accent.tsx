import { LinearGradient, type LinearGradientProps } from "expo-linear-gradient";
import React, { createContext, useContext, useMemo } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { parseAccent, type Accent } from "@/lib/theme";

// expo-linear-gradient typuje `style` przez własną kopię typów RN — rzutujemy StyleProp<ViewStyle>.
type GStyle = LinearGradientProps["style"];

const Ctx = createContext<Accent>(parseAccent(null, null));

/** Motyw przedmiotu (gradient akcentu) dla poddrzewa — odpowiednik `--accent` z legacy CSS. */
export function AccentProvider({ accent, accent2, children }: { accent?: string | null; accent2?: string | null; children: React.ReactNode }) {
  const value = useMemo(() => parseAccent(accent, accent2), [accent, accent2]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccent(): Accent {
  return useContext(Ctx);
}

/** Gradient akcentu jako tło (dowolne dzieci). */
export function AccentGradient({ style, children, opacity = 1, accent }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode; opacity?: number; accent?: Accent }) {
  const a = useAccent();
  const g = accent ?? a;
  return (
    <LinearGradient colors={g.colors} start={g.start} end={g.end} style={[style as GStyle, { opacity }]}>
      {children}
    </LinearGradient>
  );
}

/** Półprzezroczysta warstwa gradientu pod kartą (jak `.subjcard::before`). */
export function AccentWash({ opacity = 0.1, accent, radius }: { opacity?: number; accent?: Accent; radius?: number }) {
  const a = useAccent();
  const g = accent ?? a;
  return <LinearGradient pointerEvents="none" colors={g.colors} start={g.start} end={g.end} style={[StyleSheet.absoluteFill as GStyle, { opacity, borderRadius: radius }]} />;
}
