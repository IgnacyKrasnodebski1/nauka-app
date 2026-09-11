import type { QuizQuestion } from "@nauka/shared";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { KEYS_ABC } from "@/lib/games";
import { C, FONT, R } from "@/lib/theme";
import { HtmlText } from "./HtmlText";
import { Tag, Touch } from "./ui";

/**
 * Pytanie A/B/C/D. `picked` = wybrana odpowiedź (null = brak), `reveal` = pokaż poprawną + wyjaśnienie.
 * W egzaminie reveal=false i można zmieniać wybór.
 */
export function QuizCard({ q, picked, reveal, onPick, tag, children }: { q: QuizQuestion; picked: number | null; reveal: boolean; onPick: (i: number) => void; tag?: string; children?: React.ReactNode }) {
  return (
    <View style={s.card}>
      {tag ? <Tag>{tag}</Tag> : null}
      <Text style={s.q}>{q.q}</Text>
      <View style={s.opts}>
        {q.a.map((opt, i) => {
          const correct = reveal && i === q.c;
          const wrong = reveal && picked === i && i !== q.c;
          const sel = !reveal && picked === i;
          const dim = reveal && !correct && !wrong;
          return (
            <Touch key={i} onPress={() => onPick(i)} disabled={reveal} style={[s.opt, sel && s.optSel, correct && s.optOk, wrong && s.optBad, dim && { opacity: 0.45 }]}>
              <Text style={[s.k, correct && { color: C.green }, wrong && { color: C.red }]}>{KEYS_ABC[i] ?? String(i + 1)}</Text>
              <Text style={[s.optTxt, correct && { color: C.okTxt }, wrong && { color: C.badTxt }]}>{opt}</Text>
            </Touch>
          );
        })}
      </View>
      {reveal && q.e ? (
        <Animated.View entering={FadeInDown.duration(250)} style={s.explain}>
          <Text style={s.why}>czemu: </Text>
          <HtmlText html={q.e} inline textStyle={s.explainTxt} boldColor={C.lime} />
        </Animated.View>
      ) : null}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 24, padding: 20 },
  q: { color: C.txt, fontSize: 20, fontWeight: FONT.black, lineHeight: 25, letterSpacing: -0.3, marginTop: 6, marginBottom: 18 },
  opts: { gap: 11 },
  opt: { flexDirection: "row", gap: 12, alignItems: "flex-start", padding: 15, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1.5, borderColor: C.border2 },
  optSel: { backgroundColor: C.selBg, borderColor: C.purple },
  optOk: { backgroundColor: C.okBg, borderColor: C.green },
  optBad: { backgroundColor: C.badBg, borderColor: C.red },
  k: { color: C.purple, fontWeight: FONT.black, fontSize: 15 },
  optTxt: { color: C.txt, fontSize: 15.5, fontWeight: FONT.semi, lineHeight: 21, flex: 1 },
  explain: { marginTop: 16, padding: 14, paddingHorizontal: 16, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: R.md },
  why: { color: C.lime, fontWeight: FONT.bold, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  explainTxt: { fontSize: 14.5, lineHeight: 21, color: "#e3e3f2" },
});
