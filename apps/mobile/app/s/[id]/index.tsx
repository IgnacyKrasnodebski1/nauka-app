import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Chip, Empty, Loading, PillButton, StatPill, TopBar } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import type { AppSubject } from "@/lib/subjects";
import { C } from "@/lib/theme";
import { ExamTab } from "@/screens/subject/ExamTab";
import { FlashcardsTab } from "@/screens/subject/FlashcardsTab";
import { InfoTab } from "@/screens/subject/InfoTab";
import { PathTab } from "@/screens/subject/PathTab";
import { QuizTab } from "@/screens/subject/QuizTab";

type Tab = "path" | "cards" | "quiz" | "exam" | "info";
const TABS: { id: Tab; label: string }[] = [
  { id: "path", label: "🗺️ Ścieżka" },
  { id: "cards", label: "🎴 Fiszki" },
  { id: "quiz", label: "🧠 Quiz" },
  { id: "exam", label: "🎯 Egzamin" },
  { id: "info", label: "📋 Info" },
];

export default function SubjectScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: Tab }>();
  const app = useApp();
  const router = useRouter();
  const [subject, setSubject] = useState<AppSubject | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>(initialTab ?? "path");

  useEffect(() => {
    let alive = true;
    if (!id) return;
    app.getSubject(id).then((s) => alive && setSubject(s));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, app.subjects.length]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  if (subject === undefined) return <Loading label="wczytuję przedmiot…" />;
  if (!subject)
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <TopBar title="🫥" onBack={back} />
        <Empty emoji="🫥" title="Nie znalazłem tego przedmiotu" text="Może został usunięty albo jesteś offline i nie ma go w cache." action={<PillButton label="wróć" onPress={back} />} />
      </View>
    );

  const p = app.progressFor(subject);
  return (
    <AccentProvider accent={subject.accent} accent2={subject.accent2}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <TopBar
          onBack={back}
          title={`${subject.emoji} ${subject.short || subject.name}`}
          right={
            <>
              <StatPill icon="🔥" value={app.streak} unit="dni" />
              <StatPill icon="⚡" value={p.xp} unit="xp" />
            </>
          }
        />
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
            {TABS.map((t) => (
              <Chip key={t.id} label={t.label} active={tab === t.id} onPress={() => setTab(t.id)} />
            ))}
          </ScrollView>
        </View>
        <View style={{ flex: 1 }}>
          {tab === "path" ? <PathTab subject={subject} /> : null}
          {tab === "cards" ? <FlashcardsTab subject={subject} /> : null}
          {tab === "quiz" ? <QuizTab subject={subject} /> : null}
          {tab === "exam" ? <ExamTab subject={subject} /> : null}
          {tab === "info" ? <InfoTab subject={subject} /> : null}
        </View>
      </View>
    </AccentProvider>
  );
}

const s = StyleSheet.create({
  tabs: { gap: 7, paddingHorizontal: 16, paddingVertical: 4, paddingBottom: 10 },
});
