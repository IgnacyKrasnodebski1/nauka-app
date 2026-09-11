import { DEFAULT_GRADING, XP, allQuiz, gradeFor, shuffle, type Grading, type QuizQuestion, type Topic } from "@nauka/shared";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QuizCard } from "@/components/QuizCard";
import { ResultView, ScoreLine } from "@/components/ResultView";
import { PillButton, ProgressBar, Spec } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { KEYS_ABC } from "@/lib/games";
import { C, FONT, R } from "@/lib/theme";

interface Q extends QuizQuestion {
  lvl: string;
  levelId: string;
  topicId: string;
}
type Phase = "intro" | "run" | "result";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Egzamin z jednego tematu albo całego przedmiotu (`topics` > 1 → `pickExam`-style losowanie po wszystkich tematach).
 * N losowych (albo wszystkie) pytań na czas, bez podpowiedzi, ocena wg `grading.scale` (gradeFor).
 */
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
    // per-topic: poprawne, błędne (→ weak), XP
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
    let gained = 0;
    for (const [topicId, b] of byTopic) {
      const p = app.progressFor(topicId);
      const firstPass = passed && !(p.bestExam && p.bestExam >= pass);
      const g = b.correct * 3 + (firstPass ? XP.examPass : 0);
      gained += g;
      const next = { ...p, xp: p.xp + g };
      if (!p.bestExam || pct > p.bestExam) next.bestExam = pct;
      app.setProgressFor(topicId, next);
      for (const [levelId, wrongIdx] of b.wrong) app.setWeak(topicId, levelId, wrongIdx, b.right.get(levelId) ?? []);
      for (const [levelId, rightIdx] of b.right) if (!b.wrong.has(levelId)) app.setWeak(topicId, levelId, [], rightIdx);
    }
    app.logActivity(gained, Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)));
    app.showToast(passed ? `zdane! ocena ${gradeFor(pct, grading)} 🎉 +${gained}xp` : "niezaliczone 💀");
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
        <ResultView emoji="🎯" title={multi ? "Egzamin z przedmiotu" : "Egzamin"} verdict={multi ? `Pytania ze wszystkich ${topics.length} tematów. Bez podpowiedzi, na końcu ocena wg siatki + przegląd błędów.` : "Bez podpowiedzi w trakcie. Na końcu % i ocena wg siatki + przegląd błędów."}>
          <View style={s.specs}>
            <Spec value={N} label="losowych" />
            <Spec value={`${lim}:00`} label="na czas" />
            <Spec value={`${pass}%`} label="zalicza" />
          </View>
          {best ? <Text style={s.best}>Twój rekord: {best}% · ocena {gradeFor(best, grading)}</Text> : null}
          <PillButton label={`symulacja — ${N} losowych 🎲`} onPress={() => begin(N, lim)} disabled={!all.length} style={{ marginTop: 8 }} />
          <PillButton label={`📋 test końcowy — WSZYSTKIE ${all.length} pytań`} ghost onPress={() => begin(all.length, fullLim)} disabled={!all.length} />
          <Text style={s.note}>Test końcowy = każde pytanie, w losowej kolejności ({fullLim}:00).</Text>
        </ResultView>
      </ScrollView>
    );
  }

  if (phase === "result" && result) {
    const emoji = result.pct >= 90 ? "👑" : result.pct >= 70 ? "🔥" : result.passed ? "😮‍💨" : "💀";
    return (
      <ScrollView contentContainerStyle={[s.scroll, pad]} showsVerticalScrollIndicator={false}>
        <ResultView emoji={emoji} title={`Ocena: ${result.grade}`} score={<ScoreLine correct={result.correct} total={pool.length} />} verdict={result.passed ? "Zdane! 🎉 Błędne pytania wrócą w sesji „Dziś”." : "Poniżej progu — błędne pytania wrócą w sesji „Dziś”."}>
          <PillButton label="jeszcze raz 🔁" onPress={() => setPhase("intro")} style={{ marginTop: 6 }} />
        </ResultView>
        <Text style={s.reviewH}>Przegląd błędów ({result.wrong.length})</Text>
        {result.wrong.length === 0 ? (
          <View style={s.ritem}>
            <Text style={[s.rgood, { fontWeight: FONT.bold }]}>Zero błędów. Clean sweep 🧼</Text>
          </View>
        ) : (
          result.wrong.map((w, i) => (
            <View key={i} style={s.ritem}>
              <Text style={s.rq}>{w.q.q}</Text>
              <Text style={s.rbad}>Twoja: {w.sel == null ? "— (brak)" : `${KEYS_ABC[w.sel]}. ${w.q.a[w.sel]}`}</Text>
              <Text style={s.rgood}>
                Dobra: {KEYS_ABC[w.q.c]}. {w.q.a[w.q.c]}
              </Text>
              <Text style={s.rsrc}>
                {w.q.lvl} · {w.q.e}
              </Text>
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
        <Text style={s.counter}>
          Pytanie {idx + 1}/{pool.length}
        </Text>
        <View style={[s.timer, left <= 60 && { borderColor: C.red }]}>
          <Text style={[s.timerTxt, left <= 60 && { color: C.red }]}>⏱ {fmt(Math.max(0, left))}</Text>
        </View>
      </View>
      <ProgressBar pct={(idx / pool.length) * 100} style={{ marginBottom: 12 }} />
      <QuizCard q={q} picked={picks[idx] ?? null} reveal={false} onPick={(i) => setPicks((p) => p.map((v, k) => (k === idx ? i : v)))} tag={q.lvl}>
        <View style={s.nav}>
          {idx > 0 ? <PillButton label="← wstecz" ghost onPress={() => setIdx(idx - 1)} style={{ flex: 1 }} /> : null}
          <PillButton label={last ? "zakończ i sprawdź 🏁" : "dalej →"} onPress={() => (last ? finish() : setIdx(idx + 1))} style={{ flex: 2 }} />
        </View>
      </QuizCard>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 16 },
  specs: { flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "center", marginVertical: 4 },
  best: { color: C.lime, fontWeight: FONT.bold, fontSize: 14 },
  note: { color: C.muted, fontSize: 13, textAlign: "center", lineHeight: 18 },
  examhead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  counter: { color: C.muted, fontWeight: FONT.bold, fontSize: 13 },
  timer: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, borderRadius: R.pill, paddingVertical: 7, paddingHorizontal: 13 },
  timerTxt: { color: C.txt, fontWeight: FONT.black, fontSize: 16 },
  nav: { flexDirection: "row", gap: 10, marginTop: 16 },
  reviewH: { color: C.muted, fontSize: 14, fontWeight: FONT.bold, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10, marginTop: 10 },
  ritem: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 9, gap: 4 },
  rq: { color: C.txt, fontWeight: FONT.bold, fontSize: 14, lineHeight: 20 },
  rbad: { color: "#ff8aa3", fontSize: 14, lineHeight: 20 },
  rgood: { color: "#7dffa6", fontSize: 14, lineHeight: 20 },
  rsrc: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
});
