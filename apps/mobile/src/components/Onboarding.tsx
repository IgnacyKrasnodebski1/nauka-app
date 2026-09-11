import { STAGES, type Stage } from "@nauka/shared";
import React, { useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, FONT, R } from "@/lib/theme";
import { PillButton, Touch } from "./ui";

/** Modal pierwszego uruchomienia: wybór etapu edukacji (STAGES z shared). */
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

export function OnboardingModal({ open, initial, onDone }: { open: boolean; initial: Stage | null; onDone: (s: Stage) => void }) {
  const [stage, setStage] = useState<Stage | null>(initial);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => stage && onDone(stage)}>
      <View style={[s.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
        <Text style={{ fontSize: 48 }}>📚</Text>
        <Text style={s.h}>Siema! Na jakim etapie jesteś?</Text>
        <Text style={s.p}>Dopasujemy poziom trudności, styl tłumaczeń i siatkę ocen. Zmienisz to potem w profilu.</Text>
        <StagePicker value={stage} onChange={setStage} />
        <View style={{ flex: 1 }} />
        <PillButton label="lecimy 🚀" disabled={!stage} onPress={() => stage && onDone(stage)} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20, gap: 12 },
  h: { color: C.txt, fontSize: 26, fontWeight: FONT.black, letterSpacing: -0.5, lineHeight: 30 },
  p: { color: C.muted, fontSize: 15, lineHeight: 21, marginBottom: 6 },
  opt: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border2, borderRadius: R.lg, padding: 16 },
  optSel: { borderColor: C.cyan, backgroundColor: C.selBg },
  optTitle: { color: C.txt, fontSize: 16.5, fontWeight: FONT.black },
  optHint: { color: C.muted, fontSize: 13, marginTop: 2 },
});
