import { LOGO } from "@nauka/shared";
import React from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { COLORS, SPACE, display } from "@/lib/theme";
import { Display } from "./Text";

let uid = 0;

/** Znak Recall: zaokrąglone „R” + iskra na kafelku fiolet→błękit (geometria z shared/logo.ts). */
export function LogoMark({ size = 32, tile = true }: { size?: number; tile?: boolean }) {
  const id = React.useMemo(() => `rl${++uid}`, []);
  return (
    <Svg width={size} height={size} viewBox={LOGO.viewBox}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={LOGO.gradient[0]} />
          <Stop offset="1" stopColor={LOGO.gradient[1]} />
        </LinearGradient>
      </Defs>
      {tile ? <Rect width={64} height={64} rx={LOGO.tileRadius} fill={`url(#${id})`} /> : null}
      <Path d={LOGO.r} fill={tile ? "#fff" : `url(#${id})`} />
      <Path d={LOGO.spark} fill={tile ? "#FFE27A" : "#FFC800"} />
    </Svg>
  );
}

/** Znak + wordmark „Recall”. */
export function Logo({ size = 30, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE[2] }}>
      <LogoMark size={size} />
      {wordmark ? (
        <Display size="md" weight={800} style={{ letterSpacing: 0.5, fontFamily: display(800), color: COLORS.text }}>
          Recall
        </Display>
      ) : null}
    </View>
  );
}
