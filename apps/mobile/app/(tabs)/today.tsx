import { XP, newCard, review, type SessionItem, type SrsGrade } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glow, HueProvider } from "@/components/Accent";
import { Flashcard } from "@/components/Flashcard";
import { QuizCard } from "@/components/QuizCard";
import { ResultView } from "@/components/ResultView";
import { Body, Display, Label, Muted, Title } from "@/components/Text";
import { BackButton, Button, Empty, IconTile, MiniPill, ProgressBar, StatPill, TopBar, Touch } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { minutesSince } from "@/lib/games";
import { dni } from "@/lib/plural";
import { COLORS, RADIUS, SPACE, UI, hueFrom, shadowCard, tabular } from "@/lib/theme";
import { GradeRow, gr } from "@/screens/topic/FlashcardsTab";

type Phase = "intro" | "run" | "done";

/** „Dziś” — dzienna sesja z shared `buildDailySession`: powtórki (SRS 0–3), słabe pytania (weak), nowy poziom. */
export default function Today() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("intro");
  const [items, setItems] = useState<SessionItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [xp, setXp] = useState(0);
  const [stats, setStats] = useState({ reviewed: 0, weakOk: 0, weakBad: 0 });
  const startedAt = useRef(0);
  const d = app.daily;
  const sessionTopic = d.newLevel ? app.findTopic(d.newLevel.topicId) : app.topics[0];
  const sessionSubject = app.findSubject(sessionTopic?.subjectId ?? "");
  const hue = hueFrom(sessionSubject?.accent2, sessionSubject?.name);

  const start = () => {
    setItems(d.items);
    setIdx(0);
    setXp(0);
    setStats({ reviewed: 0, weakOk: 0, weakBad: 0 });
    setFlipped(false);
    setPicked(null);
    startedAt.current = Date.now();
    setPhase(d.items.length ? "run" : "intro");
  };

  const item = items[idx];
  const topic = useMemo(() => (item ? app.findTopic(item.topicId) : undefined), [item, app]);
  const itemSubject = app.findSubject(topic?.subjectId ?? "");

  const advance = () => {
    setFlipped(false);
    setPicked(null);
    if (idx + 1 < items.length) setIdx(idx + 1);
    else finish();
  };

  const finish = () => {
    app.logActivity(xp, minutesSince(startedAt.current));
    haptic.heavy();
    setPhase("done");
  };

  const gradeCard = (g: SrsGrade) => {
    if (!item?.card) return;
    const srs = app.srsFor(item.topicId);
    app.setSrsFor(item.topicId, { ...srs, [item.card.key]: review(srs[item.card.key] ?? newCard(), g) });
    if (g >= 2) {
      app.addXp(item.topicId, XP.flashcardKnown);
      setXp((x) => x + XP.flashcardKnown);
      haptic.ok();
    } else haptic.tap();
    setStats((s) => ({ ...s, reviewed: s.reviewed + 1 }));
    advance();
  };

  const answerWeak = (i: number) => {
    if (!item?.question || picked !== null) return;
    setPicked(i);
    const q = item.question;
    const lvl = topic?.levels.find((l) => l.id === q.levelId);
    const qi = lvl?.quiz.findIndex((x) => x.q === q.q) ?? -1;
    const ok = i === q.c;
    if (qi >= 0) app.setWeak(item.topicId, q.levelId, ok ? [] : [qi], ok ? [qi] : []);
    if (ok) {
      app.addXp(item.topicId, XP.quizCorrect);
      setXp((x) => x + XP.quizCorrect);
      haptic.ok();
      setStats((s) => ({ ...s, weakOk: s.weakOk + 1 }));
    } else {
      haptic.bad();
      setStats((s) => ({ ...s, weakBad: s.weakBad + 1 }));
    }
  };

  const openLevel = () => {
    if (!item?.levelId) return;
    finish();
    router.push({ pathname: "/t/[topicId]/l/[levelId]", params: { topicId: item.topicId, levelId: item.levelId } });
  };

  const head = (
    <TopBar
      title="Dziś"
      right={
        <>
          <StatPill kind="streak" value={app.streak} unit={dni(app.streak)} />
          <StatPill kind="xp" value={app.totalXp} unit="xp" />
        </>
      }
    />
  );

  if (phase === "run" && item) {
    const pct = (idx / items.length) * 100;
    const kindLabel = item.kind === "review" ? "powtórka" : item.kind === "weak" ? "słabe pytanie" : "nowy poziom";
    return (
      <HueProvider color={itemSubject?.accent2} seed={itemSubject?.name}>
        <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
          <View style={[s.runHead, { paddingTop: insets.top + SPACE[2] }]}>
            <BackButton onPress={() => setPhase("intro")} label="✕" />
            <View style={{ flex: 1, gap: 6 }}>
              <ProgressBar pct={pct} />
              <Label numberOfLines={1}>
                {kindLabel} · {idx + 1}/{items.length} · {topic?.name ?? ""}
              </Label>
            </View>
            <Display size="base" weight={700} color={COLORS.accent} style={tabular}>
              +{xp}
            </Display>
          </View>
          <View style={s.body}>
            {item.kind === "review" && item.card ? (
              <Animated.View key={`r${idx}`} entering={FadeInRight.duration(200)} style={{ flex: 1 }}>
                <Flashcard term={item.card.t} def={item.card.d} tag={topic?.name} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
                {flipped ? (
                  <GradeRow onGrade={gradeCard} />
                ) : (
                  <Touch onPress={() => setFlipped(true)} style={gr.show}>
                    <Body weight={700} color={COLORS.text}>
                      Pokaż odpowiedź
                    </Body>
                  </Touch>
                )}
              </Animated.View>
            ) : null}
            {item.kind === "weak" && item.question ? (
              <ScrollView key={`w${idx}`} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeInRight.duration(200)}>
                  <QuizCard q={item.question} picked={picked} reveal={picked !== null} onPick={answerWeak} tag={`ostatnio nie poszło · ${topic?.name ?? ""}`}>
                    {picked !== null ? <Button label="Dalej" onPress={advance} style={{ marginTop: SPACE[4] }} /> : null}
                  </QuizCard>
                </Animated.View>
              </ScrollView>
            ) : null}
            {item.kind === "new" && item.levelId ? (
              <Animated.View key={`n${idx}`} entering={FadeInRight.duration(200)} style={s.newCard}>
                <View style={s.hl} />
                <IconTile emoji={topic?.emoji ?? "•"} size={64} />
                <Label style={{ marginTop: SPACE[2] }}>nowy poziom</Label>
                <Display size="xl" weight={700} center>
                  {topic?.levels.find((l) => l.id === item.levelId)?.title}
                </Display>
                <Body color={COLORS.muted} center>
                  {topic?.name}
                </Body>
                <View style={{ alignSelf: "stretch", gap: SPACE[2], marginTop: SPACE[3] }}>
                  <Button label="Otwórz lekcję" onPress={openLevel} />
                  <Button label="Dziś pomijam" variant="ghost" onPress={advance} />
                </View>
              </Animated.View>
            ) : null}
          </View>
        </View>
      </HueProvider>
    );
  }

  if (phase === "done") {
    return (
      <HueProvider color={hue.color}>
        <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
          {head}
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: UI.gutter, paddingBottom: 110 + insets.bottom }}>
            <ResultView eyebrow="sesja zrobiona" title="Na dziś wystarczy" xp={xp} verdict={`Powtórki: ${stats.reviewed} · słabe pytania: ${stats.weakOk} dobrze, ${stats.weakBad} źle. Wpadaj jutro — seria się liczy.`} celebrate>
              <Button label="Do przedmiotów" onPress={() => router.push("/(tabs)")} />
              <Button label="Jeszcze raz" variant="ghost" onPress={() => setPhase("intro")} />
            </ResultView>
          </ScrollView>
        </View>
      </HueProvider>
    );
  }

  return (
    <HueProvider color={hue.color}>
      <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
        {head}
        <ScrollView contentContainerStyle={{ padding: UI.gutter, paddingTop: SPACE[2], paddingBottom: 110 + insets.bottom, gap: SPACE[3] }} showsVerticalScrollIndicator={false}>
          {app.topics.length === 0 ? (
            <Empty icon="◆" title="Nic na dziś" text="Dodaj pierwszy temat w przedmiocie, a ułożę Ci codzienną sesję." action={<Button label="Do przedmiotów" onPress={() => router.push("/(tabs)")} />} />
          ) : (
            <View style={s.hero}>
              <View style={s.hl} />
              <Glow color={hue.color} size={380} alpha={0.16} style={{ top: -180, right: -120 }} />
              <Label>twoja sesja · ~{d.minutes} min</Label>
              <Display size="2xl" weight={700} style={{ marginTop: SPACE[2] }}>
                {d.items.length ? "Dziesięć minut i lecisz dalej" : "Na dziś czysto"}
              </Display>
              <Body color={COLORS.muted} style={{ marginTop: 4 }}>
                {d.items.length ? "Powtórki, słabe pytania i jeden nowy poziom." : "Wszystkie poziomy zrobione, żadnych powtórek. Dodaj nowy temat albo wróć jutro."}
              </Body>
              <View style={s.metrics}>
                <MiniPill value={d.reviewCount} label="powtórki" />
                <MiniPill value={d.weakCount} label="słabe" />
                <MiniPill value={d.newLevel ? 1 : 0} label="nowy" />
              </View>
              {d.newLevel ? (
                <View style={s.next}>
                  <IconTile emoji={sessionTopic?.emoji ?? "•"} size={40} />
                  <View style={{ flex: 1 }}>
                    <Label>nowy poziom</Label>
                    <Title size="base">{d.newLevel.title}</Title>
                    <Muted size="xs">{sessionTopic?.name}</Muted>
                  </View>
                </View>
              ) : null}
              {d.items.length ? <Button label="Start" onPress={start} style={{ marginTop: SPACE[5] }} /> : null}
            </View>
          )}
        </ScrollView>
      </View>
    </HueProvider>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.xl, padding: SPACE[6], overflow: "hidden", ...shadowCard },
  hl: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: COLORS.highlight, zIndex: 2 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: SPACE[2], marginTop: SPACE[4] },
  next: { flexDirection: "row", alignItems: "center", gap: SPACE[3], marginTop: SPACE[4], paddingTop: SPACE[4], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.lineStrong },
  runHead: { flexDirection: "row", alignItems: "center", gap: SPACE[3], paddingHorizontal: UI.gutter, paddingBottom: SPACE[3] },
  body: { flex: 1, paddingHorizontal: UI.gutter, paddingBottom: SPACE[3] },
  newCard: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE[2], backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.xl, padding: SPACE[6], overflow: "hidden", ...shadowCard },
});
