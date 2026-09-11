import { CURRICULUM, STAGES, type Stage } from "@nauka/shared";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { C, FONT, R } from "@/lib/theme";
import { Touch } from "./ui";

/** Wybór etapu edukacji (STAGES z shared). */
export function StagePicker({ value, onChange }: { value: Stage | null; onChange: (s: Stage) => void }) {
  return (
    <View style={{ gap: 10 }}>
      {STAGES.map((st) => (
        <Touch key={st.id} onPress={() => onChange(st.id)} style={[s.opt, value === st.id && s.optSel]}>
          <Text style={{ fontSize: 28 }}>{st.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.optTitle}>{st.label}</Text>
            <Text style={s.optHint}>{st.hint}</Text>
          </View>
          {value === st.id ? <Text style={{ color: C.lime, fontSize: 18, fontWeight: FONT.black }}>✓</Text> : null}
        </Touch>
      ))}
    </View>
  );
}

export interface SubjectPick {
  key: string;
  name: string;
  emoji: string;
}

/** Chipsy przedmiotów z CURRICULUM[stage]; `selected` = klucze. `taken` = już istniejące (wyszarzone). */
export function SubjectChips({ stage, selected, taken = [], onToggle }: { stage: Stage; selected: string[]; taken?: string[]; onToggle: (p: SubjectPick) => void }) {
  return (
    <View style={s.chips}>
      {CURRICULUM[stage].map((p) => {
        const on = selected.includes(p.key);
        const has = taken.includes(p.key);
        return (
          <Touch key={p.key} onPress={() => !has && onToggle(p)} disabled={has} style={[s.chip, on && s.chipOn, has && { opacity: 0.4 }]}>
            <Text style={[s.chipTxt, on && { color: "#fff" }]}>
              {p.emoji} {p.name}
              {has ? " ✓" : ""}
            </Text>
          </Touch>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  opt: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border2, borderRadius: R.lg, padding: 16 },
  optSel: { borderColor: C.cyan, backgroundColor: C.selBg },
  optTitle: { color: C.txt, fontSize: 16.5, fontWeight: FONT.black },
  optHint: { color: C.muted, fontSize: 13, marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.pill, backgroundColor: C.faint, borderWidth: 1.5, borderColor: C.border2 },
  chipOn: { backgroundColor: C.purple, borderColor: C.purple },
  chipTxt: { color: C.txt, fontWeight: FONT.bold, fontSize: 14 },
});
