import { CURRICULUM, type Stage } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StagePicker, SubjectChips, type SubjectPick } from "@/components/Onboarding";
import { Muted, PillButton, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { C, FONT, R } from "@/lib/theme";

/** Pierwsze uruchomienie po logowaniu: etap → przedmioty (chipsy z CURRICULUM + własne) → insert `subjects`, `profiles.stage`. */
export default function Onboarding() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<1 | 2>(app.stage ? 2 : 1);
  const [stage, setStage] = useState<Stage | null>(app.stage);
  const [picked, setPicked] = useState<SubjectPick[]>([]);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (p: SubjectPick) => setPicked((cur) => (cur.some((x) => x.key === p.key) ? cur.filter((x) => x.key !== p.key) : [...cur, p]));
  const addCustom = () => {
    const name = custom.trim();
    if (!name) return;
    const key = `custom:${name.toLowerCase().replace(/\s+/g, "-")}`;
    if (!picked.some((x) => x.key === key)) setPicked([...picked, { key, name, emoji: "📘" }]);
    setCustom("");
  };

  const finish = async () => {
    if (!stage || !picked.length) return;
    setBusy(true);
    setErr(null);
    try {
      app.setStage(stage);
      await app.createSubjects(picked.map((p) => ({ name: p.name, emoji: p.emoji, category: p.key.startsWith("custom:") ? "inne" : p.key, stage })));
      app.showToast("Git, przedmioty gotowe 🎯");
      router.replace("/(tabs)");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Nie udało się zapisać przedmiotów.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={[s.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <>
            <Text style={{ fontSize: 48 }}>🎒</Text>
            <Text style={s.h}>Siema! Na jakim etapie jesteś?</Text>
            <Muted>Dopasujemy przedmioty, poziom trudności i siatkę ocen. Zmienisz to potem w profilu.</Muted>
            <StagePicker value={stage} onChange={setStage} />
            <PillButton label="dalej →" disabled={!stage} onPress={() => setStep(2)} style={{ marginTop: 8 }} />
          </>
        ) : stage ? (
          <>
            <Touch onPress={() => setStep(1)} style={{ alignSelf: "flex-start" }}>
              <Text style={s.back}>‹ etap</Text>
            </Touch>
            <Text style={{ fontSize: 48 }}>📚</Text>
            <Text style={s.h}>Z czego się uczysz?</Text>
            <Muted>Wybierz przedmioty — do każdego dodasz potem tematy (ze zdjęć, PDF albo z samego hasła).</Muted>
            <SubjectChips stage={stage} selected={picked.map((p) => p.key)} onToggle={toggle} />
            <View style={s.customRow}>
              <TextInput value={custom} onChangeText={setCustom} placeholder="własny przedmiot, np. Łacina" placeholderTextColor={C.muted} style={s.input} onSubmitEditing={addCustom} returnKeyType="done" />
              <PillButton label="+" small ghost onPress={addCustom} disabled={!custom.trim()} style={{ width: 56 }} />
            </View>
            {picked.filter((p) => p.key.startsWith("custom:")).length ? (
              <Text style={s.customList}>własne: {picked.filter((p) => p.key.startsWith("custom:")).map((p) => p.name).join(", ")}</Text>
            ) : null}
            {err ? <Text style={s.err}>{err}</Text> : null}
            <PillButton label={busy ? "zapisuję…" : picked.length ? `lecimy z ${picked.length} ${picked.length === 1 ? "przedmiotem" : "przedmiotami"} 🚀` : "wybierz min. 1 przedmiot"} disabled={!picked.length || busy} onPress={finish} style={{ marginTop: 8 }} />
            <Muted style={{ fontSize: 12, textAlign: "center" }}>{CURRICULUM[stage].length} propozycji z podstawy programowej · kolejne dodasz później</Muted>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: 20, gap: 12 },
  h: { color: C.txt, fontSize: 26, fontWeight: FONT.black, letterSpacing: -0.5, lineHeight: 30 },
  back: { color: C.muted, fontWeight: FONT.bold, fontSize: 14 },
  customRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, backgroundColor: "#0e0e1a", borderWidth: 2, borderColor: C.border2, borderRadius: R.md, color: C.txt, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15.5 },
  customList: { color: C.muted, fontSize: 13, fontWeight: FONT.semi },
  err: { color: "#ff8aa3", fontSize: 13.5, fontWeight: FONT.semi },
});
