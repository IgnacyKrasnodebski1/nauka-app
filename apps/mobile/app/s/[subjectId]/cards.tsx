import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Empty, PillButton, TopBar } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { C } from "@/lib/theme";
import { FlashcardsTab } from "@/screens/topic/FlashcardsTab";

/** Fiszki z całego przedmiotu (SRS po wszystkich tematach). */
export default function SubjectCards() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const app = useApp();
  const router = useRouter();
  const subject = app.findSubject(subjectId ?? "");
  const topics = app.topicsOf(subjectId ?? "");
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  if (!subject) return <Empty emoji="🫥" title="Brak przedmiotu" action={<PillButton label="wróć" onPress={back} />} />;
  return (
    <AccentProvider accent={subject.accent} accent2={subject.accent2}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <TopBar onBack={back} title={`🎴 ${subject.name}`} />
        <FlashcardsTab topics={topics} />
      </View>
    </AccentProvider>
  );
}
