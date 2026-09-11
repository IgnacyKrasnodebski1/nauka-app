import type { Topic } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Glow, HueProvider } from "@/components/Accent";
import { Button, Chip, Empty, Loading, StatPill, TopBar } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { COLORS, SPACE, UI } from "@/lib/theme";
import { ExamTab } from "@/screens/topic/ExamTab";
import { FlashcardsTab } from "@/screens/topic/FlashcardsTab";
import { InfoTab } from "@/screens/topic/InfoTab";
import { PathTab } from "@/screens/topic/PathTab";
import { QuizTab } from "@/screens/topic/QuizTab";

type Tab = "path" | "cards" | "quiz" | "exam" | "info";
const TABS: { id: Tab; label: string }[] = [
  { id: "path", label: "Ścieżka" },
  { id: "cards", label: "Fiszki" },
  { id: "quiz", label: "Quiz" },
  { id: "exam", label: "Egzamin" },
  { id: "info", label: "Info" },
];

/** Temat: Ścieżka / Fiszki / Quiz / Egzamin / Info. */
export default function TopicScreen() {
  const { topicId, tab: initialTab } = useLocalSearchParams<{ topicId: string; tab?: Tab }>();
  const app = useApp();
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>(initialTab ?? "path");

  useEffect(() => {
    let alive = true;
    if (!topicId || !app.ready) return;
    app.getTopic(topicId).then((t) => alive && setTopic(t));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, app.ready, app.topics.length]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  if (topic === undefined) return <Loading label="wczytuję temat…" />;
  if (!topic)
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
        <TopBar title="Temat" onBack={back} />
        <Empty icon="?" title="Nie znalazłem tego tematu" text="Może został usunięty albo jesteś offline i nie ma go w cache." action={<Button label="Wróć" onPress={back} />} />
      </View>
    );

  const subject = app.findSubject(topic.subjectId);
  const p = app.progressFor(topic.id);
  return (
    <HueProvider color={subject?.accent2 ?? topic.accent2} seed={subject?.name ?? topic.name}>
      <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
        <Glow size={420} alpha={0.12} style={{ top: -230, alignSelf: "center" }} />
        <TopBar
          onBack={back}
          title={topic.name}
          subtitle={subject?.name}
          right={
            <>
              <StatPill kind="streak" value={app.streak} />
              <StatPill kind="xp" value={p.xp} />
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
          {tab === "path" ? <PathTab topic={topic} /> : null}
          {tab === "cards" ? <FlashcardsTab topics={[topic]} /> : null}
          {tab === "quiz" ? <QuizTab topic={topic} /> : null}
          {tab === "exam" ? <ExamTab topics={[topic]} /> : null}
          {tab === "info" ? <InfoTab topic={topic} /> : null}
        </View>
      </View>
    </HueProvider>
  );
}

const s = StyleSheet.create({
  tabs: { gap: SPACE[2], paddingHorizontal: UI.gutter, paddingVertical: SPACE[1], paddingBottom: SPACE[3] },
});
