import type { QuizQuestion } from "@nauka/shared";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { haptic } from "@/lib/app-state";
import { KEYS_ABC } from "@/lib/games";
import { useReduceMotion } from "@/lib/motion";
import { play } from "@/lib/sfx";
import { COLORS, HARD_EDGE, PLAY, RADIUS, SPACE, body, display, shadowCard } from "@/lib/theme";
import { HtmlText } from "./HtmlText";
import { Display, Label } from "./Text";

/**
 * Pytanie A/B/C/D. Odpowiedzi jako grube kafle 3D (bg3 + krawędź); wybrana = niebieski; poprawna = zielony; błędna = czerwony.
 * `reveal=false` (egzamin) pozwala zmieniać wybór. `explain=false` → wyjaśnienie pokazuje arkusz feedbacku (lekcja).
 */
export function QuizCard({ q, picked, reveal, onPick, tag, children, explain = true, bare }: { q: QuizQuestion; picked: number | null; reveal: boolean; onPick: (i: number) => void; tag?: string; children?: React.ReactNode; explain?: boolean; bare?: boolean }) {
  return (
    <View style={bare ? s.bare : s.card}>
      {!bare ? <View style={s.hl} /> : null}
      {tag ? <Label style={{ marginBottom: SPACE[3] }}>{tag}</Label> : null}
      <Display size="xl" weight={700} style={{ marginBottom: SPACE[5] }}>
        {q.q}
      </Display>
      <View style={{ gap: SPACE[3] }}>
        {q.a.map((opt, i) => {
          const correct = reveal && i === q.c;
          const wrong = reveal && picked === i && i !== q.c;
          const sel = !reveal && picked === i;
          const dim = reveal && !correct && !wrong;
          return <Option key={i} label={opt} k={KEYS_ABC[i] ?? String(i + 1)} sel={sel} correct={correct} wrong={wrong} dim={dim} disabled={reveal} onPress={() => onPick(i)} />;
        })}
      </View>
      {explain && reveal && q.e ? (
        <Animated.View entering={FadeInDown.duration(220)} style={s.explain}>
          <Label color={COLORS.info} style={{ marginBottom: 4 }}>
            dlaczego
          </Label>
          <HtmlText html={q.e} inline textStyle={s.explainTxt} boldColor={COLORS.text} />
        </Animated.View>
      ) : null}
      {children}
    </View>
  );
}

function Option({ label, k, sel, correct, wrong, dim, disabled, onPress }: { label: string; k: string; sel: boolean; correct: boolean; wrong: boolean; dim: boolean; disabled: boolean; onPress: () => void }) {
  const reduce = useReduceMotion();
  const y = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const face = correct ? PLAY.greenSoft : wrong ? PLAY.redSoft : sel ? PLAY.blueSoft : COLORS.bg3;
  const border = correct ? PLAY.green : wrong ? PLAY.red : sel ? PLAY.blue : COLORS.lineStrong;
  const deep = correct ? PLAY.greenDeep : wrong ? PLAY.redDeep : sel ? PLAY.blueDeep : PLAY.surfaceDeep;
  const keyBg = correct ? PLAY.green : wrong ? PLAY.red : sel ? PLAY.blue : COLORS.bg4;
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      onPressIn={() => y.set(withTiming(HARD_EDGE, { duration: reduce ? 0 : 60 }))}
      onPressOut={() => y.set(withTiming(0, { duration: reduce ? 0 : 120 }))}
      onPress={() => {
        haptic.tap();
        play("tap");
        onPress();
      }}
      style={[s.optWrap, { backgroundColor: deep }, dim && { opacity: 0.4 }]}
    >
      <Animated.View style={[s.opt, { backgroundColor: face, borderColor: border }, anim]}>
        <View style={[s.k, { backgroundColor: keyBg }]}>
          <Text style={[s.kTxt, (sel || correct || wrong) && { color: "#fff" }]}>{k}</Text>
        </View>
        <Text style={[s.optTxt, (correct || wrong || sel) && { color: COLORS.text }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.lg, padding: SPACE[5], overflow: "hidden", ...shadowCard },
  bare: { paddingVertical: SPACE[2] },
  hl: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: COLORS.highlight },
  optWrap: { borderRadius: RADIUS.md, paddingBottom: HARD_EDGE },
  opt: { flexDirection: "row", gap: SPACE[3], alignItems: "center", paddingVertical: 14, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1.5, minHeight: 56 },
  k: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  kTxt: { color: COLORS.muted, fontFamily: display(800), fontSize: 14 },
  optTxt: { color: COLORS.textSoft, fontSize: 15.5, fontFamily: body(600), lineHeight: 21, flex: 1 },
  explain: { marginTop: SPACE[4], padding: SPACE[4], backgroundColor: COLORS.infoSoft, borderRadius: RADIUS.sm },
  explainTxt: { fontSize: 14.5, lineHeight: 22, color: COLORS.textSoft },
});
