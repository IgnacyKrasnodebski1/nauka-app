import React from "react";
import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from "react-native";
import { T, body, display, tabular } from "@/lib/theme";

interface P extends TextProps {
  size?: number;
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  /** tracking w px */
  ls?: number;
  lh?: number;
}

/** Bricolage Grotesque 800 — nagłówki, liczby, tytuły (podglądy: letter-spacing −0.4…−3 px). */
export function Display({ size = 24, color = T.txt, center, style, ls, lh, weight = 800, ...rest }: P & { weight?: 700 | 800 }) {
  return <RNText {...rest} style={[{ fontFamily: display(weight), fontSize: size, lineHeight: lh ?? Math.round(size * 1.15), letterSpacing: ls ?? -size * 0.033, color }, center && { textAlign: "center" }, style]} />;
}

/** Plus Jakarta Sans — treść. Domyślnie 14 px / 700. */
export function Body({ size = 14, weight = 700, color = T.txt, center, style, ls, lh, ...rest }: P & { weight?: 500 | 600 | 700 | 800 }) {
  return <RNText {...rest} style={[{ fontFamily: body(weight), fontSize: size, lineHeight: lh ?? Math.round(size * 1.4), letterSpacing: ls ?? 0, color }, center && { textAlign: "center" }, style]} />;
}

/** Opisy i meta — 12 px / 600, kolor muted. */
export function Muted({ size = 12, weight = 600, color = T.muted, center, style, ls, lh, ...rest }: P & { weight?: 500 | 600 | 700 | 800 }) {
  return <RNText {...rest} style={[{ fontFamily: body(weight), fontSize: size, lineHeight: lh ?? Math.round(size * 1.4), letterSpacing: ls ?? 0, color }, center && { textAlign: "center" }, style]} />;
}

/** Eyebrow: 11 px / 800 / uppercase / tracking 1.2 (podglądy: 10.5–12 px). */
export function Eyebrow({ size = 11, color = T.muted2, center, style, ls, ...rest }: P) {
  return <RNText {...rest} style={[{ fontFamily: body(800), fontSize: size, lineHeight: Math.round(size * 1.35), letterSpacing: ls ?? 1.2, textTransform: "uppercase", color }, center && { textAlign: "center" }, style]} />;
}

/** Liczba display z tabular-nums. */
export function Num({ size = 26, color = T.txt, center, style, ls, lh, weight = 800, ...rest }: P & { weight?: 700 | 800 }) {
  return <RNText {...rest} style={[{ fontFamily: display(weight), fontSize: size, lineHeight: lh ?? Math.round(size * 1.1), letterSpacing: ls ?? -size * 0.02, color }, tabular, center && { textAlign: "center" }, style]} />;
}

/** Etykieta przycisku: 15 px / 800 / tracking 1.2 / uppercase. */
export function BtnLabel({ size = 15, color = T.onAcid, style, ls, ...rest }: P) {
  return <RNText {...rest} numberOfLines={1} style={[{ fontFamily: body(800), fontSize: size, lineHeight: Math.round(size * 1.3), letterSpacing: ls ?? 1.2, textTransform: "uppercase", color }, style]} />;
}
