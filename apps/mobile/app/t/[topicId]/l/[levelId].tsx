import { XP, applyQuizResult, cardKey, newCard, review, type Level, type MiniGame, type QuizQuestion, type Topic } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccentProvider } from "@/components/Accent";
import { FeedCard } from "@/components/FeedCard";
import { Flashcard } from "@/components/Flashcard";
import { MiniGameView } from "@/components/games";
import { QuizCard } from "@/components/QuizCard";
import { ResultView, ScoreLine } from "@/components/ResultView";
import { TutorModal } from "@/components/TutorModal";
import { BackButton, Empty, Loading, PillButton, ProgressBar, Touch } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { gameLabel, gamesForLevel, minutesSince, shuffle } from "@/lib/games";
import { C, FONT, R } from "@/lib/theme";

type Phase = "feed" | "cards" | "games" | "quiz" | "result";
const QUIZ_N = 8;

/** Lekcja tematu: feed → fiszki → mini-gry → quiz → wynik. Po quizie: applyQuizResult + markWeak + log_activity + streak. */
export default function LessonScreen() {
  const { topicId, levelId } = useLocalSearchParams<{ topicId: string; levelId: string }>();
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
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center" }}>
        <Empty emoji="🫥" title="Nie ma takiego poziomu" action={<PillButton label="wróć" onPress={close} />} />
      </View>
    );
  const subject = app.findSubject(topic.subjectId);
  return (
    <AccentProvider accent={subject?.accent ?? topic.accent} accent2={subject?.accent2 ?? topic.accent2}>
      <Lesson key={level.id} topic={topic} level={level} onClose={close} />
    </AccentProvider>
  );
}

interface QRef extends QuizQuestion {
  /** indeks w level.quiz — do markWeak */
  qi: number;
}

function Lesson({ topic, level, onClose }: { topic: Topic; level: Level; onClose: () => void }) {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const games = useMemo<MiniGame[]>(() => gamesForLevel(level), [level]);
  const quiz = useMemo<QRef[]>(() => shuffle(level.quiz.map((q, qi) => ({ ...q, qi }))).slice(0, Math.min(QUIZ_N, level.quiz.length)), [level]);
  const cards = level.flashcards;

  const firstPhase: Phase = level.feed.length ? "feed" : cards.length ? "cards" : games.length ? "games" : quiz.length ? "quiz" : "result";
  const [phase, setPhase] = useState<Phase>(firstPhase);
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
    // brak quizu → poziom zaliczony „za przejście”
    const r = quiz.length ? applyQuizResult(app.progressFor(topic.id), level.id, score, quiz.length) : applyQuizResult(app.progressFor(topic.id), level.id, 1, 1);
    app.setProgressFor(topic.id, r.progress);
    app.setWeak(topic.id, level.id, answers.current.wrong, answers.current.right);
    app.logActivity(r.gained + sideXp, minutesSince(startedAt.current));
    setResult(r);
    setPhase("result");
    if (r.passed) haptic.heavy();
    else haptic.bad();
    if (r.gained) app.showToast(`+${r.gained}xp ⚡`);
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

  const gradeCard = (known: boolean) => {
    const key = cardKey(level.id, ci);
    const srs = app.srsFor(topic.id);
    app.setSrsFor(topic.id, { ...srs, [key]: review(srs[key] ?? newCard(), known ? 3 : 0) });
    if (known) {
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
      app.showToast(`+${correct * XP.gameCorrect}xp 🧩`);
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
      app.showToast(`GIT +${XP.quizCorrect}xp 🟢`);
      haptic.ok();
    } else {
      answers.current.wrong.push(q.qi);
      app.showToast("mid, czytaj wyjaśnienie 👇");
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

  const phaseLabel: Record<Phase, string> = { feed: "📖 feed", cards: "🎴 fiszki", games: "🧩 mini-gra", quiz: "🧠 quiz", result: "🏁 wynik" };

  return (
    <View style={[s.wrap, { paddingTop: Platform.OS === "ios" ? insets.top : insets.top + 6 }]}>
      <View style={s.head}>
        <BackButton onPress={onClose} label="✕" />
        <View style={{ flex: 1, gap: 4 }}>
          <ProgressBar pct={pct} height={8} />
          <Text style={s.phase}>
            {phaseLabel[phase]} · {level.title}
          </Text>
        </View>
        <Touch onPress={() => setTutor(true)} style={s.tutorBtn} accessibilityLabel="Wytłumacz z tutorem">
          <Text style={s.tutorTxt}>🤖 wytłumacz</Text>
        </Touch>
      </View>

      <View style={s.body}>
        {phase === "feed" && level.feed[fi] ? (
          <Animated.View key={`f${fi}`} entering={FadeInRight.duration(220)} style={{ flex: 1 }}>
            <FeedCard item={level.feed[fi]!} tag={`${level.title} · ${fi + 1}/${level.feed.length}`} />
            <View style={s.foot}>
              <PillButton label={fi + 1 < level.feed.length ? "dalej →" : after("feed") === "result" ? "zakończ ✅" : `lecimy: ${phaseLabel[after("feed")]}`} onPress={nextFeed} />
            </View>
          </Animated.View>
        ) : null}

        {phase === "cards" && cards[ci] ? (
          <Animated.View key={`c${ci}`} entering={FadeIn.duration(200)} style={{ flex: 1 }}>
            <Flashcard term={cards[ci]!.t} def={cards[ci]!.d} tag={`fiszka ${ci + 1}/${cards.length}`} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
            <View style={[s.foot, { flexDirection: "row", gap: 10 }]}>
              <Touch onPress={() => gradeCard(false)} style={[s.fbtn, s.no]}>
                <Text style={[s.fbtnTxt, { color: "#ff7a99" }]}>jeszcze nie 😵</Text>
              </Touch>
              <Touch onPress={() => gradeCard(true)} style={[s.fbtn, s.yes]}>
                <Text style={[s.fbtnTxt, { color: "#7dffa6" }]}>umiem 💪</Text>
              </Touch>
            </View>
          </Animated.View>
        ) : null}

        {phase === "games" && games[gi] ? (
          <ScrollView key={`g${gi}`} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Animated.View entering={FadeInRight.duration(220)} style={s.gcard}>
              <Text style={s.gtag}>
                mini-gra {gi + 1}/{games.length} · {gameLabel(games[gi]!)}
              </Text>
              <MiniGameView game={games[gi]!} onDone={gameDone} />
            </Animated.View>
          </ScrollView>
        ) : null}

        {phase === "quiz" && q ? (
          <ScrollView key={`q${qi}`} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInRight.duration(220)}>
              <QuizCard q={q} picked={picked} reveal={picked !== null} onPick={pickQ} tag={`pytanie ${qi + 1}/${quiz.length}`}>
                {picked !== null ? <PillButton label={qi + 1 >= quiz.length ? "zobacz wynik 🏁" : "dalej →"} onPress={nextQ} style={{ marginTop: 14 }} /> : null}
              </QuizCard>
            </Animated.View>
          </ScrollView>
        ) : null}

        {phase === "result" && result ? (
          <ScrollView contentContainerStyle={[s.scroll, { flexGrow: 1, justifyContent: "center" }]} showsVerticalScrollIndicator={false}>
            <ResultView
              emoji={!result.passed ? "😵" : result.pct >= 90 ? "👑" : result.pct >= 70 ? "🔥" : "✅"}
              title={level.title}
              score={quiz.length ? <ScoreLine correct={score} total={quiz.length} extra={result.passed ? "⭐".repeat(result.stars) : undefined} /> : undefined}
              verdict={
                !result.passed
                  ? "Poniżej 50% — poziom niezaliczony. Błędne pytania wrócą w sesji „Dziś”. Przejedź feed jeszcze raz i spróbuj ponownie."
                  : result.pct >= 90
                    ? "Mistrzostwo. Trzy gwiazdki, profesor by płakał ze szczęścia."
                    : result.pct >= 70
                      ? "Solidnie! Poziom zaliczony, lecimy dalej."
                      : "Zaliczone na styk — błędne pytania wrócą w sesji „Dziś”."
              }
            >
              <View style={s.xpRow}>
                <Text style={s.xp}>⚡ +{result.gained + sideXp} xp</Text>
                {gameScore.total ? (
                  <Text style={s.xpMuted}>
                    🧩 gry {gameScore.correct}/{gameScore.total}
                  </Text>
                ) : null}
              </View>
              {result.passed ? <PillButton label="dalej na ścieżkę 🗺️" onPress={onClose} style={{ marginTop: 8 }} /> : <PillButton label="spróbuj jeszcze raz 🔁" onPress={retry} style={{ marginTop: 8 }} />}
              {result.passed ? <PillButton label="powtórz lekcję 🔁" ghost onPress={retry} /> : <PillButton label="wróć na ścieżkę" ghost onPress={onClose} />}
            </ResultView>
          </ScrollView>
        ) : null}
      </View>

      <TutorModal open={tutor} onClose={() => setTutor(false)} topicId={topic.id} levelId={level.id} levelTitle={level.title} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  phase: { color: C.muted, fontSize: 11.5, fontWeight: FONT.bold },
  tutorBtn: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, borderRadius: R.pill, paddingVertical: 8, paddingHorizontal: 12 },
  tutorTxt: { color: C.txt, fontWeight: FONT.bold, fontSize: 12.5 },
  body: { flex: 1, paddingHorizontal: 16 },
  foot: { paddingVertical: 12 },
  scroll: { paddingBottom: 40, paddingTop: 4 },
  fbtn: { flex: 1, padding: 15, borderRadius: 16, alignItems: "center", borderWidth: 1 },
  no: { backgroundColor: "#33222e", borderColor: "rgba(255,59,92,.25)" },
  yes: { backgroundColor: "#16331f", borderColor: "rgba(30,215,96,.25)" },
  fbtnTxt: { fontSize: 15, fontWeight: FONT.bold },
  gcard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 24, padding: 20 },
  gtag: { color: C.muted, fontSize: 11, fontWeight: FONT.bold, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 12 },
  xpRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  xp: { color: C.lime, fontWeight: FONT.black, fontSize: 18 },
  xpMuted: { color: C.muted, fontWeight: FONT.bold, fontSize: 14 },
});
