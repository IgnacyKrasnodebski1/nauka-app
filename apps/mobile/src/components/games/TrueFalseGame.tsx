import type { TrueFalseGame as TrueFalseGameT } from "@nauka/shared";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { haptic } from "@/lib/app-state";
import { C, FONT } from "@/lib/theme";
import { PillButton, Touch } from "../ui";
import { Feedback, GameHead, type GameProps } from "./shared";

/** Prawda / fałsz — dwa duże przyciski. */
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

  return (
    <View>
      <GameHead title={game.title ?? "Prawda czy fałsz? ⚖️"} sub={`${idx + 1}/${game.items.length}`} />
      <Animated.View key={idx} entering={FadeInRight.duration(220)} style={s.stmt}>
        <Text style={s.stmtTxt}>{item.s}</Text>
      </Animated.View>
      <View style={s.row}>
        <Touch onPress={() => pick(false)} disabled={picked !== null} style={[s.btn, s.no, picked !== null && !item.v && s.reveal, picked === false && !ok && s.wrong]}>
          <Text style={[s.btnTxt, { color: "#ff7a99" }]}>FAŁSZ ✖</Text>
        </Touch>
        <Touch onPress={() => pick(true)} disabled={picked !== null} style={[s.btn, s.yes, picked !== null && item.v && s.reveal, picked === true && !ok && s.wrong]}>
          <Text style={[s.btnTxt, { color: "#7dffa6" }]}>PRAWDA ✔</Text>
        </Touch>
      </View>
      {picked !== null ? (
        <>
          <Feedback ok={ok} text={item.e ?? (item.v ? "to prawda" : "to fałsz")} />
          <PillButton label={idx + 1 >= game.items.length ? "dalej 🏁" : "dalej →"} onPress={next} style={{ marginTop: 14 }} />
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  stmt: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 22, minHeight: 130, justifyContent: "center", marginBottom: 14 },
  stmtTxt: { color: C.txt, fontSize: 20, fontWeight: FONT.bold, lineHeight: 28, textAlign: "center" },
  row: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, padding: 18, borderRadius: 16, alignItems: "center", borderWidth: 1 },
  no: { backgroundColor: "#33222e", borderColor: "rgba(255,59,92,.25)" },
  yes: { backgroundColor: "#16331f", borderColor: "rgba(30,215,96,.25)" },
  reveal: { borderColor: C.green, borderWidth: 2 },
  wrong: { borderColor: C.red, borderWidth: 2, opacity: 0.7 },
  btnTxt: { fontSize: 16, fontWeight: FONT.black },
});
