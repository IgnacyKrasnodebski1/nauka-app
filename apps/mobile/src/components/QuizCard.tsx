import type { QuizQuestion } from "@nauka/shared";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { KEYS_ABC } from "@/lib/games";
import { COLORS, RADIUS, SPACE, body, display, shadowCard } from "@/lib/theme";
import { HtmlText } from "./HtmlText";
import { Display, Label } from "./Text";
import { Touch } from "./ui";

/**
 * Pytanie A/B/C/D. Odpowiedzi pełnej szerokości na bg3; wybrana = złoty ring; poprawna = successSoft + ring; błędna = dangerSoft.
 * `reveal=false` (egzamin) pozwala zmieniać wybór.
 */
export function QuizCard({ q, picked, reveal, onPick, tag, children }: { q: QuizQuestion; picked: number | null; reveal: boolean; onPick: (i: number) => void; tag?: string; children?: React.ReactNode }) {
  return (
    <View style={s.card}>
      <View style={s.hl} />
      {tag ? <Label style={{ marginBottom: SPACE[3] }}>{tag}</Label> : null}
      <Display size="lg" weight={700} style={{ marginBottom: SPACE[5] }}>
        {q.q}
      </Display>
      <View style={{ gap: SPACE[2] }}>
        {q.a.map((opt, i) => {
          const correct = reveal && i === q.c;
          const wrong = reveal && picked === i && i !== q.c;
          const sel = !reveal && picked === i;
          const dim = reveal && !correct && !wrong;
          return (
            <Touch key={i} onPress={() => onPick(i)} disabled={reveal} style={[s.opt, sel && s.optSel, correct && s.optOk, wrong && s.optBad, dim && { opacity: 0.45 }]}>
              <View style={[s.k, sel && { backgroundColor: COLORS.accent }, correct && { backgroundColor: COLORS.success }, wrong && { backgroundColor: COLORS.danger }]}>
                <Text style={[s.kTxt, (sel || correct || wrong) && { color: COLORS.accentInk }]}>{KEYS_ABC[i] ?? String(i + 1)}</Text>
              </View>
              <Text style={[s.optTxt, correct && { color: COLORS.text }, wrong && { color: COLORS.text }]}>{opt}</Text>
            </Touch>
          );
        })}
      </View>
      {reveal && q.e ? (
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

const s = StyleSheet.create({
  card: { backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.lg, padding: SPACE[5], overflow: "hidden", ...shadowCard },
  hl: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: COLORS.highlight },
  opt: { flexDirection: "row", gap: SPACE[3], alignItems: "center", paddingVertical: 13, paddingHorizontal: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.line },
  optSel: { borderColor: COLORS.accent, backgroundColor: COLORS.bg4 },
  optOk: { backgroundColor: COLORS.successSoft, borderColor: COLORS.success },
  optBad: { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.danger },
  k: { width: 26, height: 26, borderRadius: 8, backgroundColor: COLORS.bg4, alignItems: "center", justifyContent: "center" },
  kTxt: { color: COLORS.muted, fontFamily: display(700), fontSize: 13 },
  optTxt: { color: COLORS.textSoft, fontSize: 15, fontFamily: body(500), lineHeight: 21, flex: 1 },
  explain: { marginTop: SPACE[4], padding: SPACE[4], backgroundColor: COLORS.infoSoft, borderRadius: RADIUS.sm },
  explainTxt: { fontSize: 14.5, lineHeight: 22, color: COLORS.textSoft },
});
