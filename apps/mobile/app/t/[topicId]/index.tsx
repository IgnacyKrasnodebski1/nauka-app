import type { Topic } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Chip, Empty, Loading, PillButton, StatPill, TopBar } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { C } from "@/lib/theme";
import { ExamTab } from "@/screens/topic/ExamTab";
import { FlashcardsTab } from "@/screens/topic/FlashcardsTab";
import { InfoTab } from "@/screens/topic/InfoTab";
import { PathTab } from "@/screens/topic/PathTab";
import { QuizTab } from "@/screens/topic/QuizTab";

type Tab = "path" | "cards" | "quiz" | "exam" | "info";
const TABS: { id: Tab; label: string }[] = [
  { id: "path", label: "🗺️ Ścieżka" },
  { id: "cards", label: "🎴 Fiszki" },
  { id: "quiz", label: "🧠 Quiz" },
  { id: "exam", label: "🎯 Egzamin" },
  { id: "info", label: "📋 Info" },
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
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <TopBar title="🫥" onBack={back} />
        <Empty emoji="🫥" title="Nie znalazłem tego tematu" text="Może został usunięty albo jesteś offline i nie ma go w cache." action={<PillButton label="wróć" onPress={back} />} />
      </View>
    );

  const subject = app.findSubject(topic.subjectId);
  const p = app.progressFor(topic.id);
  return (
    <AccentProvider accent={subject?.accent ?? topic.accent} accent2={subject?.accent2 ?? topic.accent2}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <TopBar
          onBack={back}
          title={`${topic.emoji} ${topic.short || topic.name}`}
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
          {tab === "path" ? <PathTab topic={topic} /> : null}
          {tab === "cards" ? <FlashcardsTab topics={[topic]} /> : null}
          {tab === "quiz" ? <QuizTab topic={topic} /> : null}
          {tab === "exam" ? <ExamTab topics={[topic]} /> : null}
          {tab === "info" ? <InfoTab topic={topic} /> : null}
        </View>
      </View>
    </AccentProvider>
  );
}

const s = StyleSheet.create({
  tabs: { gap: 7, paddingHorizontal: 16, paddingVertical: 4, paddingBottom: 10 },
});
