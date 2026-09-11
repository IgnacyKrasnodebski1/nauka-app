import { type Stage } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SubjectChips, type SubjectPick } from "@/components/Onboarding";
import { BackButton, Muted, PillButton } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { C, FONT, R } from "@/lib/theme";

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
      app.showToast("Dodane ✅");
      close();
    } catch (e) {
      app.showToast(e instanceof Error ? e.message : "Nie udało się dodać.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={[s.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BackButton onPress={close} label="✕" />
          <Text style={s.h}>Nowy przedmiot</Text>
        </View>
        <Muted>Wybierz z listy albo wpisz własny.</Muted>
        <SubjectChips stage={stage} selected={picked.map((p) => p.key)} taken={taken} onToggle={toggle} />
        <TextInput value={custom} onChangeText={setCustom} placeholder="własny przedmiot, np. Łacina" placeholderTextColor={C.muted} style={s.input} />
        <PillButton label={busy ? "zapisuję…" : "dodaj ✅"} disabled={busy || (!picked.length && !custom.trim())} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: 20, gap: 14 },
  h: { color: C.txt, fontSize: 22, fontWeight: FONT.black, letterSpacing: -0.4 },
  input: { backgroundColor: "#0e0e1a", borderWidth: 2, borderColor: C.border2, borderRadius: R.md, color: C.txt, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15.5 },
});
