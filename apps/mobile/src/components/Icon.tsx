import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import type { StyleProp, TextStyle } from "react-native";
import { COLORS } from "@/lib/theme";

export type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
export type MciName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

/** Ikona z @expo/vector-icons (Ionicons domyślnie; `mci` = MaterialCommunityIcons). Zero glifów tekstowych w nawigacji. */
export function Icon({ name, size = 20, color = COLORS.text, style }: { name: IoniconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

export function MIcon({ name, size = 20, color = COLORS.text, style }: { name: MciName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
}

/** Ikony odznak (ACHIEVEMENTS[].icon → Ionicons). */
export const ACHIEVEMENT_ICON: Record<string, IoniconName> = {
  sparkles: "sparkles",
  flag: "flag",
  star: "star",
  zap: "flash",
  flame: "flame",
  layers: "layers",
  trophy: "trophy",
  check: "checkmark-circle",
  target: "locate",
  gift: "gift",
  moon: "moon",
  sun: "sunny",
};

/** Ikony questów (Quest.kind → Ionicons). */
export const QUEST_ICON: Record<string, IoniconName> = {
  xp: "flash",
  combo: "flame",
  review: "layers",
  perfect: "star",
  levels: "flag",
  games: "game-controller",
  minutes: "time",
  correct: "checkmark-circle",
};
