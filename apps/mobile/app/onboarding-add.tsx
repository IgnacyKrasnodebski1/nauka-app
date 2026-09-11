import { type Stage } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SubjectChips, type SubjectPick } from "@/components/Onboarding";
import { Body, Display, Label } from "@/components/Text";
import { BackButton, Button, Input } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { COLORS, SPACE } from "@/lib/theme";

/** „+ przedmiot” z Home: te same chipsy co w onboardingu (już dodane wyszarzone) + własna nazwa. */
export default function AddSubject() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const stage: Stage = app.stage ?? "liceum";
  const [picked, setPicked] = useState<SubjectPick[]>([]);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const taken = app.subjects.map((s) => s.category);

  const toggle = (p: SubjectPick) => setPicked((cur) => (cur.some((x) => x.key === p.key) ? cur.filter((x) => x.key !== p.key) : [...cur, p]));
  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  const save = async () => {
    const list = [...picked];
    if (custom.trim()) list.push({ key: "inne", name: custom.trim(), emoji: "📘" });
    if (!list.length) return;
    setBusy(true);
    try {
      await app.createSubjects(list.map((p) => ({ name: p.name, emoji: p.emoji, category: p.key, stage })));
      app.showToast("Dodane");
      close();
    } catch (e) {
      app.showToast(e instanceof Error ? e.message : "Nie udało się dodać.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
      <ScrollView contentContainerStyle={[s.wrap, { paddingTop: insets.top + SPACE[3], paddingBottom: insets.bottom + SPACE[6] }]} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE[3] }}>
          <BackButton onPress={close} label="✕" />
          <Display size="lg" weight={700}>
            Nowy przedmiot
          </Display>
        </View>
        <Body color={COLORS.muted}>Wybierz z listy albo wpisz własny.</Body>
        <SubjectChips stage={stage} selected={picked.map((p) => p.key)} taken={taken} onToggle={toggle} />
        <Label>własny</Label>
        <Input value={custom} onChangeText={setCustom} placeholder="np. Łacina" />
        <Button label={busy ? "Zapisuję…" : "Dodaj"} disabled={busy || (!picked.length && !custom.trim())} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: SPACE[5], gap: SPACE[4] },
});
