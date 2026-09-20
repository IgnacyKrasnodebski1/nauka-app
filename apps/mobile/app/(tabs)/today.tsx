import { GEMS, XP, newCard, review, type SessionItem, type SrsGrade } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HueProvider } from "@/components/Accent";
import { Button3D } from "@/components/Button3D";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { FlashcardDeck } from "@/components/FlashcardDeck";
import { Icon } from "@/components/Icon";
import { SegmentedProgress } from "@/components/Lesson";
import { QuestsCard, StreakCalendar } from "@/components/Gamification";
import { Mascot, MascotBubble } from "@/components/Mascot";
import { GemsPill, HeartsPill, StreakPill } from "@/components/Pills";
import { QuizCard } from "@/components/QuizCard";
import { DailyGoalRing } from "@/components/Ring";
import { ResultView } from "@/components/ResultView";
import { Body, Display, Label, Muted, Title } from "@/components/Text";
import { BackButton, Card, IconTile, TopBar } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { minutesSince } from "@/lib/games";
import { play } from "@/lib/sfx";
import { COLORS, PLAY, RADIUS, SPACE, UI, hueFrom, tabular } from "@/lib/theme";

type Phase = "intro" | "run" | "done";

/** „Dziś” — Dzienna misja: checklista + ring celu, runner (SwipeDeck fiszek, słabe pytania z arkuszem, nowy poziom), wynik z +1 serce. */
export default function Today() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("intro");
  const [items, setItems] = useState<SessionItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [xp, setXp] = useState(0);
  const [stats, setStats] = useState({ reviewed: 0, weakOk: 0, weakBad: 0, seconds: 0 });
  const startedAt = useRef(0);
  const d = app.daily;
  const sessionTopic = d.newLevel ? app.findTopic(d.newLevel.topicId) : app.topics[0];
  const sessionSubject = app.findSubject(sessionTopic?.subjectId ?? "");
  const hue = hueFrom(sessionSubject?.accent2, sessionSubject?.name);

  const start = () => {
    setItems(d.items);
    setIdx(0);
    setXp(0);
    setStats({ reviewed: 0, weakOk: 0, weakBad: 0, seconds: 0 });
    setPicked(null);
    startedAt.current = Date.now();
    setPhase(d.items.length ? "run" : "intro");
  };

  const item = items[idx];
  const topic = useMemo(() => (item ? app.findTopic(item.topicId) : undefined), [item, app]);
  const itemSubject = app.findSubject(topic?.subjectId ?? "");
  const reviewItems = useMemo(() => items.filter((i) => i.kind === "review"), [items]);
  const reviewIdx = useMemo(() => reviewItems.findIndex((r) => r === item), [reviewItems, item]);
  const deckCards = useMemo(() => reviewItems.map((r) => ({ key: r.card!.key + r.topicId, t: r.card!.t, d: r.card!.d, tag: app.findTopic(r.topicId)?.name })), [reviewItems, app]);

  const advance = () => {
    setPicked(null);
    if (idx + 1 < items.length) setIdx(idx + 1);
    else finish();
  };

  const finish = () => {
    const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    const bonus = XP.sessionDone;
    const tid = items[0]?.topicId ?? app.topics[0]?.id;
    if (tid) app.addXp(tid, bonus);
    app.addGems(GEMS.sessionDone);
    app.gainHeart();
    app.logActivity(xp + bonus, minutesSince(startedAt.current));
    setXp((x) => x + bonus);
    setStats((s) => ({ ...s, seconds }));
    haptic.heavy();
    play("levelup");
    setPhase("done");
  };

  const gradeCard = (g: SrsGrade) => {
    if (!item?.card) return;
    const srs = app.srsFor(item.topicId);
    app.setSrsFor(item.topicId, { ...srs, [item.card.key]: review(srs[item.card.key] ?? newCard(), g) });
    app.questEvent({ type: "review", count: 1 });
    app.bumpStats((st) => ({ cardsReviewed: st.cardsReviewed + 1 }));
    if (g >= 2) {
      app.addXp(item.topicId, XP.flashcardKnown);
      setXp((x) => x + XP.flashcardKnown);
      haptic.ok();
      play("correct");
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
    app.questEvent({ type: "answer", correct: ok, combo: ok ? 1 : 0 });
    if (ok) {
      app.addXp(item.topicId, XP.quizCorrect);
      setXp((x) => x + XP.quizCorrect);
      haptic.ok();
      play("correct");
      setStats((s) => ({ ...s, weakOk: s.weakOk + 1 }));
    } else {
      haptic.bad();
      play("wrong");
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
      title="Dzienna misja"
      subtitle={`~${d.minutes} min · cel ${app.todayXp}/${app.dailyGoal} XP`}
      right={
        <>
          <StreakPill streak={app.streak} compact />
          <GemsPill gems={app.gems} compact />
          <HeartsPill hearts={app.hearts} compact />
        </>
      }
    />
  );

  if (phase === "run" && item) {
    const kindLabel = item.kind === "review" ? "powtórka" : item.kind === "weak" ? "słabe pytanie" : "nowy poziom";
    return (
      <HueProvider color={itemSubject?.accent2} seed={itemSubject?.name}>
        <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
          <View style={[s.runHead, { paddingTop: insets.top + SPACE[2] }]}>
            <BackButton onPress={() => setPhase("intro")} label="✕" />
            <View style={{ flex: 1, gap: 6 }}>
              <SegmentedProgress done={idx} total={items.length} color={PLAY.green} />
              <Label numberOfLines={1}>
                {kindLabel} · {idx + 1}/{items.length} · {topic?.name ?? ""}
              </Label>
            </View>
            <View style={s.xpPill}>
              <Icon name="flash" size={14} color={PLAY.yellow} />
              <Display size="base" weight={800} color={PLAY.yellow} style={tabular}>
                +{xp}
              </Display>
            </View>
          </View>
          <View style={s.body}>
            {item.kind === "review" && item.card && reviewIdx >= 0 ? (
              <View style={{ flex: 1, paddingBottom: SPACE[2] }}>
                <FlashcardDeck cards={deckCards} index={reviewIdx} onGrade={(g) => gradeCard(g)} />
              </View>
            ) : null}
            {item.kind === "weak" && item.question ? (
              <ScrollView key={`w${idx}`} contentContainerStyle={{ paddingBottom: picked !== null ? 320 : 30 }} showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeInRight.duration(200)}>
                  <QuizCard q={item.question} picked={picked} reveal={picked !== null} onPick={answerWeak} tag={`ostatnio nie poszło · ${topic?.name ?? ""}`} explain={false} bare />
                </Animated.View>
              </ScrollView>
            ) : null}
            {item.kind === "new" && item.levelId ? (
              <Animated.View key={`n${idx}`} entering={FadeInRight.duration(200)} style={s.newCard}>
                <Mascot state="happy" size={110} streak={app.streak} />
                <IconTile emoji={topic?.emoji ?? "•"} size={56} />
                <Label style={{ marginTop: SPACE[1] }}>nowy poziom</Label>
                <Display size="xl" weight={800} center>
                  {topic?.levels.find((l) => l.id === item.levelId)?.title}
                </Display>
                <Body color={COLORS.muted} center>
                  {topic?.name}
                </Body>
                <View style={{ alignSelf: "stretch", gap: SPACE[2], marginTop: SPACE[3] }}>
                  <Button3D label="Otwórz lekcję" onPress={openLevel} right={<Icon name="play" size={16} color="#fff" />} />
                  <Button3D label="Dziś pomijam" variant="ghost" onPress={advance} />
                </View>
              </Animated.View>
            ) : null}
          </View>
          {item.kind === "weak" && item.question && picked !== null ? (
            <FeedbackSheet ok={picked === item.question.c} explanation={item.question.e} correctLabel={picked !== item.question.c ? item.question.a[item.question.c] : undefined} xp={XP.quizCorrect} onNext={advance} nextLabel={idx + 1 >= items.length ? "Zakończ" : "Dalej"} seed={idx} />
          ) : null}
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
            <ResultView eyebrow="misja zrobiona" title="Na dziś wystarczy" stats={{ xp, accuracy: stats.weakOk + stats.weakBad ? Math.round((stats.weakOk / (stats.weakOk + stats.weakBad)) * 100) : 100, seconds: stats.seconds, gems: GEMS.sessionDone }} verdict={`Powtórki: ${stats.reviewed} · słabe pytania: ${stats.weakOk} dobrze, ${stats.weakBad} źle. Wpadaj jutro — seria się liczy.`} celebrate>
              <View style={s.heartRow}>
                <Icon name="heart" size={20} color={PLAY.heart} />
                <Body weight={700} color={PLAY.heart}>
                  +1 serce za misję
                </Body>
              </View>
              <Button3D label="Na Start" onPress={() => router.push("/(tabs)")} right={<Icon name="home" size={16} color="#fff" />} />
              <Button3D label="Jeszcze raz" variant="ghost" onPress={() => setPhase("intro")} />
            </ResultView>
          </ScrollView>
        </View>
      </HueProvider>
    );
  }

  const checklist = [
    { icon: "layers" as const, label: `${d.reviewCount} fiszek do powtórki`, on: d.reviewCount > 0, color: PLAY.blue },
    { icon: "help-circle" as const, label: `${d.weakCount} słabych pytań`, on: d.weakCount > 0, color: PLAY.orange },
    { icon: "flag" as const, label: d.newLevel ? `Nowy poziom: ${d.newLevel.title}` : "Nowy poziom (wszystko zrobione)", on: !!d.newLevel, color: PLAY.green },
    { icon: "heart" as const, label: "+1 serce i +5 klejnotów za misję", on: true, color: PLAY.heart },
  ];

  return (
    <HueProvider color={hue.color}>
      <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
        {head}
        <ScrollView contentContainerStyle={{ padding: UI.gutter, paddingTop: SPACE[2], paddingBottom: 110 + insets.bottom, gap: SPACE[3] }} showsVerticalScrollIndicator={false}>
          {app.topics.length === 0 ? (
            <Card style={{ alignItems: "center", gap: SPACE[3] }}>
              <Mascot state="think" size={120} streak={app.streak} />
              <Display size="lg" weight={700} center>
                Nic na dziś
              </Display>
              <Body center color={COLORS.muted}>
                Dodaj pierwszy temat w przedmiocie, a ułożę Ci codzienną misję.
              </Body>
              <Button3D label="Do przedmiotów" onPress={() => router.push("/(tabs)")} />
            </Card>
          ) : (
            <>
              <Animated.View entering={FadeInDown.duration(300)} style={s.hero}>
                <DailyGoalRing xp={app.todayXp} goal={app.dailyGoal} size={96} />
                <View style={{ flex: 1, gap: SPACE[2] }}>
                  <MascotBubble text={d.items.length ? (app.goalMet ? "Cel zrobiony, ale misja czeka!" : "Dziesięć minut i lecisz dalej.") : "Na dziś czysto. Wróć jutro."} tail="left" />
                </View>
                <Mascot state={d.items.length ? "idle" : "happy"} size={84} streak={app.streak} />
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(60).duration(300)}>
                <Card style={{ gap: SPACE[3] }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Title size="lg">Dzienna misja</Title>
                    <View style={s.minPill}>
                      <Icon name="time" size={13} color={COLORS.muted} />
                      <Muted size="xs" weight={700}>
                        ~{d.minutes} min
                      </Muted>
                    </View>
                  </View>
                  {checklist.map((c, i) => (
                    <View key={i} style={s.check}>
                      <View style={[s.checkIcon, { backgroundColor: c.on ? c.color : COLORS.bg3 }]}>
                        <Icon name={c.icon} size={15} color={c.on ? "#fff" : COLORS.faint} />
                      </View>
                      <Body weight={600} color={c.on ? COLORS.text : COLORS.faint} style={{ flex: 1 }} numberOfLines={2}>
                        {c.label}
                      </Body>
                      <Icon name={c.on ? "ellipse-outline" : "remove-circle-outline"} size={18} color={c.on ? c.color : COLORS.faint} />
                    </View>
                  ))}
                  {d.items.length ? <Button3D label="Start misji" onPress={start} style={{ marginTop: SPACE[1] }} right={<Icon name="rocket" size={16} color="#fff" />} /> : <Button3D label="Wszystko zrobione" variant="ghost" disabled />}
                </Card>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(120).duration(300)}>
                <QuestsCard quests={app.quests} onClaim={app.claimQuest} />
              </Animated.View>

              {d.newLevel ? (
                <Animated.View entering={FadeInDown.delay(160).duration(300)}>
                  <Card style={{ flexDirection: "row", alignItems: "center", gap: SPACE[3], borderColor: hue.ring }}>
                    <IconTile emoji={sessionTopic?.emoji ?? "•"} size={48} />
                    <View style={{ flex: 1 }}>
                      <Label color={hue.color}>następny poziom</Label>
                      <Title size="base" numberOfLines={2}>
                        {d.newLevel.title}
                      </Title>
                      <Muted size="xs">{sessionTopic?.name}</Muted>
                    </View>
                    <Button3D label="Idź" size="sm" color={hue.color} deep={hue.deep} onPress={() => router.push({ pathname: "/t/[topicId]/l/[levelId]", params: { topicId: d.newLevel!.topicId, levelId: d.newLevel!.levelId } })} style={{ width: 72 }} />
                  </Card>
                </Animated.View>
              ) : null}

              <Animated.View entering={FadeInDown.delay(200).duration(300)}>
                <Card style={{ gap: SPACE[3] }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Title size="md">Szybka powtórka</Title>
                    <Muted size="xs" weight={700} style={tabular}>
                      {app.topics.length} {app.topics.length === 1 ? "temat" : "tematów"}
                    </Muted>
                  </View>
                  {app.topics.slice(0, 4).map((t) => {
                    const sub = app.findSubject(t.subjectId);
                    const h = hueFrom(sub?.accent2, sub?.name);
                    const nCards = t.levels.reduce((a, l) => a + l.flashcards.length, 0);
                    return (
                      <View key={t.id} style={s.topicRow}>
                        <View style={[s.topicEmoji, { backgroundColor: h.soft }]}>
                          <Body size="md">{t.emoji}</Body>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Body weight={700} color={COLORS.text} numberOfLines={1}>
                            {t.name}
                          </Body>
                          <Muted size="xs" style={tabular}>
                            {sub?.name} · {nCards} fiszek
                          </Muted>
                        </View>
                        <Button3D label="Fiszki" size="sm" variant="ghost" onPress={() => router.push({ pathname: "/t/[topicId]", params: { topicId: t.id, tab: "cards" } })} style={{ width: 88 }} left={<Icon name="layers" size={13} color={COLORS.textSoft} />} />
                      </View>
                    );
                  })}
                </Card>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(240).duration(300)}>
                <StreakCalendar week={app.week} streak={app.streak} />
              </Animated.View>
            </>
          )}
        </ScrollView>
      </View>
    </HueProvider>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: SPACE[3] },
  runHead: { flexDirection: "row", alignItems: "center", gap: SPACE[3], paddingHorizontal: UI.gutter, paddingBottom: SPACE[3] },
  xpPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.pill, paddingVertical: 4, paddingHorizontal: 10 },
  body: { flex: 1, paddingHorizontal: UI.gutter, paddingBottom: SPACE[3] },
  newCard: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE[2], backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.xl, padding: SPACE[6], overflow: "hidden" },
  minPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.bg3, borderRadius: RADIUS.pill, paddingVertical: 4, paddingHorizontal: 10 },
  check: { flexDirection: "row", alignItems: "center", gap: SPACE[3] },
  checkIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  topicRow: { flexDirection: "row", alignItems: "center", gap: SPACE[3] },
  topicEmoji: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  heartRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: PLAY.redSoft, borderRadius: RADIUS.md, paddingVertical: 10 },
});
