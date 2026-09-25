import React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { haptic } from "@/lib/haptic";
import { useReduceMotion } from "@/lib/motion";
import { play } from "@/lib/sfx";
import { DROP, PILL_TXT, T, TONES, UI, body, display, type Tone, type ToneSet } from "@/lib/theme";
import { useAccent } from "./Accent";
import { Icon, type IconName } from "./Icon";
import { Motion, type MotionKind } from "./Motion";
import { Body, BtnLabel, Display, Eyebrow, Muted } from "./Text";

/* ------------------------------------------------------------- tła */

/** Rozmyte koło w tle (`.blob.a-float`) — kolory z podglądów. */
export const BLOB: Record<string, string> = { violet: "#2A1240", cyan: "#10233A", cyan2: "#0E2430", acid: "#1E2A10", amber: "#2A1C10", gold: "#2A2110", pink: "#241536", red: "#2A1017", mid: "#241536", boss: "#241536" };

export function Blob({ tone = "violet", size = 300, top, left, right, bottom, center, d }: { tone?: keyof typeof BLOB; size?: number; top?: number; left?: number; right?: number; bottom?: number; center?: boolean; d?: number }) {
  return (
    <Motion kind="float" d={d} pointerEvents="none" style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: BLOB[tone] ?? BLOB.violet, top, left, right, bottom }, center && { left: "50%", marginLeft: -size / 2 }]} />
  );
}

/** Ekran: tło `--bg`, opcjonalny blob, opcjonalne przewijanie. `top` = odstęp od safe area (podglądy: 52–54 px od góry ekranu). */
export function Screen({ children, scroll, pad = true, blob, style, contentStyle, bottom = 26 }: { children: React.ReactNode; scroll?: boolean; pad?: boolean; blob?: React.ReactNode; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; bottom?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.screen, style]}>
      {blob}
      {scroll ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[pad && s.pad, { paddingBottom: bottom + insets.bottom }, contentStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad && s.pad, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

/** Górny odstęp = safe area + 14 (podglądy: 52–54 px na iPhone). */
export function useTop(extra = 14): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.top, 14) + extra;
}

/* ------------------------------------------------------------- pressables */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Wciskany element z twardą krawędzią: zewnętrzny View w kolorze `edge` (wysokość `drop`), ścianka zjeżdża o `drop` px.
 * Odpowiada `box-shadow: 0 Npx 0 color` + `:active{transform:translateY(N)}` z tokens.css.
 */
export function Press({ children, onPress, onLongPress, drop = DROP.card, edge = T.shadow, radius = 22, style, faceStyle, disabled, silent, accessibilityLabel, hitSlop }: { children: React.ReactNode; onPress?: () => void; onLongPress?: () => void; drop?: number; edge?: string; radius?: number; style?: StyleProp<ViewStyle>; faceStyle?: StyleProp<ViewStyle>; disabled?: boolean; silent?: boolean; accessibilityLabel?: string; hitSlop?: number }) {
  const reduce = useReduceMotion();
  const y = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const active = !!onPress && !disabled;
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!active && !onLongPress}
      hitSlop={hitSlop}
      onPressIn={() => active && y.set(withTiming(drop, { duration: reduce ? 0 : 60 }))}
      onPressOut={() => y.set(withTiming(0, { duration: reduce ? 0 : 120 }))}
      onLongPress={onLongPress}
      onPress={() => {
        if (!silent) haptic.tap();
        onPress?.();
      }}
      style={[{ backgroundColor: drop ? edge : "transparent", borderRadius: radius, paddingBottom: drop }, style]}
    >
      <Animated.View style={[{ borderRadius: radius }, faceStyle, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Zwykły dotyk bez krawędzi (linki, chipy, ikony). */
export function Touch({ children, style, disabled, ...rest }: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const sc = useSharedValue(1);
  const reduce = useReduceMotion();
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <AnimatedPressable {...rest} disabled={disabled} onPressIn={() => !reduce && sc.set(withTiming(0.97, { duration: 80 }))} onPressOut={() => sc.set(withTiming(1, { duration: 140 }))} style={[style, anim, disabled && { opacity: 0.5 }]}>
      {children}
    </AnimatedPressable>
  );
}

export type BtnVariant = "primary" | "ghost" | "text" | "danger";

/**
 * Przycisk główny (tokens.css `.btn`): 58 px, promień 18, płaski kolor + krawędź 5 px, etykieta 15/800/1.2 uppercase.
 * `tone` = kolor (domyślnie akcent z kontekstu — na ekranach bez przedmiotu limonka). `ghost` = surface + linia, `text` = sam tekst.
 */
export function Btn({ label, onPress, variant = "primary", tone, disabled, style, left, right, small, glow, accent: useCtx = true, accessibilityLabel }: { label: string; onPress?: () => void; variant?: BtnVariant; tone?: Tone; disabled?: boolean; style?: StyleProp<ViewStyle>; left?: React.ReactNode; right?: React.ReactNode; small?: boolean; glow?: boolean; accent?: boolean; accessibilityLabel?: string }) {
  const ctx = useAccent();
  const set: ToneSet = tone ? TONES[tone] : variant === "danger" ? TONES.red : useCtx ? ctx : TONES.acid;
  const h = small ? UI.btnHsm : UI.btnH;
  const radius = small ? 15 : 18;
  let face: ViewStyle = { backgroundColor: set.color };
  let edge = set.dark;
  let color = set.on;
  if (variant === "ghost") {
    face = { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line };
    edge = T.shadow;
    color = T.txt2;
  } else if (variant === "text") {
    face = { backgroundColor: "transparent" };
    edge = "transparent";
    color = T.muted;
  }
  if (disabled) {
    face = { backgroundColor: T.disabledBg };
    edge = "transparent";
    color = T.disabledTxt;
  }
  const drop = variant === "text" || disabled ? 0 : DROP.btn;
  const inner = (
    <Press
      onPress={() => {
        play("tap");
        onPress?.();
      }}
      disabled={disabled}
      drop={drop}
      edge={edge}
      radius={radius}
      style={glow && !disabled ? undefined : style}
      accessibilityLabel={accessibilityLabel ?? label}
      faceStyle={[{ height: h, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16 }, face]}
    >
      {left}
      <BtnLabel color={color} size={small ? 13.5 : 15}>
        {label}
      </BtnLabel>
      {right}
    </Press>
  );
  return glow && !disabled ? (
    <Motion kind="glow" style={style}>
      {inner}
    </Motion>
  ) : (
    inner
  );
}

/** Okrągły przycisk 40/44 px (wstecz, zamknij, ustawienia). */
export function RoundBtn({ icon, onPress, size = 40, label, style, dark }: { icon: IconName; onPress?: () => void; size?: number; label: string; style?: StyleProp<ViewStyle>; dark?: boolean }) {
  return (
    <Touch onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: dark ? "rgba(0,0,0,0.45)" : T.surface, borderWidth: dark ? 0 : 2, borderColor: T.line, alignItems: "center", justifyContent: "center" }, style]}>
      <Icon name={icon} size={icon === "back" ? 20 : 18} stroke={3} color={T.txt} />
    </Touch>
  );
}

/** Nagłówek ekranu: [wstecz] Tytuł (Bricolage 18) + podtytuł + prawa strona. */
export function TopBar({ title, sub, onBack, onClose, right, big, style }: { title?: React.ReactNode; sub?: string; onBack?: () => void; onClose?: () => void; right?: React.ReactNode; big?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.topbar, style]}>
      {onBack ? <RoundBtn icon="back" onPress={onBack} label="Wróć" /> : null}
      {onClose && !onBack ? <RoundBtn icon="close" onPress={onClose} label="Zamknij" /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === "string" ? (
          <Display size={big ? 26 : 18} numberOfLines={1}>
            {title}
          </Display>
        ) : (
          title
        )}
        {sub ? (
          <Muted style={{ marginTop: 2 }} numberOfLines={1}>
            {sub}
          </Muted>
        ) : null}
      </View>
      {right}
      {onClose && onBack ? <RoundBtn icon="close" onPress={onClose} label="Zamknij" /> : null}
    </View>
  );
}

/* ------------------------------------------------------------- powierzchnie */

/** Karta (tokens.css `.card`): surface + 2 px linia + promień 22 + krawędź 4 px. `tone` = wersja w tincie. */
export function Card({ children, style, tone, padding = 16, radius = 22, drop = DROP.card, onPress, flat, accessibilityLabel }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: Tone | "accent"; padding?: number; radius?: number; drop?: number; onPress?: () => void; flat?: boolean; accessibilityLabel?: string }) {
  const ctx = useAccent();
  const set = tone === "accent" ? ctx : tone ? TONES[tone] : null;
  const face: ViewStyle = { backgroundColor: set ? set.tint : T.surface, borderWidth: 2, borderColor: set ? set.tintLine : T.line, borderRadius: radius, padding };
  const edge = set ? set.tintShadow : T.shadow;
  if (onPress)
    return (
      <Press onPress={onPress} drop={flat ? 0 : drop} edge={edge} radius={radius} style={style} faceStyle={face} accessibilityLabel={accessibilityLabel}>
        {children}
      </Press>
    );
  return <View style={[{ backgroundColor: edge, borderRadius: radius, paddingBottom: flat ? 0 : drop }, style]}>{<View style={face}>{children}</View>}</View>;
}

/** Karta „wyróżniona” kolorem (kafel z ramką w kolorze akcentu + krawędź w kolorze, np. wybrany wariant). */
export function AccentCard({ children, style, tone, padding = 14, radius = 20, onPress, drop = DROP.card, edgeSolid }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: Tone; padding?: number; radius?: number; onPress?: () => void; drop?: number; edgeSolid?: boolean }) {
  const ctx = useAccent();
  const set = tone ? TONES[tone] : ctx;
  const face: ViewStyle = { backgroundColor: set.tint, borderWidth: 2, borderColor: set.color, borderRadius: radius, padding };
  return (
    <Press onPress={onPress} drop={drop} edge={edgeSolid ? set.color : set.dark} radius={radius} style={style} faceStyle={face}>
      {children}
    </Press>
  );
}

/** Wiersz listy w karcie ustawień (`.setrow`): ikona · tytuł/opis · wartość · chevron. */
export function Row({ icon, iconColor, title, sub, value, valueColor, onPress, chevron, left, right, danger, style, titleColor }: { icon?: IconName; iconColor?: string; title: string; sub?: string; value?: string; valueColor?: string; onPress?: () => void; chevron?: boolean; left?: React.ReactNode; right?: React.ReactNode; danger?: boolean; style?: StyleProp<ViewStyle>; titleColor?: string }) {
  const inner = (
    <View style={[s.row, style]}>
      {left}
      {icon ? <Icon name={icon} size={20} stroke={2.4} color={iconColor ?? (danger ? T.red : T.txt)} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Body color={titleColor ?? (danger ? T.red : T.txt)}>{title}</Body>
        {sub ? (
          <Muted size={11.5} style={{ marginTop: 2 }}>
            {sub}
          </Muted>
        ) : null}
      </View>
      {value ? (
        <Body size={13} weight={800} color={valueColor ?? T.acid}>
          {value}
        </Body>
      ) : null}
      {right}
      {chevron ?? onPress ? <Icon name="chevron-right" size={18} color={T.muted2} /> : null}
    </View>
  );
  return onPress ? (
    <Touch onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      {inner}
    </Touch>
  ) : (
    inner
  );
}

export function Sep({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 2, backgroundColor: T.line2 }, style]} />;
}

/** Karta listy (`.setcard`): dzieci rozdzielane separatorem 2 px. */
export function ListCard({ children, style, padding = 15, tone }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padding?: number; tone?: Tone }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <Card style={style} tone={tone} padding={0}>
      <View style={{ paddingHorizontal: padding, paddingVertical: 4 }}>
        {items.map((c, i) => (
          <React.Fragment key={i}>
            {i ? <Sep /> : null}
            {c}
          </React.Fragment>
        ))}
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------- małe elementy */

/** Chip filtrów/zakładek (`.subtab`, `.catchip`): aktywny = pełny kolor akcentu, nieaktywny = surface + linia. */
export function Chip({ label, active, onPress, tone, style, icon }: { label: string; active?: boolean; onPress?: () => void; tone?: Tone; style?: StyleProp<ViewStyle>; icon?: IconName }) {
  const ctx = useAccent();
  const set = tone ? TONES[tone] : ctx;
  return (
    <Touch onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }} style={[s.chip, active ? { backgroundColor: set.color, borderColor: set.color } : null, style]}>
      {icon ? <Icon name={icon} size={15} color={active ? set.on : T.muted} /> : null}
      <Body size={12.5} weight={800} color={active ? set.on : T.muted}>
        {label}
      </Body>
    </Touch>
  );
}

/** Plakietka uppercase (`.chip`/`.tchip`/`.qn`): tone = tint + kolor, brak = surface + linia + muted. */
export function Tag({ label, tone, style, size = 10.5, solid }: { label: string; tone?: Tone | "accent"; style?: StyleProp<ViewStyle>; size?: number; solid?: boolean }) {
  const ctx = useAccent();
  const set = tone === "accent" ? ctx : tone ? TONES[tone] : null;
  return (
    <View style={[s.tag, set ? (solid ? { backgroundColor: set.color } : { backgroundColor: set.tint }) : { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, paddingVertical: 4 }, style]}>
      <Eyebrow size={size} color={set ? (solid ? set.on : set.color) : T.muted}>
        {label}
      </Eyebrow>
    </View>
  );
}

/** Monogram zamiast emoji: pierwsza litera nazwy w kafelku w kolorze akcentu (legacy `mono`/`initial`). */
export function initialOf(str: string): string {
  const m = /[\p{L}\p{N}]/u.exec(String(str ?? ""));
  return m ? m[0]!.toUpperCase() : "?";
}
export function Mono({ text, size = 44, tone, color, on, style, radius }: { text: string; size?: number; tone?: Tone; color?: string; on?: string; style?: StyleProp<ViewStyle>; radius?: number }) {
  const ctx = useAccent();
  const set = tone ? TONES[tone] : ctx;
  return (
    <View accessible={false} style={[{ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.34), backgroundColor: color ?? set.color, alignItems: "center", justifyContent: "center" }, style]}>
      <Display size={Math.round(size * 0.5)} color={on ?? set.on} ls={-0.5} lh={Math.round(size * 0.6)}>
        {initialOf(text)}
      </Display>
    </View>
  );
}

/** Kafelek ikony w kolorze (`.ico` w wierszach): 36–52 px, promień ~1/3. */
export function IconTile({ icon, size = 44, tone, color, on, stroke, style, kind }: { icon: IconName; size?: number; tone?: Tone; color?: string; on?: string; stroke?: number; style?: StyleProp<ViewStyle>; kind?: MotionKind }) {
  const ctx = useAccent();
  const set = tone ? TONES[tone] : ctx;
  const tile = (
    <View style={[{ width: size, height: size, borderRadius: Math.round(size * 0.33), backgroundColor: color ?? set.color, alignItems: "center", justifyContent: "center" }, style]}>
      <Icon name={icon} size={Math.round(size * 0.52)} stroke={stroke ?? 2.6} color={on ?? set.on} />
    </View>
  );
  return kind ? <Motion kind={kind}>{tile}</Motion> : tile;
}

/** Przełącznik 48×28 (podglądy Settings). */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const reduce = useReduceMotion();
  const x = useSharedValue(value ? 20 : 0);
  React.useEffect(() => {
    x.set(withTiming(value ? 20 : 0, { duration: reduce ? 0 : 160 }));
  }, [value, reduce, x]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} onPress={() => onChange(!value)} hitSlop={8} style={[s.toggle, { backgroundColor: value ? T.acid : T.line2 }]}>
      <Animated.View style={[s.knob, { backgroundColor: value ? T.onAcid : T.muted3 }, st]} />
    </Pressable>
  );
}

/** Pigułka statystyki w nagłówku: seria / gemy / serca. */
export function Pill({ kind, value, onPress, beat, style, unit }: { kind: "streak" | "gems" | "hearts" | "xp" | "acid"; value: number | string; onPress?: () => void; beat?: boolean; style?: StyleProp<ViewStyle>; unit?: string }) {
  const map = {
    streak: { icon: "flame" as IconName, color: T.flame, txt: PILL_TXT.streak, label: "Seria dni" },
    gems: { icon: "gem" as IconName, color: T.cyan, txt: PILL_TXT.gems, label: "Gemy. Otwórz plecak" },
    hearts: { icon: "heart" as IconName, color: T.red, txt: PILL_TXT.hearts, label: "Życia" },
    xp: { icon: "bolt" as IconName, color: T.gold, txt: T.gold, label: "XP" },
    acid: { icon: "bolt" as IconName, color: T.acid, txt: T.acid, label: "XP" },
  }[kind];
  const ic = <Icon name={map.icon} size={16} color={map.color} />;
  return (
    <Touch onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : "text"} accessibilityLabel={`${map.label}: ${value}`} style={[s.pill, style]}>
      {beat ? <Motion kind="beat">{ic}</Motion> : ic}
      <Body size={14} weight={800} color={map.txt} style={{ lineHeight: 18 }}>
        {value}
      </Body>
      {unit ? (
        <Muted size={11} weight={700} color={T.muted}>
          {unit}
        </Muted>
      ) : null}
    </Touch>
  );
}

/** Nagłówek sekcji: eyebrow + link po prawej (limonka 12.5/800). */
export function SectionHead({ label, link, onLink, style, color }: { label: string; link?: string; onLink?: () => void; style?: StyleProp<ViewStyle>; color?: string }) {
  return (
    <View style={[s.section, style]}>
      <Eyebrow color={color}>{label}</Eyebrow>
      {link ? (
        <Touch onPress={onLink} accessibilityRole="button" hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Body size={12.5} weight={800} color={T.acid}>
            {link}
          </Body>
        </Touch>
      ) : null}
    </View>
  );
}

/** Pierścień SVG (wynik, gotowość). */
export function Ring({ pct, size = 124, stroke = 11, color, track = T.line2, children }: { pct: number; size?: number; stroke?: number; color: string; track?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - p / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps & { big?: boolean }) {
  const { big, style, ...rest } = props;
  return <TextInput placeholderTextColor={T.muted2} {...rest} style={[s.input, big && { fontFamily: display(800), fontSize: 24, letterSpacing: 0.5 }, rest.multiline && { minHeight: 96, paddingTop: 13, textAlignVertical: "top" }, style]} />;
}

export function Loading({ label = "wczytuję…" }: { label?: string }) {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={T.acid} />
      <Muted>{label}</Muted>
    </View>
  );
}

/** Notka w tincie (`.infobox`, `.hintbox`, `.notebox`): ikona + tekst. */
export function Note({ icon = "info", tone = "gold", text, style, children, blink, dashed }: { icon?: IconName; tone?: Tone; text?: string; style?: StyleProp<ViewStyle>; children?: React.ReactNode; blink?: boolean; dashed?: boolean }) {
  const set = TONES[tone];
  const ic = <Icon name={icon} size={18} stroke={2.4} color={dashed ? T.muted : set.color} />;
  return (
    <View style={[s.note, dashed ? { backgroundColor: T.surface, borderColor: T.dash, borderStyle: "dashed" } : { backgroundColor: set.tint, borderColor: set.tintLine }, style]}>
      {blink ? <Motion kind="blink">{ic}</Motion> : ic}
      <View style={{ flex: 1 }}>
        {text ? (
          <Body size={12.5} weight={700} color={dashed ? T.muted : set.txt} lh={17}>
            {text}
          </Body>
        ) : null}
        {children}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------- arkusz od dołu */

/**
 * Panel od dołu (`.sheet.a-rise`): przyciemnione tło, górna krawędź 3 px w kolorze, promień 32/30 na górze.
 * `tone` = kolor krawędzi/tła (ok = acid tint, bad = red tint, neutral = surface-2).
 */
export function Sheet({ open, onClose, children, tone, bg, top, handle = true, dismissable = true, testID }: { open: boolean; onClose?: () => void; children: React.ReactNode; tone?: Tone; bg?: string; top?: number; handle?: boolean; dismissable?: boolean; testID?: string }) {
  const insets = useSafeAreaInsets();
  const set = tone ? TONES[tone] : null;
  if (!open) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismissable ? onClose : undefined} statusBarTranslucent>
      <View style={s.backdrop} testID={testID}>
        <Pressable style={[StyleSheet.absoluteFill, s.noFocus]} focusable={false} onPress={dismissable ? onClose : undefined} accessibilityLabel="Zamknij" />
        <Motion kind="rise" style={[s.sheet, { backgroundColor: bg ?? (set ? set.tint : T.surface2), borderTopColor: set ? set.color : T.acid, paddingBottom: Math.max(insets.bottom, 18) + 8 }, top != null ? { position: "absolute", left: 0, right: 0, bottom: 0, top } : { maxHeight: "92%" }]}>
          {handle ? <View style={s.handle} /> : null}
          {children}
        </Motion>
      </View>
    </Modal>
  );
}

/** Toast (`.toast`): dół, ciemna karta, ikona w kolorze + tekst. */
export function Toast({ text, icon, tone = "acid" }: { text: string | null; icon?: IconName; tone?: Tone }) {
  const insets = useSafeAreaInsets();
  if (!text) return null;
  return (
    <View pointerEvents="none" style={[s.toastWrap, { bottom: insets.bottom + UI.tabBarH + 22 }]}>
      <Motion kind="pop" style={s.toast}>
        {icon ? <Icon name={icon} size={16} color={TONES[tone].color} /> : null}
        <Body size={13} weight={700} center>
          {text}
        </Body>
      </Motion>
    </View>
  );
}

/** Stan pusty w środku ekranu. */
export function Empty({ icon = "info", title, text, action }: { icon?: IconName; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIco}>
        <Icon name={icon} size={30} stroke={2.4} color={T.acid} />
      </View>
      <Display size={22} center>
        {title}
      </Display>
      {text ? (
        <Muted size={13} center lh={19} style={{ maxWidth: 300 }}>
          {text}
        </Muted>
      ) : null}
      {action ? <View style={{ alignSelf: "stretch", marginTop: 6 }}>{action}</View> : null}
    </View>
  );
}

/** Kropki postępu (prawda/fałsz, swipe). */
export function Dots({ n, results, cur, size = 9 }: { n: number; results: (boolean | null | undefined)[]; cur?: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
      {Array.from({ length: n }, (_, i) => {
        const r = results[i];
        const c = r === true ? T.acid : r === false ? T.red : i === cur ? T.cyan : T.line2;
        const dot = <View key={i} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c }} />;
        return i === cur && r == null ? (
          <Motion key={i} kind="blink">
            {dot}
          </Motion>
        ) : (
          dot
        );
      })}
    </View>
  );
}

/** Pasek segmentowy lekcji (`.segbar`): krok = segment; on = limonka, bad = czerwień. */
export function SegBar({ total, done, marks, color }: { total: number; done: number; marks?: Record<number, "bad">; color?: string }) {
  const ctx = useAccent();
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 5 }}>
      {Array.from({ length: Math.max(1, total) }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 10, borderRadius: 999, backgroundColor: i < done ? (marks?.[i] === "bad" ? T.red : (color ?? ctx.color)) : T.line2 }} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  pad: { paddingHorizontal: UI.gutter },
  topbar: { flexDirection: "row", alignItems: "center", gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, minHeight: 48 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, minHeight: 36 },
  tag: { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  toggle: { width: 48, height: 28, borderRadius: 999, padding: 3, justifyContent: "center" },
  knob: { width: 22, height: 22, borderRadius: 11 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 999, paddingVertical: 6, paddingLeft: 10, paddingRight: 12, minHeight: 34 },
  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  input: { minHeight: 48, backgroundColor: T.surface2, borderWidth: 2, borderColor: T.line, borderRadius: 16, color: T.txt, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5, fontFamily: body(700) },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32, backgroundColor: T.bg },
  note: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 2, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14 },
  backdrop: { flex: 1, backgroundColor: T.dim, justifyContent: "flex-end" },
  /** web: bez ramki fokusu na tle arkusza (przeglądarka rysuje outline po nawigacji) */
  noFocus: { outlineWidth: 0 },
  sheet: { borderTopWidth: 3, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 18, paddingTop: 12, gap: 14 },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: T.dash, marginBottom: 2 },
  toastWrap: { position: "absolute", left: UI.gutter, right: UI.gutter, alignItems: "center", zIndex: 99 },
  toast: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 16 },
  empty: { alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24, paddingVertical: 40 },
  emptyIco: { width: 64, height: 64, borderRadius: 22, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, alignItems: "center", justifyContent: "center" },
});
