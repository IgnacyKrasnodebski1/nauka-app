import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { HueProvider } from "@/components/Accent";
import { Button, Empty, TopBar } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { COLORS } from "@/lib/theme";
import { FlashcardsTab } from "@/screens/topic/FlashcardsTab";

/** Fiszki z całego przedmiotu (SRS po wszystkich tematach). */
export default function SubjectCards() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const app = useApp();
  const router = useRouter();
  const subject = app.findSubject(subjectId ?? "");
  const topics = app.topicsOf(subjectId ?? "");
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  if (!subject) return <Empty icon="?" title="Brak przedmiotu" action={<Button label="Wróć" onPress={back} />} />;
  return (
    <HueProvider color={subject.accent2} seed={subject.name}>
      <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
        <TopBar onBack={back} title="Fiszki" subtitle={subject.name} />
        <FlashcardsTab topics={topics} />
      </View>
    </HueProvider>
  );
}
