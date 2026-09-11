import type { TrueFalseGame as TrueFalseGameT } from "@nauka/shared";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { haptic } from "@/lib/app-state";
import { COLORS, RADIUS, SPACE, body, display } from "@/lib/theme";
import { Button, Touch } from "../ui";
import { Feedback, GameHead, type GameProps } from "./shared";

/** Prawda / fałsz — dwa przyciski na bg3; po odpowiedzi poprawny = success ring, błędny = danger. */
export function TrueFalseGame({ game, onDone }: GameProps<TrueFalseGameT>) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const item = game.items[idx]!;
  const ok = picked === item.v;

  const pick = (v: boolean) => {
    if (picked !== null) return;
    setPicked(v);
    if (v === item.v) {
      haptic.ok();
      setScore((x) => x + 1);
    } else haptic.bad();
  };
  const next = () => {
    if (idx + 1 >= game.items.length) return onDone(score, game.items.length);
    setIdx(idx + 1);
    setPicked(null);
  };

  const btn = (v: boolean, label: string) => {
    const revealOk = picked !== null && item.v === v;
    const revealBad = picked === v && !ok;
    return (
      <Touch onPress={() => pick(v)} disabled={picked !== null} style={[s.btn, revealOk && s.ok, revealBad && s.bad]}>
        <Text style={[s.btnTxt, revealOk && { color: COLORS.success }, revealBad && { color: COLORS.danger }]}>{label}</Text>
      </Touch>
    );
  };

  return (
    <View>
      <GameHead title={game.title ?? "Prawda czy fałsz"} sub={`${idx + 1}/${game.items.length}`} />
      <Animated.View key={idx} entering={FadeInRight.duration(220)} style={s.stmt}>
        <Text style={s.stmtTxt}>{item.s}</Text>
      </Animated.View>
      <View style={s.row}>
        {btn(false, "Fałsz")}
        {btn(true, "Prawda")}
      </View>
      {picked !== null ? (
        <>
          <Feedback ok={ok} text={item.e ?? (item.v ? "to prawda" : "to fałsz")} />
          <Button label={idx + 1 >= game.items.length ? "Dalej" : "Następne"} onPress={next} style={{ marginTop: SPACE[4] }} />
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  stmt: { backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.md, padding: SPACE[5], minHeight: 120, justifyContent: "center", marginBottom: SPACE[3] },
  stmtTxt: { color: COLORS.text, fontSize: 19, fontFamily: display(600), lineHeight: 27, textAlign: "center" },
  row: { flexDirection: "row", gap: SPACE[2] },
  btn: { flex: 1, height: 52, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.bg3 },
  ok: { borderColor: COLORS.success, backgroundColor: COLORS.successSoft },
  bad: { borderColor: COLORS.danger, backgroundColor: COLORS.dangerSoft },
  btnTxt: { fontSize: 15.5, fontFamily: body(700), color: COLORS.text },
});
