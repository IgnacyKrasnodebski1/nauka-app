import { GHOST_TICK_MS, GHOST_WIN_XP, QUIZ_XP, TASK_XP, applyQuizResult, comboXp, ghostFinish, ghostRun, ghostStatus, ghostWhen, levelGems, levelProgress, levelSession, recordStep, todayStr, type GhostResult, type GhostStep, type Level, type LevelSessionItem, type QuizQuestion, type Topic } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { AccentProvider } from "@/components/Accent";
import { HtmlText } from "@/components/HtmlText";
import { Icon } from "@/components/Icon";
import { Bar, Confetti, Motion } from "@/components/Motion";
import { QuizBlock, QuizFootProvider } from "@/components/QuizBlock";
import { ExplainSheet, NoHeartsSheet, SheetBad, SheetOk, SourceSheet, type Feedback, type QCtx } from "@/components/Sheets";
import { TaskView } from "@/components/tasks";
import { Body, Display, Eyebrow, Muted, Num } from "@/components/Text";
import { Blob, Btn, Card, Empty, IconTile, Loading, Pill, Press, RoundBtn, Screen, SegBar, Tag, useTop } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { overridesFor } from "@/lib/extra";
import { minutesSince, noEmoji, nowMs, npl } from "@/lib/format";
import { play } from "@/lib/sfx";
import { T, TONES } from "@/lib/theme";
import { topicShort } from "@/lib/topic-view";

type Phase = "feed" | "quiz" | "done";
interface LS {
  phase: Phase;
  feedIdx: number;
  items: LevelSessionItem[];
  qIdx: number;
  score: number;
  combo: number;
  maxCombo: number;
  broken: boolean;
  xp: number;
  marks: Record<number, "bad">;
  run: GhostStep[];
  t0: number | null;
  wrongQ: number[];
  rightQ: number[];
  startedAt: number;
}
interface SheetState {
  ok: boolean;
  fb: Feedback;
  xp: number;
  mult: number;
  combo: number;
  q?: QuizQuestion;
  qi?: number;
}
interface Result {
  pct: number;
  stars: 0 | 1 | 2 | 3;
  passed: boolean;
  xp: number;
  gems: number;
  ghost: GhostResult | null;
}

/** Lekcja poziomu: roladka (Lesson.html) → pytania i zadania w jednym strumieniu (Quiz.html) → LevelComplete.html. */
export default function LessonScreen() {
  const { topicId, levelId } = useLocalSearchParams<{ topicId: string; levelId: string }>();
  const app = useApp();
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null | undefined>(app.findTopic(topicId ?? ""));
  useEffect(() => {
    let alive = true;
    if (topicId && app.ready && !topic) app.getTopic(topicId).then((t) => alive && setTopic(t));
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
      <Screen>
        <Empty icon="alert" title="Nie ma takiego poziomu" action={<Btn label="Wróć" onPress={close} />} />
      </Screen>
    );
  const subject = app.findSubject(topic.subjectId);
  return (
    <AccentProvider color={subject?.accent2 ?? topic.accent2} seed={subject?.name ?? topic.name}>
      <Lesson key={level.id} topic={topic} level={level} onClose={close} />
    </AccentProvider>
  );
}

function Lesson({ topic, level, onClose }: { topic: Topic; level: Level; onClose: () => void }) {
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const ghostRec = app.progressFor(topic.id).ghost?.[level.id];
  const ghost = ghostRun(ghostRec);
  const init = (): LS => ({ phase: level.feed.length ? "feed" : "quiz", feedIdx: 0, items: levelSession(level, { overrides: overridesFor(app.extra.overrides, topic.id, level.id) }), qIdx: 0, score: 0, combo: 0, maxCombo: 0, broken: false, xp: 0, marks: {}, run: [], t0: null, wrongQ: [], rightQ: [], startedAt: nowMs() });
  const [ls, setLs] = useState<LS>(init);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [explain, setExplain] = useState<QCtx | null>(null);
  const [src, setSrc] = useState<QCtx | null>(null);
  const [noHearts, setNoHearts] = useState<null | { resume: () => void }>(() => (app.canStartLesson ? null : { resume: () => {} }));
  const [result, setResult] = useState<Result | null>(null);
  const [foot, setFoot] = useState<React.ReactNode>(null);
  const [minus, setMinus] = useState(0);
  const [conf, setConf] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const subject = app.findSubject(topic.subjectId);
  const totalFeed = level.feed.length;
  const steps = totalFeed + ls.items.length;
  const curStep = ls.phase === "feed" ? ls.feedIdx : totalFeed + ls.qIdx;

  const t0 = ls.t0;
  useEffect(() => {
    if (ls.phase !== "quiz" || !ghost.length || t0 == null) return;
    const id = setInterval(() => setElapsed(nowMs() - t0), GHOST_TICK_MS);
    return () => clearInterval(id);
  }, [ls.phase, ghost.length, t0]);

  const finish = (l: LS) => {
    if (l.phase === "done") return;
    const total = l.items.length;
    const pct = total ? Math.round((l.score / total) * 100) : 100;
    const prevP = app.progressFor(topic.id);
    const prev = levelProgress(prevP, level.id);
    const r = applyQuizResult(prevP, level.id, total ? l.score : 1, total || 1);
    let xp = l.xp;
    let gems = 0;
    app.setProgressFor(topic.id, r.progress, r.passed ? r.gained : 0);
    if (r.passed) {
      xp += r.gained;
      gems = levelGems(r.stars);
      app.addGems(gems);
      app.completeDaily(topic.subjectId, "lesson", level.id);
      app.markTestDone(topic.subjectId, "learn");
      app.questEvent({ type: "level", perfect: pct === 100 });
      app.histAdd("levels", 1);
      app.bumpStats((s) => ({ levelsDone: s.levelsDone + (prev.done ? 0 : 1), perfectLevels: s.perfectLevels + (pct === 100 ? 1 : 0) }));
      play("levelup");
      haptic.heavy();
    } else play("wrong");
    app.histMax("combo", l.maxCombo);
    app.bumpStats((s) => ({ comboBest: Math.max(s.comboBest, l.maxCombo) }));
    app.setWeak(topic.id, level.id, l.wrongQ, l.rightQ);
    app.logActivity(0, Math.max(1, minutesSince(l.startedAt)));
    let gh: GhostResult | null = null;
    if (l.run.length && total) {
      gh = ghostFinish(ghostRec, l.run, r.passed, total, todayStr());
      if (gh.kind === "saved" || gh.kind === "win") app.setGhost(topic.id, level.id, gh.record);
      if (gh.kind === "win") xp += app.addXp(topic.id, GHOST_WIN_XP);
      if (gh.kind === "none") gh = null;
    }
    setSheet(null);
    setLs({ ...l, phase: "done" });
    setResult({ pct, stars: r.stars, passed: r.passed, xp, gems, ghost: gh });
  };

  const nextItem = () => {
    setSheet(null);
    const n: LS = { ...ls, qIdx: ls.qIdx + 1 };
    if (n.qIdx >= n.items.length) finish(n);
    else setLs(n);
  };

  const onAnswer = (ok: boolean, fb: Feedback, item: LevelSessionItem) => {
    const n: LS = { ...ls, broken: false, marks: { ...ls.marks }, wrongQ: [...ls.wrongQ], rightQ: [...ls.rightQ] };
    if (n.t0 == null) n.t0 = nowMs();
    n.run = recordStep(ls.run, ok, n.t0);
    const qi = item.kind === "quiz" ? item.qi : undefined;
    if (item.kind === "quiz") (ok ? n.rightQ : n.wrongQ).push(item.qi);
    if (ok) {
      n.score++;
      n.combo++;
      n.maxCombo = Math.max(n.maxCombo, n.combo);
      const base = item.kind === "quiz" ? QUIZ_XP : TASK_XP;
      const c = comboXp(base, n.combo);
      const got = app.addXp(topic.id, c.xp);
      n.xp += got;
      app.questEvent({ type: "answer", correct: true, combo: n.combo });
      if (item.kind === "task") app.questEvent({ type: "task", won: true, timed: item.task.type === "tf" && !!item.task.seconds, perfect: true });
      setConf((k) => k + 1);
      setSheet({ ok: true, fb, xp: got, mult: c.mult, combo: n.combo, q: item.kind === "quiz" ? item.q : undefined, qi });
    } else {
      n.broken = ls.combo >= 2;
      n.combo = 0;
      n.marks[totalFeed + ls.qIdx] = "bad";
      app.loseHeart();
      app.questEvent({ type: "answer", correct: false, combo: 0 });
      if (item.kind === "task") app.questEvent({ type: "task", won: false });
      setMinus((k) => k + 1);
      setSheet({ ok: false, fb, xp: 0, mult: 1, combo: 0, q: item.kind === "quiz" ? item.q : undefined, qi });
    }
    setLs(n);
  };

  const afterBad = () => {
    if (app.hearts.hearts <= 0 && !app.hearts.unlimited) {
      setSheet(null);
      setNoHearts({ resume: nextItem });
    } else nextItem();
  };
  const restart = () => {
    setLs(init());
    setResult(null);
    setSheet(null);
    setFoot(null);
    setMinus(0);
    setElapsed(0);
    if (!app.canStartLesson) setNoHearts({ resume: () => {} });
  };
  const feedNext = () => {
    if (ls.feedIdx + 1 < totalFeed) setLs({ ...ls, feedIdx: ls.feedIdx + 1 });
    else if (ls.items.length) setLs({ ...ls, phase: "quiz" });
    else return finish(ls);
    haptic.tap();
  };
  const feedPrev = () => {
    if (ls.feedIdx > 0) setLs({ ...ls, feedIdx: ls.feedIdx - 1 });
  };
  const ctx = (qi?: number, q?: QuizQuestion): QCtx => ({ topic, level, qi, q });
  const edit = (qi: number) => router.push({ pathname: "/edit-question", params: { topicId: topic.id, levelId: level.id, qi: String(qi) } });

  /* ---------- LevelComplete ---------- */
  if (result) {
    const n = app.streak;
    const plan = app.planItems;
    const dd = plan.filter((p) => p.task.done).length;
    const gh = result.ghost;
    return (
      <Screen scroll pad={false} bottom={26} blob={<Blob tone={result.passed ? "acid" : "red"} size={340} top={60} center />}>
        {result.passed ? <Confetti n={7} colors={[T.pink, T.cyan, T.gold, T.acid]} top={80} /> : null}
        <View style={[s.done, { paddingTop: top + 30 }]}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
            {([1, 0, 2] as const).map((k, i) => {
              const on = result.stars >= (i === 1 ? 1 : i === 0 ? 2 : 3);
              return (
                <Motion key={k} kind="pop" d={k}>
                  <Icon name="star" size={i === 1 ? 46 : 34} fill={on} stroke={2} color={on ? T.gold : T.line2} />
                </Motion>
              );
            })}
          </View>
          <Motion kind="pop" d={2}>
            <View style={[s.bigTile, { backgroundColor: result.passed ? T.acid : T.red, shadowColor: result.passed ? T.acidDark : T.redDark }]}>
              <Icon name={result.passed ? "check" : "close"} size={result.passed ? 66 : 60} stroke={3.3} color={result.passed ? T.onAcid : T.onRed} />
            </View>
          </Motion>
          <Motion kind="up" d={3} style={{ alignItems: "center" }}>
            <Display size={36} ls={-1.3} center lh={38}>
              {result.passed ? "Poziom zaliczony!" : "Poziom niezaliczony"}
            </Display>
            <Muted size={14.5} weight={700} center style={{ marginTop: 8 }}>
              {subject ? noEmoji(subject.name) : topicShort(topic)} · {noEmoji(level.title)}
            </Muted>
          </Motion>
          <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
            {(
              [
                ["XP", `+${result.xp}`, T.gold, 4],
                ["Celność", `${result.pct}%`, T.acid, 5],
                ["Combo", `x${ls.maxCombo}`, T.pink, 6],
              ] as [string, string, string, number][]
            ).map(([k, v, c, d]) => (
              <Motion key={k} kind="up" d={d} style={{ flex: 1 }}>
                <Card padding={0} radius={20} drop={4}>
                  <View style={{ paddingVertical: 14, paddingHorizontal: 10, alignItems: "center" }}>
                    <Eyebrow size={10}>{k}</Eyebrow>
                    <Num size={26} color={c} style={{ marginTop: 4 }}>
                      {v}
                    </Num>
                  </View>
                </Card>
              </Motion>
            ))}
          </View>
          {result.gems || app.boostActive ? (
            <Motion kind="up" d={5} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {result.gems ? (
                <View style={[s.reward, { backgroundColor: TONES.cyan.tint, borderColor: TONES.cyan.tintLine }]}>
                  <Icon name="gem" size={15} color={T.cyan} />
                  <Body size={12.5} weight={800} color={TONES.cyan.txt}>
                    +{result.gems} {npl(result.gems, "gem", "gemy", "gemów").replace(/^\d+ /, "")}
                  </Body>
                </View>
              ) : null}
              {app.boostActive ? (
                <View style={[s.reward, { backgroundColor: TONES.gold.tint, borderColor: TONES.gold.tintLine }]}>
                  <Icon name="bolt" size={15} color={T.gold} />
                  <Body size={12.5} weight={800} color={TONES.gold.txt}>
                    podwójne XP
                  </Body>
                </View>
              ) : null}
            </Motion>
          ) : null}
          {gh && gh.kind !== "none" ? (
            <Motion kind="up" d={5} style={{ alignSelf: "stretch" }}>
              <Card tone={gh.kind === "win" ? "acid" : gh.kind === "lose" ? "red" : "violet"} padding={14} radius={20} drop={4}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <IconTile icon={gh.kind === "win" ? "bolt" : "ghost"} size={44} tone={gh.kind === "win" ? "acid" : gh.kind === "lose" ? "red" : "violet"} />
                  <View style={{ flex: 1 }}>
                    <Body size={14} weight={800}>
                      {gh.title}
                    </Body>
                    <Muted size={12} lh={16} style={{ marginTop: 2 }}>
                      {gh.sub}
                    </Muted>
                  </View>
                </View>
              </Card>
            </Motion>
          ) : null}
          {!result.passed ? (
            <Muted size={13} center lh={19}>
              Poniżej 50%. Przejrzyj roladkę jeszcze raz i spróbuj ponownie.
            </Muted>
          ) : null}
          <Motion kind="up" d={6} style={{ alignSelf: "stretch" }}>
            <Press onPress={() => router.push("/streak")} drop={4} edge={TONES.amber.tintShadow} radius={22} faceStyle={s.streak} accessibilityLabel="Seria">
              <IconTile icon="flame" size={44} color={T.flame} on={T.onAmber} />
              <View style={{ flex: 1 }}>
                <Body size={15} weight={800}>
                  {n} {npl(n, "dzień", "dni", "dni").replace(/^\d+ /, "")} z rzędu
                </Body>
                <Muted size={12.5} color={TONES.amber.sub} style={{ marginTop: 2 }}>
                  {plan.length && dd >= plan.length ? "Plan dnia zrobiony" : `Plan dnia: ${dd} z ${plan.length}`}
                </Muted>
              </View>
              <Icon name="chevron-right" size={20} color={TONES.amber.sub} />
            </Press>
          </Motion>
          <View style={{ flex: 1 }} />
          <View style={{ alignSelf: "stretch", gap: 10 }}>
            <Btn label={result.passed ? "Dalej" : "Spróbuj jeszcze raz"} glow onPress={result.passed ? onClose : restart} />
            <Btn label={result.passed ? (ghost.length || result.ghost ? "Pobij swój wynik" : "Powtórz poziom") : "Wróć na ścieżkę"} variant="text" onPress={result.passed ? restart : onClose} />
          </View>
        </View>
      </Screen>
    );
  }

  const item = ls.items[ls.qIdx];
  const gs = ls.phase === "quiz" && ghost.length ? ghostStatus(ghost, ls.run, ls.qIdx, elapsed, ls.items.length) : null;

  /* ---------- roladka ---------- */
  const pan = Gesture.Pan()
    .activeOffsetY([-30, 30])
    .failOffsetX([-40, 40])
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationY < -70) feedNext();
      else if (e.translationY > 70) feedPrev();
    });
  return (
    <Screen pad={false} blob={<Blob tone={ls.phase === "feed" ? "cyan" : "violet"} size={ls.phase === "feed" ? 320 : 280} top={ls.phase === "feed" ? 120 : -90} right={ls.phase === "feed" ? -120 : undefined} left={ls.phase === "feed" ? undefined : -80} />}>
      <View style={[s.head, { paddingTop: top }]}>
        <RoundBtn icon="close" onPress={onClose} label="Zamknij lekcję" />
        <SegBar total={steps} done={curStep} marks={ls.marks} color={ls.phase === "feed" ? T.acid : undefined} />
        {ls.phase === "feed" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="bolt" size={15} color={T.gold} />
            <Body size={13.5} weight={800} color={T.gold}>
              +{ls.xp}
            </Body>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {minus ? (
              <Motion key={minus} kind="blink">
                <Body size={13} weight={800} color={T.red}>
                  −1
                </Body>
              </Motion>
            ) : null}
            <Pill kind="hearts" value={app.hearts.unlimited ? "∞" : app.hearts.hearts} beat={!!minus} />
          </View>
        )}
      </View>
      {ls.phase === "feed" ? (
        <>
          <GestureDetector gesture={pan}>
            <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 18 }}>
              <Motion key={ls.feedIdx} kind="up" style={{ flex: 1 }}>
                <FeedCard f={level.feed[ls.feedIdx]!} idx={ls.feedIdx} total={totalFeed} />
              </Motion>
            </View>
          </GestureDetector>
          <View style={s.foot}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Motion kind="bob">
                <Icon name="arrow-up" size={16} color={T.disabledTxt} />
              </Motion>
              <Muted size={12} weight={700} color={T.disabledTxt}>
                przesuń w górę, żeby przejść dalej
              </Muted>
            </View>
            <Btn label={ls.feedIdx + 1 >= totalFeed ? (ls.items.length ? "Czas na pytania" : "Zakończ") : "Kontynuuj"} glow onPress={feedNext} />
          </View>
        </>
      ) : item ? (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 20, paddingBottom: 20, gap: 14 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {conf ? <Confetti key={conf} n={4} colors={[T.acid, T.gold, T.pink, T.cyan]} top={30} /> : null}
            {gs && ghostRec ? <GhostCard you={ls.qIdx} ghostIdx={gs.ghostIdx} total={ls.items.length} state={gs.state} text={gs.text} when={ghostWhen(ghostRec.at, todayStr())} name={app.displayName} /> : null}
            <QuizFootProvider value={setFoot}>
              {item.kind === "quiz" ? (
                <QuizBlock key={item.id} q={item.q} n={ls.qIdx + 1} total={ls.items.length} combo={ls.combo} broken={ls.broken} boost={app.boostActive} onAnswer={(i, ok) => onAnswer(ok, { e: item.q.e }, item)} />
              ) : item.kind === "task" ? (
                <View style={{ minHeight: 400 }}>
                  <TaskView key={item.id} task={item.task} n={ls.qIdx + 1} total={ls.items.length} combo={ls.combo} broken={ls.broken} boost={app.boostActive} onFinish={(ok, fb) => onAnswer(ok, fb, item)} onHintXp={(n) => app.addXp(topic.id, -n)} onSource={item.task.src ? () => setSrc(ctx()) : undefined} />
                </View>
              ) : null}
            </QuizFootProvider>
          </ScrollView>
          {foot ? <View style={s.foot}>{foot}</View> : null}
        </>
      ) : null}
      {sheet ? (
        sheet.ok ? (
          <SheetOk open fb={sheet.fb} xp={sheet.xp} mult={sheet.mult} combo={sheet.combo} onNext={nextItem} q={sheet.q} onSource={sheet.q?.src ? () => setSrc(ctx(sheet.qi, sheet.q)) : undefined} />
        ) : (
          <SheetBad open fb={sheet.fb} q={sheet.q} onNext={afterBad} onExplain={() => setExplain(ctx(sheet.qi, sheet.q))} onEdit={sheet.qi != null ? () => edit(sheet.qi!) : undefined} onSource={sheet.q?.src ? () => setSrc(ctx(sheet.qi, sheet.q)) : undefined} />
        )
      ) : null}
      <ExplainSheet open={!!explain} ctx={explain} onClose={() => setExplain(null)} />
      <SourceSheet open={!!src} q={src?.q} ctx={src} onClose={() => setSrc(null)} onEdit={src?.qi != null ? () => { const qi = src.qi!; setSrc(null); edit(qi); } : undefined} />
      <NoHeartsSheet open={!!noHearts} onLeave={() => { setNoHearts(null); onClose(); }} onResume={() => { const n = noHearts; setNoHearts(null); n?.resume(); }} onCards={() => router.replace({ pathname: "/s/[subjectId]/cards", params: { subjectId: topic.subjectId, topicId: topic.id, levelId: level.id, heal: "1" } })} />
    </Screen>
  );
}

/** Karta mikro-dawki (Lesson.html): tag, tytuł, treść, „Po ludzku”, „Mnemo”. */
function FeedCard({ f, idx, total }: { f: Level["feed"][number]; idx: number; total: number }) {
  return (
    <View style={s.fcardWrap}>
      <ScrollView contentContainerStyle={s.fcard} showsVerticalScrollIndicator={false}>
        <Tag label={`Mikro-dawka ${idx + 1}/${total}`} tone="accent" />
        <Display size={28} ls={-0.9} lh={31}>
          {noEmoji(f.title)}
        </Display>
        <HtmlText html={f.body} inline textStyle={{ fontSize: 15.5, lineHeight: 24, color: T.txt2 }} />
        {f.real ? (
          <Motion kind="up" d={2} style={[s.box, { backgroundColor: TONES.cyan.tint, borderColor: TONES.cyan.tintLine }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Icon name="bulb" size={16} color={T.cyan} />
              <Eyebrow size={10.5} color={T.cyan}>
                Po ludzku
              </Eyebrow>
            </View>
            <HtmlText html={f.real} inline textStyle={{ fontSize: 14.5, lineHeight: 22, color: TONES.cyan.txt, marginTop: 7 }} boldColor={T.txt} />
          </Motion>
        ) : null}
        {f.mnemo ? (
          <Motion kind="up" d={3} style={[s.box, { backgroundColor: TONES.gold.tint, borderColor: TONES.gold.tintLine }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Icon name="bookmark" size={16} color={T.gold} />
              <Eyebrow size={10.5} color={T.gold}>
                Mnemo
              </Eyebrow>
            </View>
            <HtmlText html={f.mnemo} inline textStyle={{ fontSize: 15, lineHeight: 22, color: "#FFD98A", fontWeight: "800", letterSpacing: 0.5, marginTop: 7 }} boldColor="#FFD98A" />
          </Motion>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Karta ducha (Ghost.html): Ty vs „Ty z wtorku”, paski, komentarz prowadzenia. */
function GhostCard({ you, ghostIdx, total, state, text, when, name }: { you: number; ghostIdx: number; total: number; state: "lead" | "behind" | "tie"; text: string; when: string; name: string | null }) {
  const ini = (name ?? "Ty").trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "TY";
  return (
    <Motion kind="up">
      <Card padding={16} radius={24} drop={5}>
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={[s.av, { backgroundColor: T.acid }]}>
              <Body size={14} weight={800} color={T.onAcid}>
                {ini}
              </Body>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Body size={13} weight={800}>
                  Ty
                </Body>
                <Body size={12} weight={800} color={T.muted}>
                  {you} / {total}
                </Body>
              </View>
              <Bar pct={(you / total) * 100} color={T.acid} height={12} style={{ marginTop: 6 }} animate={false} />
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: 0.7 }}>
            <View style={[s.av, { backgroundColor: T.violet }]}>
              <Icon name="ghost" size={22} color={T.onViolet} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Body size={13} weight={800}>
                  Ty z {when}
                </Body>
                <Body size={12} weight={800} color={T.muted}>
                  {ghostIdx} / {total}
                </Body>
              </View>
              <Bar pct={(ghostIdx / total) * 100} color={T.violet} height={12} style={{ marginTop: 6 }} animate={false} />
            </View>
          </View>
        </View>
      </Card>
      <View style={[s.ghnote, state === "lead" ? { backgroundColor: TONES.acid.tint, borderColor: TONES.acid.tintLine } : { backgroundColor: TONES.violet.tint, borderColor: TONES.violet.tintLine }]}>
        <Motion kind={state === "lead" ? "pulse" : "none"}>
          <Icon name={state === "lead" ? "bolt" : "ghost"} size={18} color={state === "lead" ? T.acid : T.violet} />
        </Motion>
        <Body size={13} weight={700} color={state === "lead" ? "#D9F5BC" : TONES.violet.txt} style={{ flex: 1 }} lh={18}>
          {text}
        </Body>
      </View>
    </Motion>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18 },
  foot: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 26, gap: 12 },
  fcardWrap: { flex: 1, backgroundColor: T.shadow, borderRadius: 28, paddingBottom: 6 },
  fcard: { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 28, paddingVertical: 22, paddingHorizontal: 20, gap: 16, flexGrow: 1 },
  box: { borderWidth: 2, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  done: { flex: 1, paddingHorizontal: 22, alignItems: "center", gap: 18 },
  bigTile: { width: 132, height: 132, borderRadius: 66, alignItems: "center", justifyContent: "center", shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 8 } },
  reward: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 2, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  streak: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: TONES.amber.tint, borderWidth: 2, borderColor: TONES.amber.tintLine, paddingVertical: 14, paddingHorizontal: 16 },
  av: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  ghnote: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 2, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 14, marginTop: 10 },
});
