import { dayDiff, levelProgress, todayStr, type Topic } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AccentProvider, useAccent } from "@/components/Accent";
import { Icon } from "@/components/Icon";
import { Bar } from "@/components/Motion";
import { PathView } from "@/components/PathView";
import { NoHeartsSheet } from "@/components/Sheets";
import { Body, Display, Muted } from "@/components/Text";
import { QuizTab, TasksTab } from "@/components/TopicTabs";
import { Blob, Btn, Chip, Empty, Loading, Pill, RoundBtn, Screen, Touch, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { inDays } from "@/lib/format";
import { tpTitle } from "@/lib/tests";
import { T, TONES } from "@/lib/theme";
import { isHidden, topicShort, visibleLevels } from "@/lib/topic-view";

type Tab = "path" | "quiz" | "tasks";
const TABS: { id: Tab | "cards" | "exam" | "share"; icon: string; label: string }[] = [
  { id: "path", icon: "map", label: "Ścieżka" },
  { id: "cards", icon: "cards", label: "Fiszki" },
  { id: "quiz", icon: "brain", label: "Quiz" },
  { id: "tasks", icon: "edit", label: "Ćwiczenia" },
  { id: "exam", icon: "target", label: "Egzamin" },
  { id: "share", icon: "share", label: "Klasa" },
];

/** Temat = ścieżka (Path.html): pas z nazwą, paskiem postępu, info i sercami; chipy zakładek; wężyk poziomów, skrzynie, boss. */
export default function TopicScreen() {
  const { topicId, tab, levelId } = useLocalSearchParams<{ topicId: string; tab?: string; levelId?: string }>();
  const app = useApp();
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null | undefined>(app.findTopic(topicId ?? ""));
  useEffect(() => {
    let alive = true;
    if (topicId && app.ready) app.getTopic(topicId).then((t) => alive && setTopic(t));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, app.ready, app.tick]);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  if (topic === undefined) return <Loading label="wczytuję temat…" />;
  if (!topic)
    return (
      <Screen>
        <Empty icon="alert" title="Nie ma takiego tematu" action={<Btn label="Wróć" onPress={back} />} />
      </Screen>
    );
  const subject = app.findSubject(topic.subjectId);
  return (
    <AccentProvider color={subject?.accent2 ?? topic.accent2} seed={subject?.name ?? topic.name}>
      <TopicBody topic={topic} initialTab={tab === "quiz" || tab === "tasks" ? tab : "path"} levelId={levelId} onBack={back} />
    </AccentProvider>
  );
}

function TopicBody({ topic, initialTab, levelId, onBack }: { topic: Topic; initialTab: Tab; levelId?: string; onBack: () => void }) {
  const app = useApp();
  const router = useRouter();
  const acc = useAccent();
  const top = useTop();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [noHearts, setNoHearts] = useState<{ levelId?: string; boss?: boolean } | null>(null);
  const subject = app.findSubject(topic.subjectId);
  const progress = app.progressFor(topic.id);
  const levels = visibleLevels(topic, app.extra.overrides);
  const done = levels.filter((l) => levelProgress(progress, l.id).done).length;
  const test = subject ? app.testFor(subject.id) : null;
  const today = todayStr();
  const N = test ? dayDiff(today, test.date) : null;
  const row = test?.plan.find((r) => r.date === today);
  const go = (id: (typeof TABS)[number]["id"]) => {
    if (id === "cards") return router.push({ pathname: "/s/[subjectId]/cards", params: { subjectId: topic.subjectId, topicId: topic.id } });
    if (id === "exam") return router.push({ pathname: "/s/[subjectId]/exam", params: { subjectId: topic.subjectId, topicId: topic.id } });
    if (id === "share") return router.push({ pathname: "/share", params: { subjectId: topic.subjectId } });
    setTab(id);
  };
  const startLevel = (lid: string) => {
    if (!app.canStartLesson) return setNoHearts({ levelId: lid });
    router.push({ pathname: "/t/[topicId]/l/[levelId]", params: { topicId: topic.id, levelId: lid } });
  };
  return (
    <Screen pad={false} blob={<Blob tone="mid" size={300} top={210} center />}>
      <View style={[s.band, { paddingTop: top }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <RoundBtn icon="back" onPress={onBack} label="Wróć do przedmiotów" size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Display size={19} ls={-0.4} numberOfLines={1}>
              {topicShort(topic)}
            </Display>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 7 }}>
              <Bar pct={levels.length ? (done / levels.length) * 100 : 0} color={acc.color} style={{ flex: 1 }} />
              <Body size={11.5} weight={800} color={acc.sub}>
                {done}/{levels.length}
              </Body>
            </View>
          </View>
          <RoundBtn icon="info" onPress={() => router.push({ pathname: "/s/[subjectId]/info", params: { subjectId: topic.subjectId, topicId: topic.id } })} label="Zasady zaliczenia" />
          <Pill kind="hearts" value={app.hearts.unlimited ? "∞" : app.hearts.hearts} beat />
        </View>
        {test && N != null && N >= 0 ? (
          <Touch onPress={() => router.push({ pathname: "/test-plan", params: { subjectId: topic.subjectId } })} accessibilityRole="button" style={s.testChip}>
            <Icon name="calendar" size={15} stroke={2.6} color={TONES.red.txt} />
            <Body size={12.5} weight={800} color={TONES.red.txt}>
              Sprawdzian {inDays(N)}
            </Body>
            <Muted size={11.5} color={TONES.red.sub} style={{ flex: 1 }} numberOfLines={1}>
              {N > 0 && row ? `· dziś: ${tpTitle(row, app.topicsOf(topic.subjectId)).toLowerCase()}${row.done ? " (zrobione)" : ""}` : ""}
            </Muted>
            <Icon name="chevron-right" size={16} color={TONES.red.sub} />
          </Touch>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingHorizontal: 18 }} style={{ marginHorizontal: -18 }}>
          {TABS.map((t) => (
            <Chip key={t.id} label={t.label} icon={t.icon} active={tab === t.id} onPress={() => go(t.id)} />
          ))}
        </ScrollView>
      </View>
      {tab === "path" ? (
        <PathView
          topic={topic}
          progress={progress}
          hidden={(lid) => isHidden(app.extra.overrides, topic.id, lid)}
          onLevel={(lid, unlocked) => (unlocked ? startLevel(lid) : app.showToast("Najpierw zalicz poprzedni poziom", "lock"))}
          onChest={(after, openable, opened) => {
            if (opened) return app.showToast("Skrzynia już otwarta", "chest");
            if (!openable) return app.showToast(`Skrzynia otworzy się po zaliczeniu poziomu ${after + 1}`, "lock");
            const g = app.openChest(topic.id, after);
            if (g) app.showToast(`Skrzynia: +${g} gemów`, "gem");
          }}
          onBoss={(state) => {
            if (state === "locked") return app.showToast("Boss czeka, aż zaliczysz wszystkie poziomy", "lock");
            if (!app.canStartLesson) return setNoHearts({ boss: true });
            router.push({ pathname: "/t/[topicId]/boss", params: { topicId: topic.id } });
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {tab === "quiz" ? <QuizTab key={topic.id} topic={topic} levelId={levelId} /> : <TasksTab key={topic.id} topic={topic} />}
        </ScrollView>
      )}
      <NoHeartsSheet open={!!noHearts} onLeave={() => setNoHearts(null)} onResume={() => { const n = noHearts; setNoHearts(null); if (n?.levelId) startLevel(n.levelId); else if (n?.boss) router.push({ pathname: "/t/[topicId]/boss", params: { topicId: topic.id } }); }} onCards={() => router.push({ pathname: "/s/[subjectId]/cards", params: { subjectId: topic.subjectId, topicId: topic.id, heal: "1" } })} />
      {!levels.length ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Empty icon="info" title="Brak poziomów" text={`Wszystkie poziomy są wyłączone. Włącz je w ustawieniach tematu.`} />
        </View>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  band: { paddingHorizontal: 18, paddingBottom: 12, backgroundColor: T.surface2, borderBottomWidth: 2, borderBottomColor: T.line, gap: 12 },
  testChip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: TONES.red.tint, borderWidth: 2, borderColor: TONES.red.tintLine, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 },
});
