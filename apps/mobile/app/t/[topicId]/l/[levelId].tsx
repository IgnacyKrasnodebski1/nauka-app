import { GEMS, XP, applyQuizResult, cardKey, comboMultiplier, comboStep, comboTierHit, comboXp, emptyCombo, levelProgress, newCard, nextComboAt, review, type Level, type MiniGame, type QuizQuestion, type Topic } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HueProvider } from "@/components/Accent";
import { Button3D } from "@/components/Button3D";
import { FeedCard } from "@/components/FeedCard";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { FlashcardDeck } from "@/components/FlashcardDeck";
import { MiniGameView } from "@/components/games";
import { Icon } from "@/components/Icon";
import { ComboBadge, SegmentedProgress } from "@/components/Lesson";
import { Mascot, MascotBubble } from "@/components/Mascot";
import { NoHeartsModal } from "@/components/Modals";
import { HeartsPill } from "@/components/Pills";
import { QuizCard } from "@/components/QuizCard";
import { ResultView } from "@/components/ResultView";
import { Label, Muted } from "@/components/Text";
import { TutorModal } from "@/components/TutorModal";
import { BackButton, Button, Empty, Loading, Touch } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { gameLabel, gamesForLevel, minutesSince, shuffle } from "@/lib/games";
import { play } from "@/lib/sfx";
import { COLORS, PLAY, RADIUS, SPACE, UI, shadowCard } from "@/lib/theme";

type Phase = "feed" | "cards" | "games" | "quiz" | "result";
const QUIZ_N = 8;

/** Lekcja tematu: feed → fiszki → mini-gry → quiz → wynik. Serca, combo, arkusz feedbacku, klejnoty, questy. */
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const games = useMemo<MiniGame[]>(() => gamesForLevel(level), [level]);
  const quiz = useMemo<QRef[]>(() => shuffle(level.quiz.map((q, qi) => ({ ...q, qi }))).slice(0, Math.min(QUIZ_N, level.quiz.length)), [level]);
  const cards = level.flashcards;
  const deckCards = useMemo(() => cards.map((c, i) => ({ key: cardKey(level.id, i), t: c.t, d: c.d, tag: `fiszka ${i + 1} / ${cards.length}` })), [cards, level.id]);

  const firstPhase: Phase = level.feed.length ? "feed" : cards.length ? "cards" : games.length ? "games" : quiz.length ? "quiz" : "result";
  const [phase, setPhase] = useState<Phase>(startPhase && startPhase !== "result" && ["feed", "cards", "games", "quiz"].includes(startPhase) ? startPhase : firstPhase);
  const [fi, setFi] = useState(0);
  const [ci, setCi] = useState(0);
  const [gi, setGi] = useState(0);
  const [gameScore, setGameScore] = useState({ correct: 0, total: 0 });
  const [gamesWon, setGamesWon] = useState(0);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const answers = useRef<{ right: number[]; wrong: number[] }>({ right: [], wrong: [] });
  const [tutor, setTutor] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof applyQuizResult> | null>(null);
  const [resultStats, setResultStats] = useState<{ xp: number; gems: number; seconds: number; comboBest: number } | null>(null);
  const feedXp = useRef(new Set<number>());
  const [sideXp, setSideXp] = useState(0);
  const [combo, setCombo] = useState(emptyCombo());
  const [comboBonus, setComboBonus] = useState(0);
  const [lastXp, setLastXp] = useState<{ xp: number; mult: number }>({ xp: 0, mult: 1 });
  const [outOfHearts, setOutOfHearts] = useState(false);
  const [gate, setGate] = useState(!app.canStartLesson && phase !== "result");
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
        return level.feed.length + cards.length + games.length + qi + (picked !== null ? 1 : 0);
      default:
        return total;
    }
  })();

  const after = (p: Phase): Phase => {
    const order: Phase[] = ["feed", "cards", "games", "quiz", "result"];
    const has: Record<Phase, boolean> = { feed: level.feed.length > 0, cards: cards.length > 0, games: games.length > 0, quiz: quiz.length > 0, result: true };
    let i = order.indexOf(p) + 1;
    while (i < order.length - 1 && !has[order[i]!]) i++;
    return order[i]!;
  };

  /** combo + quest + dźwięk dla każdej pojedynczej odpowiedzi (gry i quiz) */
  const registerAnswer = (correct: boolean, baseXp: number): { xp: number; mult: number } => {
    const next = comboStep(combo, correct);
    setCombo(next);
    app.questEvent({ type: "answer", correct, combo: next.streak });
    if (correct) {
      const c = comboXp(baseXp, next.streak);
      if (c.bonus) setComboBonus((b) => b + c.bonus);
      if (comboTierHit(next.streak)) {
        play("combo");
        haptic.heavy();
      } else play("correct");
      return { xp: c.xp, mult: c.mult };
    }
    play("wrong");
    return { xp: 0, mult: 1 };
  };

  const finish = (forced = false) => {
    const prev = levelProgress(app.progressFor(topic.id), level.id);
    const r = quiz.length ? applyQuizResult(app.progressFor(topic.id), level.id, score, quiz.length) : applyQuizResult(app.progressFor(topic.id), level.id, 1, 1);
    const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    let gems = 0;
    if (r.passed && !prev.done) gems += GEMS.levelPass;
    if (r.pct === 100 && prev.best < 100) gems += GEMS.levelPerfect;
    app.setProgressFor(topic.id, r.progress, r.gained);
    if (comboBonus > 0) app.addXp(topic.id, comboBonus);
    app.setWeak(topic.id, level.id, answers.current.wrong, answers.current.right);
    app.logActivity(r.gained + sideXp + comboBonus, minutesSince(startedAt.current));
    if (r.passed) app.questEvent({ type: "level", perfect: r.pct === 100 });
    app.bumpStats((st) => ({
      levelsDone: st.levelsDone + (r.passed && !prev.done ? 1 : 0),
      perfectLevels: st.perfectLevels + (r.pct === 100 && prev.best < 100 ? 1 : 0),
      comboBest: Math.max(st.comboBest, combo.best),
    }));
    if (gems) app.addGems(gems);
    setResult(r);
    setResultStats({ xp: r.gained + sideXp + comboBonus, gems, seconds, comboBest: combo.best });
    setPhase("result");
    if (r.passed) {
      haptic.heavy();
      play("levelup");
    } else {
      haptic.bad();
      if (forced) setOutOfHearts(true);
    }
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
    app.questEvent({ type: "review", count: 1 });
    app.bumpStats((st) => ({ cardsReviewed: st.cardsReviewed + 1 }));
    if (g >= 2) {
      setSideXp((x) => x + XP.flashcardKnown);
      app.addXp(topic.id, XP.flashcardKnown);
      haptic.ok();
      play("correct");
    } else haptic.tap();
    if (ci + 1 < cards.length) setCi(ci + 1);
    else go(after("cards"));
  };

  const gameDone = (correct: number, tot: number) => {
    setGameScore((g) => ({ correct: g.correct + correct, total: g.total + tot }));
    const won = tot > 0 && correct / tot >= 0.6;
    if (won) setGamesWon((n) => n + 1);
    app.questEvent({ type: "game", won });
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
    const ok = i === q.c;
    const r = registerAnswer(ok, XP.quizCorrect);
    setLastXp(r);
    if (ok) {
      setScore((x) => x + 1);
      answers.current.right.push(q.qi);
      haptic.ok();
    } else {
      answers.current.wrong.push(q.qi);
      haptic.bad();
      app.loseHeart();
    }
  };
  const heartsLeft = app.hearts.unlimited ? Infinity : app.hearts.hearts;
  const nextQ = () => {
    if (heartsLeft <= 0) return finish(true);
    if (qi + 1 < quiz.length) {
      setQi(qi + 1);
      setPicked(null);
    } else finish();
  };

  const retry = () => {
    if (!app.canStartLesson) {
      setGate(true);
      return;
    }
    setPhase(firstPhase);
    setFi(0);
    setCi(0);
    setGi(0);
    setQi(0);
    setPicked(null);
    setScore(0);
    setGameScore({ correct: 0, total: 0 });
    setGamesWon(0);
    setResult(null);
    setResultStats(null);
    answers.current = { right: [], wrong: [] };
    setSideXp(0);
    setCombo(emptyCombo());
    setComboBonus(0);
    setOutOfHearts(false);
    startedAt.current = Date.now();
  };

  const phaseLabel: Record<Phase, string> = { feed: "feed", cards: "fiszki", games: "mini-gra", quiz: "quiz", result: "wynik" };
  const verdict = !result
    ? ""
    : outOfHearts
      ? "Skończyły się serca. Odnowią się z czasem — a błędne pytania wrócą w Dziennej misji."
      : !result.passed
        ? "Poniżej 50%. Błędne pytania wrócą w Dziennej misji — przejrzyj feed i spróbuj ponownie."
        : result.pct >= 90
          ? "Mistrzostwo. Trzy gwiazdki."
          : result.pct >= 70
            ? "Solidnie. Poziom zaliczony, lecimy dalej."
            : "Zaliczone na styk — błędne pytania wrócą w Dziennej misji.";

  return (
    <View style={[s.wrap, { paddingTop: Platform.OS === "ios" ? insets.top : insets.top + SPACE[1] }]}>
      {phase !== "result" ? (
        <View style={s.head}>
          <BackButton onPress={onClose} label="✕" />
          <View style={{ flex: 1, gap: 6 }}>
            <SegmentedProgress done={done} total={total} />
            <Label numberOfLines={1}>
              {phaseLabel[phase]} · {level.title}
            </Label>
          </View>
          <ComboBadge streak={combo.streak} />
          <HeartsPill hearts={app.hearts} compact />
        </View>
      ) : null}
      {phase !== "result" ? (
        <View style={s.tools}>
          <Touch onPress={() => app.setSoundOn(!app.soundOn)} style={s.tool} accessibilityLabel="Dźwięki">
            <Icon name={app.soundOn ? "volume-high" : "volume-mute"} size={16} color={app.soundOn ? COLORS.textSoft : COLORS.faint} />
          </Touch>
          <Touch onPress={() => setTutor(true)} style={[s.tool, { paddingHorizontal: 12, gap: 6 }]} accessibilityLabel="Wytłumacz z tutorem">
            <Icon name="chatbubble-ellipses" size={15} color={PLAY.purple} />
            <Muted size="xs" weight={700} color={COLORS.text}>
              Wytłumacz
            </Muted>
          </Touch>
        </View>
      ) : null}

      <View style={s.body}>
        {phase === "feed" && level.feed[fi] ? (
          <Animated.View key={`f${fi}`} entering={FadeInRight.duration(220)} style={{ flex: 1 }}>
            <FeedCard item={level.feed[fi]!} tag={`${fi + 1} / ${level.feed.length}`} />
            <View style={s.foot}>
              <Button3D label={fi + 1 < level.feed.length ? "Dalej" : after("feed") === "result" ? "Zakończ" : `Dalej: ${phaseLabel[after("feed")]}`} onPress={nextFeed} right={<Icon name="arrow-forward" size={18} color="#fff" />} />
            </View>
          </Animated.View>
        ) : null}

        {phase === "cards" && cards[ci] ? (
          <Animated.View key="cards" entering={FadeIn.duration(200)} style={{ flex: 1, paddingBottom: SPACE[3] }}>
            <FlashcardDeck cards={deckCards} index={ci} onGrade={(g) => gradeCard(g)} />
          </Animated.View>
        ) : null}

        {phase === "games" && games[gi] ? (
          <ScrollView key={`g${gi}`} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Animated.View entering={FadeInRight.duration(220)} style={s.gcard}>
              <View style={s.hl} />
              <Label style={{ marginBottom: SPACE[3] }}>
                mini-gra {gi + 1} / {games.length} · {gameLabel(games[gi]!)}
              </Label>
              <MiniGameView game={games[gi]!} onDone={gameDone} onAnswer={(ok) => registerAnswer(ok, XP.gameCorrect)} />
            </Animated.View>
          </ScrollView>
        ) : null}

        {phase === "quiz" && q ? (
          <View style={{ flex: 1 }}>
            <ScrollView key={`q${qi}`} contentContainerStyle={[s.scroll, picked !== null && { paddingBottom: 320 }]} showsVerticalScrollIndicator={false}>
              <Animated.View entering={FadeInRight.duration(220)}>
                <QuizCard q={q} picked={picked} reveal={picked !== null} onPick={pickQ} tag={`pytanie ${qi + 1} / ${quiz.length}`} explain={false} bare />
              </Animated.View>
            </ScrollView>
            {picked === null ? (
              <Animated.View entering={FadeIn.duration(300)} style={[s.coach, { paddingBottom: insets.bottom + SPACE[3] }]}>
                <Mascot state={combo.streak >= 5 ? "cheer" : combo.streak >= 2 ? "happy" : "think"} size={72} streak={app.streak} />
                <View style={{ flex: 1 }}>
                  <MascotBubble text={combo.streak >= 5 ? `Combo ×${comboMultiplier(combo.streak)}! Każda odpowiedź liczy się podwójnie.` : combo.streak >= 2 ? `${combo.streak} z rzędu — jeszcze ${(nextComboAt(combo.streak) ?? 0) - combo.streak} do combo.` : score === 0 && qi === 0 ? "Spokojnie, czytaj uważnie. Każdy błąd to −1 serce." : `Pytanie ${qi + 1} z ${quiz.length}. Dasz radę.`} tail="left" style={{ maxWidth: undefined }} />
                </View>
              </Animated.View>
            ) : null}
          </View>
        ) : null}

        {phase === "result" && result && resultStats ? (
          <ScrollView contentContainerStyle={[s.scroll, { flexGrow: 1, justifyContent: "center", paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
            <ResultView
              eyebrow={outOfHearts ? "brak serc" : result.passed ? "poziom zaliczony" : "poziom niezaliczony"}
              title={level.title}
              stars={result.passed ? result.stars : 0}
              stats={{ xp: resultStats.xp, comboBest: resultStats.comboBest, accuracy: quiz.length ? result.pct : Math.round((gameScore.correct / Math.max(1, gameScore.total)) * 100), seconds: resultStats.seconds, gems: resultStats.gems }}
              score={quiz.length ? `Quiz ${score}/${quiz.length}${gameScore.total ? ` · gry ${gameScore.correct}/${gameScore.total}` : ""}${gamesWon ? ` · wygrane ${gamesWon}` : ""}` : undefined}
              verdict={verdict}
              celebrate={result.passed}
            >
              {result.passed ? <Button3D label="Dalej na ścieżkę" onPress={onClose} right={<Icon name="arrow-forward" size={18} color="#fff" />} /> : <Button3D label="Spróbuj jeszcze raz" variant="blue" onPress={retry} />}
              {result.passed ? <Button3D label="Powtórz lekcję" variant="ghost" onPress={retry} /> : <Button3D label="Wróć na ścieżkę" variant="ghost" onPress={onClose} />}
            </ResultView>
          </ScrollView>
        ) : null}
      </View>

      {phase === "quiz" && q && picked !== null ? (
        <FeedbackSheet
          ok={picked === q.c}
          explanation={q.e}
          correctLabel={picked !== q.c ? q.a[q.c] : undefined}
          xp={lastXp.xp}
          mult={lastXp.mult}
          heartLost={!app.hearts.unlimited}
          seed={qi}
          onNext={nextQ}
          nextLabel={heartsLeft <= 0 ? "Zobacz wynik" : qi + 1 >= quiz.length ? "Zobacz wynik" : "Dalej"}
        />
      ) : null}

      {gate ? (
        <NoHeartsModal
          hearts={app.hearts}
          gems={app.gems}
          isPro={app.plan === "pro"}
          onRefill={() => {
            if (app.refillHearts()) setGate(false);
          }}
          onPro={() => {
            setGate(false);
            onClose();
            router.push("/(tabs)/profile");
          }}
          onClose={() => {
            setGate(false);
            if (phase !== "result") onClose();
          }}
        />
      ) : null}

      <TutorModal open={tutor} onClose={() => setTutor(false)} topicId={topic.id} levelId={level.id} levelTitle={level.title} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg0 },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE[2], paddingHorizontal: UI.gutter, paddingVertical: SPACE[3] },
  tools: { flexDirection: "row", justifyContent: "flex-end", gap: SPACE[2], paddingHorizontal: UI.gutter, paddingBottom: SPACE[2] },
  tool: { flexDirection: "row", alignItems: "center", height: 32, paddingHorizontal: 9, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.pill },
  body: { flex: 1, paddingHorizontal: UI.gutter },
  foot: { paddingVertical: SPACE[3] },
  scroll: { paddingBottom: 40, paddingTop: SPACE[1] },
  coach: { flexDirection: "row", alignItems: "center", gap: SPACE[3], paddingTop: SPACE[2] },
  gcard: { backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.lg, padding: SPACE[5], overflow: "hidden", ...shadowCard },
  hl: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: COLORS.highlight },
});
