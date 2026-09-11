import { CURRICULUM, type Stage } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glow } from "@/components/Accent";
import { StagePicker, SubjectChips, type SubjectPick } from "@/components/Onboarding";
import { Body, Display, Label, Muted } from "@/components/Text";
import { Button, Input, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { COLORS, SPACE } from "@/lib/theme";

/** Pierwsze uruchomienie po logowaniu: etap → przedmioty (CURRICULUM + własne) → insert `subjects`, `profiles.stage`. */
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
      app.showToast("Przedmioty gotowe");
      router.replace("/(tabs)");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Nie udało się zapisać przedmiotów.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
      <Glow color={COLORS.accent} size={380} alpha={0.1} style={{ top: -160, right: -120 }} />
      <ScrollView contentContainerStyle={[s.wrap, { paddingTop: insets.top + SPACE[8], paddingBottom: insets.bottom + SPACE[6] }]} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <>
            <Label>krok 1 z 2</Label>
            <Display size="2xl" weight={700}>
              Na jakim etapie jesteś?
            </Display>
            <Body color={COLORS.muted}>Dopasujemy przedmioty, poziom trudności i siatkę ocen. Zmienisz to potem w profilu.</Body>
            <StagePicker value={stage} onChange={setStage} />
            <Button label="Dalej" disabled={!stage} onPress={() => setStep(2)} style={{ marginTop: SPACE[2] }} />
          </>
        ) : stage ? (
          <>
            <Touch onPress={() => setStep(1)} style={{ alignSelf: "flex-start" }}>
              <Muted size="xs" weight={600}>
                ‹ etap
              </Muted>
            </Touch>
            <Label>krok 2 z 2</Label>
            <Display size="2xl" weight={700}>
              Z czego się uczysz?
            </Display>
            <Body color={COLORS.muted}>Wybierz przedmioty — do każdego dodasz potem tematy ze zdjęć, PDF-a albo z samego hasła.</Body>
            <SubjectChips stage={stage} selected={picked.map((p) => p.key)} onToggle={toggle} />
            <View style={s.customRow}>
              <Input value={custom} onChangeText={setCustom} placeholder="Własny przedmiot, np. Łacina" onSubmitEditing={addCustom} returnKeyType="done" style={{ flex: 1 }} />
              <Button label="Dodaj" small variant="secondary" onPress={addCustom} disabled={!custom.trim()} />
            </View>
            {picked.filter((p) => p.key.startsWith("custom:")).length ? <Muted size="xs">własne: {picked.filter((p) => p.key.startsWith("custom:")).map((p) => p.name).join(", ")}</Muted> : null}
            {err ? (
              <Body size="sm" color={COLORS.danger}>
                {err}
              </Body>
            ) : null}
            <Button label={busy ? "Zapisuję…" : picked.length ? `Zaczynamy z ${picked.length} ${picked.length === 1 ? "przedmiotem" : "przedmiotami"}` : "Wybierz min. 1 przedmiot"} disabled={!picked.length || busy} onPress={finish} style={{ marginTop: SPACE[2] }} />
            <Muted size="xs" center>
              {CURRICULUM[stage].length} propozycji z podstawy programowej · kolejne dodasz później
            </Muted>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: SPACE[6], gap: SPACE[4] },
  customRow: { flexDirection: "row", gap: SPACE[2], alignItems: "center" },
});
