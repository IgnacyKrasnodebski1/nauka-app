import { DEFAULT_GRADING, XP, allQuiz, gradeFor, shuffle, type Grading, type QuizQuestion, type Topic } from "@nauka/shared";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QuizCard } from "@/components/QuizCard";
import { ResultView, ScoreLine } from "@/components/ResultView";
import { Body, Display, Label, Muted } from "@/components/Text";
import { Button, Card, MiniPill, ProgressBar } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { KEYS_ABC } from "@/lib/games";
import { COLORS, RADIUS, SPACE, UI, tabular } from "@/lib/theme";

interface Q extends QuizQuestion {
  lvl: string;
  levelId: string;
  topicId: string;
}
type Phase = "intro" | "run" | "result";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Egzamin z jednego tematu albo całego przedmiotu: N losowych (albo wszystkie) pytań na czas, ocena wg siatki. */
export function ExamTab({ topics }: { topics: Topic[] }) {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const multi = topics.length > 1;
  const grading: Grading = topics[0]?.grading ?? DEFAULT_GRADING;
  const all = useMemo<Q[]>(() => topics.flatMap((t) => allQuiz(t).map((q) => ({ ...q, lvl: multi ? `${t.name} · ${q.lvl}` : q.lvl, topicId: t.id }))), [topics, multi]);
  const N = Math.min(20, all.length);
  const lim = grading.examMin;
  const fullLim = Math.max(lim, Math.ceil(all.length * 0.75));
  const pass = grading.pass;

  const [phase, setPhase] = useState<Phase>("intro");
  const [pool, setPool] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>([]);
  const [left, setLeft] = useState(0);
  const [gained, setGained] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);
  const startedAt = useRef(0);

  const begin = (n: number, minutes: number) => {
    setPool(shuffle(all).slice(0, n));
    setPicks(new Array(n).fill(null));
    setIdx(0);
    setLeft(minutes * 60);
    finishedRef.current = false;
    startedAt.current = Date.now();
    setPhase("run");
  };

  useEffect(() => {
    if (phase !== "run") return;
    timer.current = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [phase]);

  const result = useMemo(() => {
    if (phase !== "result") return null;
    let correct = 0;
    const wrong: { q: Q; sel: number | null }[] = [];
    pool.forEach((q, i) => {
      if (picks[i] === q.c) correct++;
      else wrong.push({ q, sel: picks[i] ?? null });
    });
    const pct = pool.length ? Math.round((correct / pool.length) * 100) : 0;
    return { correct, wrong, pct, grade: gradeFor(pct, grading), passed: pct >= pass };
  }, [phase, pool, picks, grading, pass]);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (timer.current) clearInterval(timer.current);
    const byTopic = new Map<string, { correct: number; total: number; wrong: Map<string, number[]>; right: Map<string, number[]> }>();
    pool.forEach((q, i) => {
      const b = byTopic.get(q.topicId) ?? { correct: 0, total: 0, wrong: new Map(), right: new Map() };
      b.total++;
      const t = app.findTopic(q.topicId);
      const qi = t?.levels.find((l) => l.id === q.levelId)?.quiz.findIndex((x) => x.q === q.q) ?? -1;
      if (picks[i] === q.c) {
        b.correct++;
        if (qi >= 0) b.right.set(q.levelId, [...(b.right.get(q.levelId) ?? []), qi]);
      } else if (qi >= 0) b.wrong.set(q.levelId, [...(b.wrong.get(q.levelId) ?? []), qi]);
      byTopic.set(q.topicId, b);
    });
    let correct = 0;
    for (const b of byTopic.values()) correct += b.correct;
    const pct = pool.length ? Math.round((correct / pool.length) * 100) : 0;
    const passed = pct >= pass;
    let total = 0;
    for (const [topicId, b] of byTopic) {
      const p = app.progressFor(topicId);
      const firstPass = passed && !(p.bestExam && p.bestExam >= pass);
      const g = b.correct * 3 + (firstPass ? XP.examPass : 0);
      total += g;
      const next = { ...p, xp: p.xp + g };
      if (!p.bestExam || pct > p.bestExam) next.bestExam = pct;
      app.setProgressFor(topicId, next);
      for (const [levelId, wrongIdx] of b.wrong) app.setWeak(topicId, levelId, wrongIdx, b.right.get(levelId) ?? []);
      for (const [levelId, rightIdx] of b.right) if (!b.wrong.has(levelId)) app.setWeak(topicId, levelId, [], rightIdx);
    }
    setGained(total);
    app.logActivity(total, Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)));
    if (passed) haptic.heavy();
    else haptic.bad();
    setPhase("result");
  };

  useEffect(() => {
    if (phase === "run" && left <= 0) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase]);

  const pad = { paddingBottom: 60 + insets.bottom };

  if (phase === "intro" || !all.length) {
    const best = multi ? undefined : app.progressFor(topics[0]?.id ?? "").bestExam;
    return (
      <ScrollView contentContainerStyle={[s.scroll, pad]} showsVerticalScrollIndicator={false}>
        <Card>
          <Label>{multi ? "egzamin z przedmiotu" : "egzamin"}</Label>
          <Display size="xl" weight={700} style={{ marginTop: SPACE[2] }}>
            {multi ? `Pytania ze wszystkich ${topics.length} tematów` : "Symulacja sprawdzianu"}
          </Display>
          <Body color={COLORS.muted} style={{ marginTop: SPACE[2] }}>
            Bez podpowiedzi w trakcie. Na końcu procent, ocena wg siatki i przegląd błędów.
          </Body>
          <View style={s.specs}>
            <MiniPill value={N} label="pytań" />
            <MiniPill value={`${lim}:00`} label="czas" />
            <MiniPill value={`${pass}%`} label="zalicza" />
          </View>
          {best ? (
            <Muted size="xs" weight={600} color={COLORS.accent} style={{ marginBottom: SPACE[3] }}>
              Twój rekord: {best}% · ocena {gradeFor(best, grading)}
            </Muted>
          ) : null}
          <View style={{ gap: SPACE[2] }}>
            <Button label={`Symulacja — ${N} losowych`} onPress={() => begin(N, lim)} disabled={!all.length} />
            <Button label={`Test końcowy — wszystkie ${all.length}`} variant="secondary" onPress={() => begin(all.length, fullLim)} disabled={!all.length} />
          </View>
          <Muted size="xs" style={{ marginTop: SPACE[3] }}>
            Test końcowy = każde pytanie, w losowej kolejności ({fullLim}:00).
          </Muted>
        </Card>
      </ScrollView>
    );
  }

  if (phase === "result" && result) {
    return (
      <ScrollView contentContainerStyle={[s.scroll, pad]} showsVerticalScrollIndicator={false}>
        <Card>
          <ResultView eyebrow={result.passed ? "zdane" : "niezaliczone"} title={`Ocena ${result.grade}`} xp={gained} score={<ScoreLine correct={result.correct} total={pool.length} />} verdict={result.passed ? "Błędne pytania wrócą w sesji „Dziś”." : "Poniżej progu — błędne pytania wrócą w sesji „Dziś”."} celebrate={result.passed}>
            <Button label="Jeszcze raz" variant="secondary" onPress={() => setPhase("intro")} />
          </ResultView>
        </Card>
        <Label style={{ marginTop: SPACE[6], marginBottom: SPACE[3] }}>przegląd błędów · {result.wrong.length}</Label>
        {result.wrong.length === 0 ? (
          <Body color={COLORS.success}>Zero błędów.</Body>
        ) : (
          result.wrong.map((w, i) => (
            <View key={i} style={s.ritem}>
              <Body weight={600} color={COLORS.text}>
                {w.q.q}
              </Body>
              <Body size="sm" color={COLORS.danger}>
                Twoja: {w.sel == null ? "— (brak)" : `${KEYS_ABC[w.sel]}. ${w.q.a[w.sel]}`}
              </Body>
              <Body size="sm" color={COLORS.success}>
                Dobra: {KEYS_ABC[w.q.c]}. {w.q.a[w.q.c]}
              </Body>
              <Muted size="xs">
                {w.q.lvl} · {w.q.e}
              </Muted>
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  const q = pool[idx];
  if (!q) return null;
  const last = idx + 1 >= pool.length;
  return (
    <ScrollView contentContainerStyle={[s.scroll, pad]} showsVerticalScrollIndicator={false}>
      <View style={s.examhead}>
        <Muted size="xs" weight={600} style={tabular}>
          PYTANIE {idx + 1}/{pool.length}
        </Muted>
        <View style={[s.timer, left <= 60 && { borderColor: COLORS.danger }]}>
          <Display size="base" weight={700} color={left <= 60 ? COLORS.danger : COLORS.text} style={tabular}>
            {fmt(Math.max(0, left))}
          </Display>
        </View>
      </View>
      <ProgressBar pct={(idx / pool.length) * 100} style={{ marginBottom: SPACE[3] }} />
      <QuizCard q={q} picked={picks[idx] ?? null} reveal={false} onPick={(i) => setPicks((p) => p.map((v, k) => (k === idx ? i : v)))} tag={q.lvl}>
        <View style={s.nav}>
          {idx > 0 ? <Button label="Wstecz" variant="secondary" onPress={() => setIdx(idx - 1)} style={{ flex: 1 }} /> : null}
          <Button label={last ? "Zakończ i sprawdź" : "Dalej"} onPress={() => (last ? finish() : setIdx(idx + 1))} style={{ flex: 2 }} />
        </View>
      </QuizCard>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: UI.gutter },
  specs: { flexDirection: "row", gap: SPACE[2], flexWrap: "wrap", marginVertical: SPACE[4] },
  examhead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE[3] },
  timer: { backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.pill, paddingVertical: 6, paddingHorizontal: 12 },
  nav: { flexDirection: "row", gap: SPACE[2], marginTop: SPACE[4] },
  ritem: { paddingVertical: SPACE[3], gap: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.lineStrong },
});
