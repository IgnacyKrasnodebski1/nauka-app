import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, FONT, R, SP } from "@/lib/theme";
import { AccentGradient, useAccent } from "./Accent";

/* ------------------------------------------------------------- layout */

export function Screen({ children, style, scroll = false, padded = true, bottom = 110 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; scroll?: boolean; padded?: boolean; bottom?: number }) {
  const insets = useSafeAreaInsets();
  if (scroll) {
    return (
      <ScrollView style={[s.screen, style]} contentContainerStyle={[padded && s.pad, { paddingBottom: bottom + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    );
  }
  return <View style={[s.screen, padded && s.pad, style]}>{children}</View>;
}

export function TopBar({ left, title, right, onBack }: { left?: React.ReactNode; title: React.ReactNode; right?: React.ReactNode; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.topbar, { paddingTop: insets.top + 10 }]}>
      <View style={s.topLeft}>
        {onBack ? <BackButton onPress={onBack} /> : left}
        {typeof title === "string" ? (
          <Text style={s.logo} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
      </View>
      {right ? <View style={s.pills}>{right}</View> : null}
    </View>
  );
}

export function BackButton({ onPress, label = "‹" }: { onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => [s.backbtn, pressed && { opacity: 0.7 }]} accessibilityLabel="Wróć">
      <Text style={s.backtxt}>{label}</Text>
    </Pressable>
  );
}

/** Pigułka statystyki: 🔥 3 dni / ⚡ 120 xp */
export function StatPill({ icon, value, unit }: { icon: string; value: number | string; unit?: string }) {
  return (
    <View style={s.streak}>
      <Text style={s.streakTxt}>
        {icon} {value}
        {unit ? <Text style={s.streakUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------- text */

export function H1({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.h1, style]}>{children}</Text>;
}
export function Muted({ children, style, numberOfLines }: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text style={[s.muted, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}
export function Tag({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.tag, style]}>
      <Text style={s.tagTxt}>{children}</Text>
    </View>
  );
}
/** Tekst z gradientem nie istnieje w RN bez masek — używamy koloru akcentu. */
export function AccentText({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const a = useAccent();
  return <Text style={[{ color: a.solid }, style]}>{children}</Text>;
}

/* ------------------------------------------------------------- buttons */

export function PillButton({ label, onPress, ghost, disabled, style, small, danger }: { label: string; onPress?: () => void; ghost?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean; danger?: boolean }) {
  const inner = <Text style={[s.pillTxt, small && { fontSize: 14 }, ghost && { color: C.txt }, danger && { color: "#ff8aa3" }]}>{label}</Text>;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.pillWrap, small && { minHeight: 42 }, pressed && { transform: [{ scale: 0.97 }] }, disabled && { opacity: 0.45 }, style]}>
      {ghost ? (
        <View style={[s.pill, s.pillGhost, small && s.pillSmall, danger && { borderColor: "rgba(255,59,92,.35)", backgroundColor: "#33222e" }]}>{inner}</View>
      ) : (
        <AccentGradient style={[s.pill, small && s.pillSmall]}>{inner}</AccentGradient>
      )}
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
      {active ? (
        <AccentGradient style={s.chip}>
          <Text style={[s.chipTxt, { color: "#fff" }]}>{label}</Text>
        </AccentGradient>
      ) : (
        <View style={[s.chip, s.chipIdle]}>
          <Text style={s.chipTxt}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Chips({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">
      {items.map((it) => (
        <Chip key={it.id} label={it.label} active={value === it.id} onPress={() => onChange(it.id)} />
      ))}
    </ScrollView>
  );
}

export function Touch({ children, style, ...rest }: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable {...rest} style={({ pressed }) => [style, pressed && { transform: [{ scale: 0.985 }] }]}>
      {children}
    </Pressable>
  );
}

/* ------------------------------------------------------------- cards / bars */

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function ProgressBar({ pct, height = 8, style }: { pct: number; height?: number; style?: StyleProp<ViewStyle> }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <View style={[s.bar, { height, borderRadius: height }, style]}>
      <AccentGradient style={{ width: `${w}%`, height: "100%", borderRadius: height }} />
    </View>
  );
}

export function ProgressRow({ pct, label }: { pct: number; label: string }) {
  return (
    <View style={s.progressRow}>
      <ProgressBar pct={pct} style={{ flex: 1 }} />
      <Text style={s.counter}>{label}</Text>
    </View>
  );
}

export function Spec({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={s.spec}>
      <Text style={s.specVal}>{value}</Text>
      <Text style={s.specLbl}>{label}</Text>
    </View>
  );
}

export function Loading({ label = "ładowanie…" }: { label?: string }) {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={C.cyan} />
      <Text style={s.muted}>{label}</Text>
    </View>
  );
}

export function Empty({ emoji = "🫥", title, text, action }: { emoji?: string; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <View style={s.empty}>
      <Text style={{ fontSize: 52 }}>{emoji}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      {text ? <Text style={[s.muted, { textAlign: "center" }]}>{text}</Text> : null}
      {action ? <View style={{ marginTop: 8, alignSelf: "stretch" }}>{action}</View> : null}
    </View>
  );
}

export function Toast({ text }: { text: string | null }) {
  const insets = useSafeAreaInsets();
  if (!text) return null;
  return (
    <View pointerEvents="none" style={[s.toast, { top: insets.top + 56 }]}>
      <Text style={s.toastTxt}>{text}</Text>
    </View>
  );
}

/* ------------------------------------------------------------- styles */

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { paddingHorizontal: 16, paddingTop: 6 },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8, gap: 10, backgroundColor: C.bg },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  logo: { color: C.txt, fontWeight: FONT.black, fontSize: 18, letterSpacing: -0.5, flexShrink: 1 },
  backbtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, alignItems: "center", justifyContent: "center" },
  backtxt: { color: C.txt, fontSize: 22, fontWeight: FONT.bold, marginTop: -2 },
  pills: { flexDirection: "row", alignItems: "center", gap: 7 },
  streak: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, paddingVertical: 7, paddingHorizontal: 11, borderRadius: R.pill },
  streakTxt: { color: C.txt, fontWeight: FONT.bold, fontSize: 14 },
  streakUnit: { color: C.muted, fontWeight: FONT.semi, fontSize: 12 },
  h1: { color: C.txt, fontSize: 27, fontWeight: FONT.black, letterSpacing: -0.6, lineHeight: 31 },
  muted: { color: C.muted, fontSize: 15, lineHeight: 21 },
  tag: { alignSelf: "flex-start", backgroundColor: C.faint2, paddingVertical: 5, paddingHorizontal: 11, borderRadius: R.pill, marginBottom: 14 },
  tagTxt: { color: C.txt, fontSize: 11, fontWeight: FONT.bold, textTransform: "uppercase", letterSpacing: 0.7 },
  pillWrap: { width: "100%", minHeight: 52 },
  pill: { paddingVertical: 15, paddingHorizontal: 16, borderRadius: R.md, alignItems: "center", justifyContent: "center", minHeight: 52 },
  pillSmall: { paddingVertical: 10, minHeight: 42 },
  pillGhost: { backgroundColor: C.faint2, borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" },
  pillTxt: { color: "#fff", fontSize: 16, fontWeight: FONT.black },
  chips: { gap: 8, paddingVertical: 2, paddingBottom: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: R.pill },
  chipIdle: { backgroundColor: C.faint, borderWidth: 1, borderColor: C.border2 },
  chipTxt: { color: C.muted, fontSize: 13, fontWeight: FONT.bold },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: 18 },
  bar: { backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  counter: { color: C.muted, fontSize: 13, fontWeight: FONT.bold },
  spec: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", minWidth: 90 },
  specVal: { color: C.txt, fontWeight: FONT.bold, fontSize: 15 },
  specLbl: { color: C.muted, fontWeight: FONT.semi, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 30 },
  empty: { alignItems: "center", justifyContent: "center", gap: 10, padding: 28, paddingTop: 40 },
  emptyTitle: { color: C.txt, fontSize: 20, fontWeight: FONT.black, textAlign: "center" },
  toast: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 99 },
  toastTxt: { backgroundColor: C.card2, borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", color: C.txt, paddingVertical: 10, paddingHorizontal: 18, borderRadius: R.pill, fontWeight: FONT.bold, fontSize: 14, overflow: "hidden" },
});

export const SPACE = SP;
