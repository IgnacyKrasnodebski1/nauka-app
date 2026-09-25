import type { QuizQuestion } from "@nauka/shared";
import React, { useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { KEYS_ABC } from "@/lib/format";
import { haptic } from "@/lib/haptic";
import { play } from "@/lib/sfx";
import { T, TONES } from "@/lib/theme";
import { Icon } from "./Icon";
import { Motion } from "./Motion";
import { Body, Display } from "./Text";
import { Btn, Press, Tag } from "./ui";

/** Chipy sesji (`sessionChips`): combo / combo zerwane / ×2 XP / tag / „Pytanie N z M”. */
export function SessionChips({ n, total, combo, broken, boost, tag, word = "Pytanie", style }: { n: number; total: number; combo?: number; broken?: boolean; boost?: boolean; tag?: string; word?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }, style]}>
      {combo && combo >= 2 ? (
        <Motion kind="pop">
          <Tag label={`Combo x${combo}`} tone="gold" />
        </Motion>
      ) : broken ? (
        <Tag label="Combo zerwane" tone="red" />
      ) : null}
      {boost ? <Tag label="×2 XP" tone="gold" /> : null}
      {tag ? <Tag label={tag} /> : null}
      {total ? <Tag label={`${word} ${n} z ${total}`} /> : null}
    </View>
  );
}

export type OptState = "idle" | "sel" | "correct" | "wrong" | "dim";

/** Kafel odpowiedzi (`.qopt`): litera w kwadraciku + tekst; stany sel / correct (a-pop | a-glow) / wrong (a-shake) / dim. */
export function Option({ k, text, state, onPress, sub, small, glowCorrect, d }: { k: string; text: string; state: OptState; onPress?: () => void; sub?: string; small?: boolean; glowCorrect?: boolean; d?: number }) {
  const sel = state === "sel",
    ok = state === "correct",
    bad = state === "wrong",
    dim = state === "dim";
  const face: ViewStyle = ok
    ? { backgroundColor: TONES.acid.tint, borderColor: T.acid }
    : bad
      ? { backgroundColor: TONES.red.tint, borderColor: T.red }
      : sel
        ? { backgroundColor: TONES.acid.tint, borderColor: T.acid }
        : dim
          ? { backgroundColor: "#16142C", borderColor: "#221E42", opacity: 0.55 }
          : { backgroundColor: T.surface, borderColor: T.line };
  const edge = ok ? (glowCorrect ? "transparent" : T.acid) : bad ? T.redDark : sel ? T.acid : dim ? "transparent" : T.shadow;
  const kBg = ok ? T.acid : bad ? T.red : sel ? T.acid : T.line2;
  const kColor = ok || sel ? T.onAcid : bad ? T.onRed : T.muted;
  const txtColor = ok ? TONES.acid.txt : bad ? TONES.red.txt : sel ? TONES.acid.txt : dim ? "#8B85B8" : T.txt2;
  const inner = (
    <Press onPress={onPress} disabled={!onPress} drop={dim ? 0 : 4} edge={edge} radius={small ? 18 : 20} faceStyle={[s.opt, { minHeight: small ? 54 : 60, borderWidth: 2, paddingVertical: small ? 12 : 14, paddingHorizontal: small ? 14 : 16, gap: small ? 13 : 14 }, face]} accessibilityLabel={`${k}: ${text}`}>
      <View style={[s.k, { width: small ? 30 : 34, height: small ? 30 : 34, borderRadius: small ? 10 : 11, backgroundColor: kBg }]}>
        {ok ? <Icon name="check" size={18} stroke={3.6} color={T.onAcid} /> : bad ? <Icon name="close" size={17} stroke={3.6} color={T.onRed} /> : <Body size={small ? 13 : 14} weight={800} color={kColor}>{k}</Body>}
      </View>
      <View style={{ flex: 1 }}>
        <Body size={small ? 14 : 14.5} weight={ok || bad || sel ? 800 : 700} color={txtColor} lh={small ? 19 : 20}>
          {text}
        </Body>
        {sub ? (
          <Body size={11.5} weight={700} color={T.muted} style={{ marginTop: 2 }}>
            {sub}
          </Body>
        ) : null}
      </View>
    </Press>
  );
  if (ok) return <Motion kind={glowCorrect ? "glow" : "pop"}>{inner}</Motion>;
  if (bad) return <Motion kind="shake">{inner}</Motion>;
  return <Motion kind="up" d={d}>{inner}</Motion>;
}

export interface QuizBlockProps {
  q: QuizQuestion;
  n?: number;
  total?: number;
  combo?: number;
  broken?: boolean;
  boost?: boolean;
  tag?: string;
  /** po SPRAWDŹ: (index, ok) */
  onAnswer: (i: number, ok: boolean) => void;
  /** czas minął (boss) — od razu ujawnij poprawną */
  revealForced?: boolean;
  /** przycisk w stopce zamiast osobnego elementu (Lekcja renderuje sam) */
  footInline?: boolean;
  /** brak SPRAWDŹ — tap od razu odpowiada (egzamin) */
  instant?: boolean;
  disabled?: boolean;
  headerRight?: React.ReactNode;
}

/**
 * Pytanie + kafle + SPRAWDŹ (`quizBlock`): wybór podświetla kafel i odblokowuje SPRAWDŹ; po sprawdzeniu kafle correct / wrong / dim,
 * pytanie przygasza się. Zwraca body; stopkę renderuje `QuizFoot` (albo `footInline`).
 */
export function QuizBlock({ q, n = 1, total = 0, combo, broken, boost, tag, onAnswer, revealForced, footInline, instant, disabled, headerRight }: QuizBlockProps) {
  const [sel, setSel] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const revealed = done || !!revealForced;
  const check = (i = sel) => {
    if (done || i == null) return;
    setSel(i);
    setDone(true);
    const ok = i === q.c;
    if (ok) {
      play("correct");
      haptic.ok();
    } else {
      play("wrong");
      haptic.bad();
    }
    onAnswer(i, ok);
  };
  const stateOf = (i: number): OptState => {
    if (!revealed) return sel === i ? "sel" : "idle";
    if (i === q.c) return "correct";
    if (i === sel) return "wrong";
    return "dim";
  };
  const foot = <Btn label="Sprawdź" tone="acid" disabled={sel == null || done} onPress={() => check()} />;
  return (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <SessionChips n={n} total={total} combo={combo} broken={broken} boost={boost} tag={tag} style={{ flex: 1 }} />
        {headerRight}
      </View>
      <Motion kind="up">
        <Display size={revealed ? 24 : 26} color={revealed ? "#8B85B8" : T.txt} ls={-0.8} lh={revealed ? 28 : 30}>
          {q.q}
        </Display>
      </Motion>
      <View style={{ gap: 12 }}>
        {q.a.map((a, i) => (
          <Option key={i} k={KEYS_ABC[i] ?? String(i + 1)} text={a} state={stateOf(i)} d={i + 1} glowCorrect={revealed && sel !== q.c} onPress={revealed || disabled ? undefined : () => (instant ? check(i) : setSel(i))} />
        ))}
      </View>
      {footInline && !instant ? foot : null}
      {!footInline && !instant ? <QuizFootSlot>{foot}</QuizFootSlot> : null}
    </View>
  );
}

/** Miejsce na stopkę — Lekcja podmienia przez kontekst; domyślnie renderuje pod pytaniami. */
const FootCtx = React.createContext<((n: React.ReactNode) => void) | null>(null);
export const QuizFootProvider = FootCtx.Provider;
function QuizFootSlot({ children }: { children: React.ReactNode }) {
  const set = React.useContext(FootCtx);
  React.useEffect(() => {
    if (set) set(children);
    return () => {
      if (set) set(null);
    };
  });
  if (set) return null;
  return <View style={{ marginTop: 6 }}>{children}</View>;
}

const s = StyleSheet.create({
  opt: { flexDirection: "row", alignItems: "center" },
  k: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
