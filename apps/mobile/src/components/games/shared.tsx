import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { C, FONT } from "@/lib/theme";

export interface GameProps<G> {
  game: G;
  /** wynik: ile trafionych z ilu (wywołane raz, po skończeniu gry) */
  onDone(correct: number, total: number): void;
}

export function GameHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={g.prompt}>{title}</Text>
      {sub ? <Text style={g.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Feedback({ ok, text }: { ok: boolean; text?: string }) {
  return (
    <View style={[g.fb, ok ? g.fbOk : g.fbBad]}>
      <Text style={[g.fbTxt, { color: ok ? C.okTxt : C.badTxt }]}>
        {ok ? "GIT 🟢" : "mid 👇"}
        {text ? ` — ${text}` : ""}
      </Text>
    </View>
  );
}

export const g = StyleSheet.create({
  prompt: { color: C.muted, fontSize: 13, fontWeight: FONT.bold, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  sub: { color: C.txt, fontSize: 21, fontWeight: FONT.black, letterSpacing: -0.4, lineHeight: 26 },
  tile: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1.5, borderColor: C.border2, minHeight: 48, justifyContent: "center" },
  tileTxt: { color: C.txt, fontSize: 14.5, fontWeight: FONT.bold, lineHeight: 19 },
  tileSel: { borderColor: C.cyan, backgroundColor: C.selBg },
  tileOk: { borderColor: C.green, backgroundColor: C.okBg, opacity: 0.55 },
  tileBad: { borderColor: C.red, backgroundColor: C.badBg },
  fb: { marginTop: 14, padding: 13, paddingHorizontal: 15, borderRadius: 13 },
  fbOk: { backgroundColor: C.okBg },
  fbBad: { backgroundColor: C.badBg },
  fbTxt: { fontSize: 15, lineHeight: 21, fontWeight: FONT.semi },
});
