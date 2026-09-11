import React from "react";
import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from "react-native";
import { COLORS, TYPE, body, display, tabular } from "@/lib/theme";

type Size = keyof typeof TYPE.scale;
interface P extends TextProps {
  size?: Size;
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}

const lh = (px: number, k: number) => Math.round(px * k);

/** Bricolage Grotesque — nagłówki, liczby, tytuły. letter-spacing −0.02em. */
export function Display({ size = "xl", weight = 700, color = COLORS.text, center, style, ...rest }: P & { weight?: 600 | 700 | 800 }) {
  const px = TYPE.scale[size];
  return <RNText {...rest} style={[{ fontFamily: display(weight), fontSize: px, lineHeight: lh(px, size === "4xl" || size === "3xl" ? TYPE.lineHeight.tight : TYPE.lineHeight.snug), letterSpacing: px * TYPE.tracking.tight, color }, center && { textAlign: "center" }, style]} />;
}

/** Tytuł karty / sekcji — display 600, 17–20px. */
export function Title({ size = "md", color = COLORS.text, center, style, ...rest }: P) {
  const px = TYPE.scale[size];
  return <RNText {...rest} style={[{ fontFamily: display(600), fontSize: px, lineHeight: lh(px, TYPE.lineHeight.snug), letterSpacing: px * TYPE.tracking.tight, color }, center && { textAlign: "center" }, style]} />;
}

/** Manrope body — 15px, textSoft. */
export function Body({ size = "base", weight = 400, color = COLORS.textSoft, center, style, ...rest }: P & { weight?: 400 | 500 | 600 | 700 }) {
  const px = TYPE.scale[size];
  return <RNText {...rest} style={[{ fontFamily: body(weight), fontSize: px, lineHeight: lh(px, TYPE.lineHeight.normal), color }, center && { textAlign: "center" }, style]} />;
}

/** Opisy, meta — muted. */
export function Muted({ size = "sm", weight = 500, color = COLORS.muted, center, style, ...rest }: P & { weight?: 400 | 500 | 600 | 700 }) {
  const px = TYPE.scale[size];
  return <RNText {...rest} style={[{ fontFamily: body(weight), fontSize: px, lineHeight: lh(px, TYPE.lineHeight.normal), color }, center && { textAlign: "center" }, style]} />;
}

/** Eyebrow: 12px 600 uppercase, letter-spacing 1.4. */
export function Label({ color = COLORS.muted, center, style, ...rest }: P) {
  return <RNText {...rest} style={[{ fontFamily: body(600), fontSize: TYPE.scale.xs, lineHeight: 16, letterSpacing: 1.4, textTransform: "uppercase", color }, center && { textAlign: "center" }, style]} />;
}

/** Liczba display z tabular-nums. */
export function Num({ size = "lg", weight = 700, color = COLORS.text, style, ...rest }: P & { weight?: 600 | 700 | 800 }) {
  const px = TYPE.scale[size];
  return <RNText {...rest} style={[{ fontFamily: display(weight), fontSize: px, lineHeight: lh(px, TYPE.lineHeight.snug), color }, tabular, style]} />;
}
