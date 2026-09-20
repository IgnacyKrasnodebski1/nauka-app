import type { Topic } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { HueProvider } from "@/components/Accent";
import { Icon, type IoniconName } from "@/components/Icon";
import { GemsPill, HeartsPill, StreakPill } from "@/components/Pills";
import { Muted } from "@/components/Text";
import { Button, Empty, Loading, TopBar, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { COLORS, PLAY, RADIUS, SPACE, UI, hueFrom } from "@/lib/theme";
import { ExamTab } from "@/screens/topic/ExamTab";
import { FlashcardsTab } from "@/screens/topic/FlashcardsTab";
import { InfoTab } from "@/screens/topic/InfoTab";
import { PathTab } from "@/screens/topic/PathTab";
import { QuizTab } from "@/screens/topic/QuizTab";

type Tab = "path" | "cards" | "quiz" | "exam" | "info";
const TABS: { id: Tab; label: string; icon: IoniconName }[] = [
  { id: "path", label: "Ścieżka", icon: "map" },
  { id: "cards", label: "Fiszki", icon: "layers" },
  { id: "quiz", label: "Quiz", icon: "help-circle" },
  { id: "exam", label: "Egzamin", icon: "school" },
  { id: "info", label: "Info", icon: "information-circle" },
];

/** Temat: Ścieżka / Fiszki / Quiz / Egzamin / Info (zakładki segmentowe z ikonami). */
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
  const hue = hueFrom(subject?.accent2 ?? topic.accent2, subject?.name ?? topic.name);
  return (
    <HueProvider color={hue.color}>
      <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
        <TopBar
          onBack={back}
          title={topic.name}
          subtitle={subject?.name}
          right={
            <>
              <StreakPill streak={app.streak} compact />
              <GemsPill gems={app.gems} compact />
              <HeartsPill hearts={app.hearts} compact />
            </>
          }
        />
        <View style={s.seg}>
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <Touch key={t.id} onPress={() => setTab(t.id)} style={[s.segItem, on && { backgroundColor: hue.color, borderBottomColor: hue.deep }]} accessibilityLabel={t.label}>
                <Icon name={t.icon} size={16} color={on ? "#fff" : COLORS.muted} />
                <Muted size="xs" weight={700} color={on ? "#fff" : COLORS.muted} numberOfLines={1} style={{ fontSize: 10 }}>
                  {t.label}
                </Muted>
              </Touch>
            );
          })}
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
  seg: { flexDirection: "row", gap: 4, marginHorizontal: UI.gutter, marginBottom: SPACE[3], padding: 4, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.md },
  segItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 7, borderRadius: RADIUS.sm, borderBottomWidth: 3, borderBottomColor: "transparent" },
  _p: { color: PLAY.green },
});
