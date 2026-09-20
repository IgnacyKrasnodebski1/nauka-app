import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReduceMotion } from "@/lib/motion";
import { COLORS, MOTION, RADIUS, SPACE, UI, body, shadowCard, tabular, type Hue } from "@/lib/theme";
import { useHue } from "./Accent";
import { Button3D, type Button3DVariant } from "./Button3D";
import { Icon } from "./Icon";
import { Body, Display, Label, Muted, Num, Title } from "./Text";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

export function TopBar({ left, title, right, onBack, subtitle }: { left?: React.ReactNode; title: React.ReactNode; subtitle?: string; right?: React.ReactNode; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.topbar, { paddingTop: insets.top + SPACE[2] }]}>
      <View style={s.topLeft}>
        {onBack ? <BackButton onPress={onBack} /> : left}
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          {typeof title === "string" ? (
            <Title size="md" numberOfLines={1}>
              {title}
            </Title>
          ) : (
            title
          )}
          {subtitle ? (
            <Muted size="xs" numberOfLines={1}>
              {subtitle}
            </Muted>
          ) : null}
        </View>
      </View>
      {right ? <View style={s.pills}>{right}</View> : null}
    </View>
  );
}

export function BackButton({ onPress, label = "‹" }: { onPress: () => void; label?: string }) {
  return (
    <Touch onPress={onPress} hitSlop={10} style={s.backbtn} accessibilityLabel={label === "✕" ? "Zamknij" : "Wróć"}>
      <Icon name={label === "✕" ? "close" : "chevron-back"} size={22} color={COLORS.text} />
    </Touch>
  );
}

/** Pills: streak (pomarańcz) / XP (złoto). Szkło, liczba display 600, etykieta muted. */
export function StatPill({ kind, value, unit }: { kind: "streak" | "xp"; value: number | string; unit?: string }) {
  const color = kind === "streak" ? COLORS.streak : COLORS.xp;
  return (
    <View style={s.pill}>
      <Icon name={kind === "streak" ? "flame" : "flash"} size={15} color={color} />
      <Num size="sm" weight={600} color={color} style={{ fontSize: 15, lineHeight: 18 }}>
        {value}
      </Num>
      {unit ? <Muted size="xs">{unit}</Muted> : null}
    </View>
  );
}

/** Mini-pill metryki (Dziś, wynik): ikona + liczba + etykieta. */
export function MiniPill({ icon, value, label, color = COLORS.text }: { icon?: string; value: number | string; label: string; color?: string }) {
  return (
    <View style={s.mini}>
      {icon ? <Text style={{ fontSize: 13 }}>{icon}</Text> : null}
      <Num size="base" weight={700} color={color} style={{ fontSize: 16, lineHeight: 20 }}>
        {value}
      </Num>
      <Muted size="xs">{label}</Muted>
    </View>
  );
}

/* ------------------------------------------------------------- pressables */

/** Pressable ze skalą 0.98 (Reanimated), respektuje Reduce Motion. */
export function Touch({ children, style, onPressIn, onPressOut, disabled, ...rest }: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const sc = useSharedValue(1);
  const reduce = useReduceMotion();
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (!reduce) sc.set(withTiming(0.98, { duration: MOTION.fast }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        sc.set(withTiming(1, { duration: MOTION.base }));
        onPressOut?.(e);
      }}
      style={[style, anim, disabled && { opacity: 0.45 }]}
    >
      {children}
    </AnimatedPressable>
  );
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const ALIAS: Record<ButtonVariant, Button3DVariant> = { primary: "green", secondary: "ghost", ghost: "ghost", danger: "red" };

/** Alias na `Button3D` (stare wywołania dostają przycisk 3D): primary = zielony, secondary/ghost = ghost, danger = czerwony. */
export function Button({ label, onPress, variant = "primary", small, disabled, style, icon }: { label: string; onPress?: () => void; variant?: ButtonVariant; small?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; icon?: string }) {
  return <Button3D label={icon ? `${icon} ${label}` : label} onPress={onPress} variant={ALIAS[variant]} size={small ? "sm" : "md"} disabled={disabled} style={style} />;
}

export function Chip({ label, active, onPress, hue }: { label: string; active?: boolean; onPress?: () => void; hue?: Hue }) {
  const h = useHue();
  const c = hue ?? h;
  return (
    <Touch onPress={onPress} style={[s.chip, active && { backgroundColor: c.soft, borderColor: c.ring }]}>
      <Text style={[s.chipTxt, active && { color: COLORS.text }]}>{label}</Text>
    </Touch>
  );
}

export function Chips({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={[s.chips, { alignItems: "center" }]} keyboardShouldPersistTaps="handled">
      {items.map((it) => (
        <Chip key={it.id} label={it.label} active={value === it.id} onPress={() => onChange(it.id)} />
      ))}
    </ScrollView>
  );
}

/* ------------------------------------------------------------- surfaces */

/** Karta: bg2, hairline, shadow.card, 1px górny highlight. `raised` → bg3. */
export function Card({ children, style, raised, flat }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; raised?: boolean; flat?: boolean }) {
  return (
    <View style={[s.card, raised && { backgroundColor: COLORS.bg3 }, !flat && shadowCard, style]}>
      <View style={s.highlight} />
      {children}
    </View>
  );
}

/** Kwadratowa ikona przedmiotu: hue.soft + ring 40%, emoji na środku. */
export function IconTile({ emoji, hue, size = UI.tile, style }: { emoji: string; hue?: Hue; size?: number; style?: StyleProp<ViewStyle> }) {
  const h = useHue();
  const c = hue ?? h;
  return (
    <View style={[{ width: size, height: size, borderRadius: Math.round(size * 0.31), backgroundColor: c.soft, borderWidth: 1, borderColor: c.ring, alignItems: "center", justifyContent: "center" }, style]}>
      <Text style={{ fontSize: Math.round(size / 2) }}>{emoji}</Text>
    </View>
  );
}

export function ProgressBar({ pct, height = 6, color, style }: { pct: number; height?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const hue = useHue();
  const w = Math.max(0, Math.min(100, pct));
  return (
    <View style={[s.bar, { height, borderRadius: height }, style]}>
      <View style={{ width: `${w}%`, height: "100%", borderRadius: height, backgroundColor: color ?? hue.color }} />
    </View>
  );
}

export function ProgressRow({ pct, label }: { pct: number; label: string }) {
  return (
    <View style={s.progressRow}>
      <ProgressBar pct={pct} style={{ flex: 1 }} />
      <Muted size="xs" weight={600} style={tabular}>
        {label}
      </Muted>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[s.divider, style]} />;
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={COLORS.faint} {...props} style={[s.input, props.multiline && { minHeight: 100, paddingTop: 12, textAlignVertical: "top" }, props.style]} />;
}

/** Wiersz sekcji: eyebrow po lewej, akcja po prawej. */
export function SectionHead({ label, right, style }: { label: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.section, style]}>
      <Label>{label}</Label>
      {right}
    </View>
  );
}

export function Loading({ label = "ładowanie…" }: { label?: string }) {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={COLORS.success} />
      <Muted>{label}</Muted>
    </View>
  );
}

/** Pusty stan: ikona w tinted tile, jedno zdanie, jeden przycisk. */
export function Empty({ icon = "◌", title, text, action }: { icon?: string; title: string; text?: string; action?: React.ReactNode }) {
  const hue = useHue();
  return (
    <View style={s.empty}>
      <IconTile emoji={icon} hue={hue} size={64} />
      <Display size="lg" weight={600} center>
        {title}
      </Display>
      {text ? (
        <Body center color={COLORS.muted} style={{ maxWidth: 300 }}>
          {text}
        </Body>
      ) : null}
      {action ? <View style={{ marginTop: SPACE[2], alignSelf: "stretch" }}>{action}</View> : null}
    </View>
  );
}

/** Toast: dół, szkło. */
export function Toast({ text }: { text: string | null }) {
  const insets = useSafeAreaInsets();
  if (!text) return null;
  return (
    <View pointerEvents="none" style={[s.toast, { bottom: insets.bottom + 96 }]}>
      <View style={s.toastBox}>
        <View style={s.highlight} />
        <Body weight={600} color={COLORS.text} center>
          {text}
        </Body>
      </View>
    </View>
  );
}

export { Body, Display, Label, Muted, Num, Title };

/* ------------------------------------------------------------- styles */

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg0 },
  pad: { paddingHorizontal: UI.gutter, paddingTop: SPACE[2] },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: UI.gutter, paddingBottom: SPACE[3], gap: SPACE[3], backgroundColor: COLORS.bg0 },
  topLeft: { flexDirection: "row", alignItems: "center", gap: SPACE[3], flex: 1, minWidth: 0 },
  backbtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center" },
  pills: { flexDirection: "row", alignItems: "center", gap: SPACE[2] },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.line, paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.pill },
  mini: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.line, paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.pill },
  chips: { gap: SPACE[2], paddingVertical: 2, paddingBottom: SPACE[3] },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.line },
  chipTxt: { color: COLORS.muted, fontSize: 13, fontFamily: body(600) },
  card: { backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.lg, padding: SPACE[5], overflow: "hidden" },
  highlight: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: COLORS.highlight },
  bar: { backgroundColor: COLORS.bg3, overflow: "hidden" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: SPACE[3], marginBottom: SPACE[3] },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.lineStrong },
  input: { height: UI.inputH, backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.md, color: COLORS.text, paddingHorizontal: SPACE[4], fontSize: 15, fontFamily: body(500) },
  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE[3], marginTop: SPACE[2] },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE[3], padding: SPACE[8], backgroundColor: COLORS.bg0 },
  empty: { alignItems: "center", justifyContent: "center", gap: SPACE[3], paddingHorizontal: SPACE[6], paddingVertical: SPACE[10] },
  toast: { position: "absolute", left: UI.gutter, right: UI.gutter, alignItems: "center", zIndex: 99 },
  toastBox: { backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.lineStrong, paddingVertical: 12, paddingHorizontal: 18, borderRadius: RADIUS.md, overflow: "hidden", ...shadowCard },
});
