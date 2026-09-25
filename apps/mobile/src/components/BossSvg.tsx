import React from "react";
import Svg, { Circle, Path, Polygon } from "react-native-svg";
import { T } from "@/lib/theme";

/** Potwór (legacy `bossSvg`): sześciokąt w kolorze, oczy, uśmiech. `muted` = zablokowany (szary). */
export function BossSvg({ size = 112, color = T.violet, muted, inner }: { size?: number; color?: string; muted?: boolean; inner?: string }) {
  const c = muted ? T.muted3 : color;
  const dark = muted ? T.line : inner ?? T.bg;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Polygon points="60,6 108,33 108,87 60,114 12,87 12,33" fill={c} />
      <Polygon points="60,22 94,41 94,79 60,98 26,79 26,41" fill={dark} opacity={0.35} />
      <Path d="M34 44l18 8M86 44l-18 8" stroke={dark} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Circle cx={45} cy={60} r={10} fill={T.txt} />
      <Circle cx={75} cy={60} r={10} fill={T.txt} />
      <Circle cx={47} cy={62} r={5} fill={dark} />
      <Circle cx={73} cy={62} r={5} fill={dark} />
      <Path d="M46 84q14-10 28 0" stroke={dark} strokeWidth={5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
