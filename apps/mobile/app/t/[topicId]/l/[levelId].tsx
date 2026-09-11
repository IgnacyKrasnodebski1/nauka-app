import { XP, applyQuizResult, cardKey, newCard, review, type Level, type MiniGame, type QuizQuestion, type Topic } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HueProvider } from "@/components/Accent";
import { FeedCard } from "@/components/FeedCard";
import { Flashcard } from "@/components/Flashcard";
import { MiniGameView } from "@/components/games";
import { QuizCard } from "@/components/QuizCard";
import { ResultView, ScoreLine } from "@/components/ResultView";
import { Body, Label, Muted } from "@/components/Text";
import { BackButton, Button, Empty, Loading, ProgressBar, Touch } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { gameLabel, gamesForLevel, minutesSince, shuffle } from "@/lib/games";
import { COLORS, RADIUS, SPACE, UI, shadowCard } from "@/lib/theme";
import { GradeRow, gr } from "@/screens/topic/FlashcardsTab";
import { TutorModal } from "@/components/TutorModal";

type Phase = "feed" | "cards" | "games" | "quiz" | "result";
const QUIZ_N = 8;

/** Lekcja tematu: feed → fiszki → mini-gry → quiz → wynik. Po quizie: applyQuizResult + markWeak + log_activity + streak. */
export default function LessonScreen() {
  const { topicId, levelId, phase: startPhase } = useLocalSearchParams<{ topicId: string; levelId: string; phase?: Phase }>();
  const app = useApp();
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    if (topicId && app.ready) app.getTopic(topicId).then((t) => alive && setTopic(t));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, app.ready]);

  const level = topic?.levels.find((l) => l.id === levelId);
  const close = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/t/[topicId]", params: { topicId: topicId ?? "" } }));

  if (topic === undefined) return <Loading label="wczytuję lekcję…" />;
  if (!topic || !level)
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg0, justifyContent: "center" }}>
        <Empty icon="?" title="Nie ma takiego poziomu" action={<Button label="Wróć" onPress={close} />} />
      </View>
    );
  const subject = app.findSubject(topic.subjectId);
  return (
    <HueProvider color={subject?.accent2 ?? topic.accent2} seed={subject?.name ?? topic.name}>
      <Lesson key={level.id} topic={topic} level={level} onClose={close} startPhase={startPhase} />
    </HueProvider>
  );
}

interface QRef extends QuizQuestion {
  qi: number;
}

/** `startPhase` — opcjonalny skok do etapu (deep link / podgląd), domyślnie pierwszy dostępny. */
function Lesson({ topic, level, onClose, startPhase }: { topic: Topic; level: Level; onClose: () => void; startPhase?: Phase }) {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const games = useMemo<MiniGame[]>(() => gamesForLevel(level), [level]);
  const quiz = useMemo<QRef[]>(() => shuffle(level.quiz.map((q, qi) => ({ ...q, qi }))).slice(0, Math.min(QUIZ_N, level.quiz.length)), [level]);
  const cards = level.flashcards;

  const firstPhase: Phase = level.feed.length ? "feed" : cards.length ? "cards" : games.length ? "games" : quiz.length ? "quiz" : "result";
  const [phase, setPhase] = useState<Phase>(startPhase && startPhase !== "result" && ["feed", "cards", "games", "quiz"].includes(startPhase) ? startPhase : firstPhase);
  const [fi, setFi] = useState(0);
  const [ci, setCi] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [gi, setGi] = useState(0);
  const [gameScore, setGameScore] = useState({ correct: 0, total: 0 });
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const answers = useRef<{ right: number[]; wrong: number[] }>({ right: [], wrong: [] });
  const [tutor, setTutor] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof applyQuizResult> | null>(null);
  const feedXp = useRef(new Set<number>());
  const [sideXp, setSideXp] = useState(0);
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const total = level.feed.length + cards.length + games.length + quiz.length;
  const done = (() => {
    switch (phase) {
      case "feed":
        return fi;
      case "cards":
        return level.feed.length + ci;
      case "games":
        return level.feed.length + cards.length + gi;
      case "quiz":
        return level.feed.length + cards.length + games.length + qi;
      default:
        return total;
    }
  })();
  const pct = total ? (done / total) * 100 : 100;

  const after = (p: Phase): Phase => {
    const order: Phase[] = ["feed", "cards", "games", "quiz", "result"];
    const has: Record<Phase, boolean> = { feed: level.feed.length > 0, cards: cards.length > 0, games: games.length > 0, quiz: quiz.length > 0, result: true };
    let i = order.indexOf(p) + 1;
    while (i < order.length - 1 && !has[order[i]!]) i++;
    return order[i]!;
  };

  const finish = () => {
    const r = quiz.length ? applyQuizResult(app.progressFor(topic.id), level.id, score, quiz.length) : applyQuizResult(app.progressFor(topic.id), level.id, 1, 1);
    app.setProgressFor(topic.id, r.progress);
    app.setWeak(topic.id, level.id, answers.current.wrong, answers.current.right);
    app.logActivity(r.gained + sideXp, minutesSince(startedAt.current));
    setResult(r);
    setPhase("result");
    if (r.passed) haptic.heavy();
    else haptic.bad();
  };

  const go = (n: Phase) => {
    if (n === "result") finish();
    else setPhase(n);
  };

  const nextFeed = () => {
    if (!feedXp.current.has(fi)) {
      feedXp.current.add(fi);
      setSideXp((x) => x + XP.feedRead);
      app.addXp(topic.id, XP.feedRead);
    }
    if (fi + 1 < level.feed.length) setFi(fi + 1);
    else go(after("feed"));
  };

  const gradeCard = (g: 0 | 1 | 2 | 3) => {
    const key = cardKey(level.id, ci);
    const srs = app.srsFor(topic.id);
    app.setSrsFor(topic.id, { ...srs, [key]: review(srs[key] ?? newCard(), g) });
    if (g >= 2) {
      setSideXp((x) => x + XP.flashcardKnown);
      app.addXp(topic.id, XP.flashcardKnown);
      haptic.ok();
    } else haptic.tap();
    setFlipped(false);
    if (ci + 1 < cards.length) setCi(ci + 1);
    else go(after("cards"));
  };

  const gameDone = (correct: number, tot: number) => {
    setGameScore((g) => ({ correct: g.correct + correct, total: g.total + tot }));
    if (correct) {
      setSideXp((x) => x + correct * XP.gameCorrect);
      app.addXp(topic.id, correct * XP.gameCorrect);
    }
    if (gi + 1 < games.length) setGi(gi + 1);
    else go(after("games"));
  };

  const q = quiz[qi];
  const pickQ = (i: number) => {
    if (picked !== null || !q) return;
    setPicked(i);
    if (i === q.c) {
      setScore((x) => x + 1);
      answers.current.right.push(q.qi);
      haptic.ok();
    } else {
      answers.current.wrong.push(q.qi);
      haptic.bad();
    }
  };
  const nextQ = () => {
    if (qi + 1 < quiz.length) {
      setQi(qi + 1);
      setPicked(null);
    } else finish();
  };

  const retry = () => {
    setPhase(firstPhase);
    setFi(0);
    setCi(0);
    setGi(0);
    setQi(0);
    setPicked(null);
    setScore(0);
    setGameScore({ correct: 0, total: 0 });
    setResult(null);
    answers.current = { right: [], wrong: [] };
    setSideXp(0);
    startedAt.current = Date.now();
  };

  const phaseLabel: Record<Phase, string> = { feed: "feed", cards: "fiszki", games: "mini-gra", quiz: "quiz", result: "wynik" };

  return (
    <View style={[s.wrap, { paddingTop: Platform.OS === "ios" ? insets.top : insets.top + SPACE[1] }]}>
      <View style={s.head}>
        <BackButton onPress={onClose} label="✕" />
        <View style={{ flex: 1, gap: 6 }}>
          <ProgressBar pct={pct} />
          <Label numberOfLines={1}>
            {phaseLabel[phase]} · {level.title}
          </Label>
        </View>
        <Touch onPress={() => setTutor(true)} style={s.tutorBtn} accessibilityLabel="Wytłumacz z tutorem">
          <Muted size="xs" weight={600} color={COLORS.text}>
            Wytłumacz
          </Muted>
        </Touch>
      </View>

      <View style={s.body}>
        {phase === "feed" && level.feed[fi] ? (
          <Animated.View key={`f${fi}`} entering={FadeInRight.duration(220)} style={{ flex: 1 }}>
            <FeedCard item={level.feed[fi]!} tag={`${fi + 1} / ${level.feed.length}`} />
            <View style={s.foot}>
              <Button label={fi + 1 < level.feed.length ? "Dalej" : after("feed") === "result" ? "Zakończ" : `Dalej: ${phaseLabel[after("feed")]}`} onPress={nextFeed} />
            </View>
          </Animated.View>
        ) : null}

        {phase === "cards" && cards[ci] ? (
          <Animated.View key={`c${ci}`} entering={FadeIn.duration(200)} style={{ flex: 1 }}>
            <Flashcard term={cards[ci]!.t} def={cards[ci]!.d} tag={`fiszka ${ci + 1} / ${cards.length}`} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
            <View style={s.foot}>
              {flipped ? (
                <GradeRow onGrade={gradeCard} />
              ) : (
                <Touch onPress={() => setFlipped(true)} style={[gr.show, { marginTop: 0 }]}>
                  <Body weight={700} color={COLORS.text}>
                    Pokaż odpowiedź
                  </Body>
                </Touch>
              )}
            </View>
          </Animated.View>
        ) : null}

        {phase === "games" && games[gi] ? (
          <ScrollView key={`g${gi}`} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Animated.View entering={FadeInRight.duration(220)} style={s.gcard}>
              <View style={s.hl} />
              <Label style={{ marginBottom: SPACE[3] }}>
                mini-gra {gi + 1} / {games.length} · {gameLabel(games[gi]!)}
              </Label>
              <MiniGameView game={games[gi]!} onDone={gameDone} />
            </Animated.View>
          </ScrollView>
        ) : null}

        {phase === "quiz" && q ? (
          <ScrollView key={`q${qi}`} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInRight.duration(220)}>
              <QuizCard q={q} picked={picked} reveal={picked !== null} onPick={pickQ} tag={`pytanie ${qi + 1} / ${quiz.length}`}>
                {picked !== null ? <Button label={qi + 1 >= quiz.length ? "Zobacz wynik" : "Następne"} onPress={nextQ} style={{ marginTop: SPACE[4] }} /> : null}
              </QuizCard>
            </Animated.View>
          </ScrollView>
        ) : null}

        {phase === "result" && result ? (
          <ScrollView contentContainerStyle={[s.scroll, { flexGrow: 1, justifyContent: "center" }]} showsVerticalScrollIndicator={false}>
            <ResultView
              eyebrow={result.passed ? "poziom zaliczony" : "poziom niezaliczony"}
              title={level.title}
              xp={result.gained + sideXp}
              stars={result.passed ? result.stars : 0}
              score={quiz.length ? <ScoreLine correct={score} total={quiz.length} extra={gameScore.total ? `gry ${gameScore.correct}/${gameScore.total}` : undefined} /> : undefined}
              verdict={
                !result.passed
                  ? "Poniżej 50%. Błędne pytania wrócą w sesji „Dziś” — przejrzyj feed i spróbuj ponownie."
                  : result.pct >= 90
                    ? "Mistrzostwo. Trzy gwiazdki."
                    : result.pct >= 70
                      ? "Solidnie. Poziom zaliczony, lecimy dalej."
                      : "Zaliczone na styk — błędne pytania wrócą w sesji „Dziś”."
              }
              celebrate={result.passed}
            >
              {result.passed ? <Button label="Dalej na ścieżkę" onPress={onClose} /> : <Button label="Spróbuj jeszcze raz" onPress={retry} />}
              {result.passed ? <Button label="Powtórz lekcję" variant="ghost" onPress={retry} /> : <Button label="Wróć na ścieżkę" variant="ghost" onPress={onClose} />}
            </ResultView>
          </ScrollView>
        ) : null}
      </View>

      <TutorModal open={tutor} onClose={() => setTutor(false)} topicId={topic.id} levelId={level.id} levelTitle={level.title} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg0 },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE[3], paddingHorizontal: UI.gutter, paddingVertical: SPACE[3] },
  tutorBtn: { backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.pill, paddingVertical: 8, paddingHorizontal: 12 },
  body: { flex: 1, paddingHorizontal: UI.gutter },
  foot: { paddingVertical: SPACE[3] },
  scroll: { paddingBottom: 40, paddingTop: SPACE[1] },
  gcard: { backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.lg, padding: SPACE[5], overflow: "hidden", ...shadowCard },
  hl: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: COLORS.highlight },
});
