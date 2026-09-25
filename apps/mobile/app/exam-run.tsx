import { DEFAULT_GRADING, gradeFor, todayStr, type Grading } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Icon } from "@/components/Icon";
import { Bar, Confetti, Motion } from "@/components/Motion";
import { Option } from "@/components/QuizBlock";
import { SourceSheet, SrcLine, type QCtx } from "@/components/Sheets";
import { Body, Display, Eyebrow, Muted, Num } from "@/components/Text";
import { Blob, Btn, Card, Empty, IconTile, Press, Ring, RoundBtn, Screen, Sheet, Touch, useTop } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { KEYS_ABC, fmtClock, nowMs, npl } from "@/lib/format";
import { play } from "@/lib/sfx";
import { T, TONES } from "@/lib/theme";
import { quizPool, shuffle, topicShort, type QuizRef } from "@/lib/topic-view";

const gradeParts = (g: string) => {
  const m = String(g).split(/\s*[—–/]\s*/);
  return [m[0] ?? g, m.slice(1).join(" ")] as const;
};

interface Result {
  correct: number;
  blank: number;
  wrong: { q: QuizRef; sel: number | null; i: number }[];
  pct: number;
  grade: string;
  passed: boolean;
  used: number;
  auto: boolean;
  newBest: boolean;
}

/**
 * Egzamin na pełnym ekranie (ExamRun.html → Exam.html): timer (mruga pod 2 min), siatka pytań (skok), flaga, kafle bez oceny,
 * wstecz/dalej, „Zakończ” z podsumowaniem; koniec czasu = auto. Tylko pytania quizu, bez serc. Wynik: pierścień, ocena z siatki,
 * „Gdzie tracisz punkty”, talia błędów (→ powtórka `deck=1`), przegląd pytań z poprawką i źródłem.
 */
export default function ExamRun() {
  const { subjectId, levels: lvParam, n: nParam, lim: limParam } = useLocalSearchParams<{ subjectId: string; levels?: string; n?: string; lim?: string }>();
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const subject = app.findSubject(subjectId ?? "");
  const topics = app.topicsOf(subjectId ?? "");
  const keys = lvParam ? lvParam.split(",").filter(Boolean) : null;
  const [pool] = useState<QuizRef[]>(() => {
    const all = topics.flatMap((t) => quizPool(t, app.extra.overrides, keys ? keys.filter((k) => k.startsWith(t.id + ":")).map((k) => k.split(":")[1]!) : null));
    const sh = shuffle(all);
    const N = nParam === "all" || !nParam ? sh.length : Math.min(Math.max(1, +nParam || 20), sh.length);
    return sh.slice(0, N);
  });
  const grading: Grading = topics[0]?.grading ?? DEFAULT_GRADING;
  const limit = Math.max(0, +(limParam ?? grading.examMin) || 0) * 60;
  const M = pool.length;
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState<(number | null)[]>(() => Array(M).fill(null));
  const [flags, setFlags] = useState<boolean[]>(() => Array(M).fill(false));
  const [left, setLeft] = useState(limit);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [src, setSrc] = useState<QCtx | null>(null);
  const [started] = useState(() => nowMs());
  const done = useRef(false);
  const exit = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/s/[subjectId]", params: { subjectId: subjectId ?? "" } }));

  const finish = (auto: boolean) => {
      if (done.current || !subject) return;
      done.current = true;
      const picks = pick;
      let correct = 0,
        blank = 0;
      const wrong: Result["wrong"] = [];
      const byTopic: Record<string, { ok: number; right: Record<string, number[]>; wrongIdx: Record<string, number[]> }> = {};
      pool.forEach((q, i) => {
        const p = picks[i] ?? null;
        const bt = (byTopic[q.topicId] ??= { ok: 0, right: {}, wrongIdx: {} });
        if (p === q.q.c) {
          correct++;
          bt.ok++;
          (bt.right[q.levelId] ??= []).push(q.qi);
        } else {
          if (p == null) blank++;
          wrong.push({ q, sel: p, i });
          (bt.wrongIdx[q.levelId] ??= []).push(q.qi);
        }
      });
      const pct = M ? Math.round((correct / M) * 100) : 0;
      const grade = gradeFor(pct, grading);
      const passed = pct >= grading.pass;
      const used = limit ? limit - Math.max(0, left) : Math.round((nowMs() - started) / 1000);
      for (const [tid, bt] of Object.entries(byTopic)) {
        if (bt.ok) app.addXp(tid, bt.ok * 3);
        const lvs = new Set([...Object.keys(bt.right), ...Object.keys(bt.wrongIdx)]);
        for (const lid of lvs) app.setWeak(tid, lid, bt.wrongIdx[lid] ?? [], bt.right[lid] ?? []);
      }
      app.completeDaily(subject.id, "exam");
      app.markTestDone(subject.id, "mock");
      const prev = app.examRec(subject.id);
      const newBest = !prev.best || pct > prev.best.pct;
      app.recordExam(subject.id, { pct, grade, correct, total: M, date: todayStr() }, passed);
      if (passed) {
        play("levelup");
        haptic.heavy();
      } else play("wrong");
      setConfirm(false);
      setResult({ correct, blank, wrong, pct, grade, passed, used, auto, newBest });
      setTimeout(() => app.showToast(auto ? "Czas minął — egzamin zakończony" : passed ? `Zdane, ocena ${gradeParts(grade)[0]}` : "Niezaliczone", auto ? "clock" : passed ? "trophy" : "x-circle"), 400);
  };
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });
  useEffect(() => {
    if (!limit || result) return;
    const id = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(id);
          setTimeout(() => finishRef.current(true), 0);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [limit, result]);

  if (!subject)
    return (
      <Screen>
        <Empty icon="alert" title="Nie ma takiego przedmiotu" action={<Btn label="Wróć" onPress={exit} />} />
      </Screen>
    );
  if (!M)
    return (
      <Screen>
        <Empty icon="alert" title="Brak pytań w tym zakresie" action={<Btn label="Wróć" onPress={exit} />} />
      </Screen>
    );

  /* ---------- wynik (Exam.html) ---------- */
  if (result) {
    const r = result;
    const scale = [...grading.scale].sort((a, b) => b[0] - a[0]);
    const [gMain, gRest] = gradeParts(r.grade);
    const nextG = [...scale].reverse().find(([min]) => min > r.pct);
    const need = nextG ? Math.max(1, Math.ceil((nextG[0] / 100) * M) - r.correct) : 0;
    const needPass = Math.max(1, Math.ceil((grading.pass / 100) * M) - r.correct);
    const note = (r.auto ? "Czas minął. " : "") + (r.passed ? (nextG ? `Do ${gradeParts(nextG[1])[0]} brakuje ${npl(need, "pytania", "pytań", "pytań")}.` : "Najwyższa ocena w siatce.") : `Do progu ${grading.pass}% brakuje ${npl(needPass, "pytania", "pytań", "pytań")}.`) + (r.newBest && r.correct ? " Nowy rekord." : "");
    const nw = r.wrong.length;
    const byLv: Record<string, { t: string; n: number; ok: number }> = {};
    pool.forEach((q, i) => {
      const k = `${q.topicId}:${q.levelId}`;
      const t = topics.find((x) => x.id === q.topicId);
      const b = (byLv[k] ??= { t: topics.length > 1 && t ? `${topicShort(t)} · ${q.lvl}` : q.lvl, n: 0, ok: 0 });
      b.n++;
      if (!r.wrong.some((w) => w.i === i)) b.ok++;
    });
    const lvRows = Object.values(byLv)
      .map((x) => ({ ...x, pct: Math.round((x.ok / x.n) * 100) }))
      .sort((a, b) => a.pct - b.pct);
    const items = [...r.wrong.map((w) => ({ q: w.q, i: w.i, sel: w.sel, bad: true })), ...pool.map((q, i) => ({ q, i, sel: r.wrong.find((w) => w.i === i)?.sel ?? null, bad: false })).filter((x) => !r.wrong.some((w) => w.i === x.i))];
    const ctxOf = (q: QuizRef): QCtx | null => {
      const t = topics.find((x) => x.id === q.topicId);
      const lv = t?.levels.find((l) => l.id === q.levelId);
      return t && lv ? { topic: t, level: lv, qi: q.qi, q: q.q } : null;
    };
    const tone = r.passed ? TONES.acid : TONES.red;
    return (
      <AccentProvider color={subject.accent2} seed={subject.name}>
        <Screen scroll pad={false} bottom={26} blob={<Blob tone="violet" size={260} top={-70} right={-70} />}>
          {r.passed ? <Confetti n={6} colors={[T.acid, T.gold, T.pink, T.cyan]} top={90} /> : null}
          <View style={[s.head, { paddingTop: top }]}>
            <RoundBtn icon="back" onPress={exit} label="Wróć" />
            <Display size={18} ls={-0.4}>
              Symulacja egzaminu
            </Display>
          </View>
          <View style={s.wrap}>
            <Motion kind="up">
              <Card tone={r.passed ? "acid" : "red"} padding={22} radius={28} drop={6}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
                  <Motion kind="pop">
                    <Ring pct={r.pct} size={108} stroke={9} color={tone.color} track={r.passed ? "#2E3D18" : "#3D1820"}>
                      <Num size={30} color={tone.color}>
                        {r.pct}%
                      </Num>
                      <Eyebrow size={10} color={tone.sub} style={{ marginTop: 3 }}>
                        {r.correct}/{M}
                      </Eyebrow>
                    </Ring>
                  </Motion>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Eyebrow color={tone.sub}>{r.passed ? "Twoja ocena" : "Poniżej progu"}</Eyebrow>
                    <Num size={54} color={tone.txt} ls={-2} lh={58} style={{ marginTop: 4 }}>
                      {gMain}
                    </Num>
                    {gRest ? (
                      <Body size={12.5} weight={800} color={tone.sub}>
                        {gRest}
                      </Body>
                    ) : null}
                    <Muted size={12.5} weight={700} color={tone.sub} lh={17} style={{ marginTop: 6 }}>
                      {note}
                    </Muted>
                  </View>
                </View>
              </Card>
            </Motion>
            <Motion kind="up" d={2} style={{ flexDirection: "row", gap: 8 }}>
              {(
                [
                  [String(r.correct), "poprawne", T.acid],
                  [String(nw - r.blank), "błędne", T.red],
                  [String(r.blank), "puste", T.gold],
                  [fmtClock(r.used), "czas", T.cyan],
                ] as [string, string, string][]
              ).map(([v, k, c]) => (
                <View key={k} style={s.stat}>
                  <Num size={20} color={c}>
                    {v}
                  </Num>
                  <Muted size={10.5} weight={700} style={{ marginTop: 2 }}>
                    {k}
                  </Muted>
                </View>
              ))}
            </Motion>
            {lvRows.length > 1 ? (
              <Motion kind="up" d={3}>
                <Card padding={18} radius={24} drop={5}>
                  <Eyebrow size={10.5}>Gdzie tracisz punkty</Eyebrow>
                  <View style={{ gap: 11, marginTop: 14 }}>
                    {lvRows.map((x, i) => {
                      const c = x.pct < 50 ? T.red : x.pct < 75 ? T.gold : T.acid;
                      const tc = x.pct < 50 ? "#FF8FA3" : x.pct < 75 ? "#FFD98A" : "#C6F58A";
                      return (
                        <View key={x.t} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <Body size={12.5} color={T.txt2} style={{ width: 92 }} numberOfLines={1}>
                            {x.t}
                          </Body>
                          <Bar pct={x.pct} color={c} height={12} d={Math.min(6, i + 1)} style={{ flex: 1 }} />
                          <Body size={12} weight={800} color={tc} style={{ width: 34, textAlign: "right" }}>
                            {x.pct}%
                          </Body>
                        </View>
                      );
                    })}
                  </View>
                </Card>
              </Motion>
            ) : null}
            <Motion kind="up" d={3}>
              <Card padding={16} radius={24} drop={5}>
                <Eyebrow>Siatka ocen</Eyebrow>
                <View style={{ gap: 6, marginTop: 10 }}>
                  {scale.map(([min, lab]) => {
                    const on = r.passed && lab === r.grade;
                    return (
                      <View key={min} style={[s.srow, on && { backgroundColor: TONES.acid.tint, borderColor: TONES.acid.tintLine }]}>
                        <Body size={13} weight={800} color={on ? T.acid : T.txt} style={{ width: 34 }}>
                          {gradeParts(lab)[0]}
                        </Body>
                        <Bar pct={min} color={on ? T.acid : T.dash} height={8} animate={false} style={{ flex: 1 }} />
                        <Muted size={11.5} weight={800} style={{ width: 54, textAlign: "right" }}>
                          od {min}%
                        </Muted>
                      </View>
                    );
                  })}
                  <View style={[s.srow, !r.passed && { backgroundColor: TONES.red.tint, borderColor: TONES.red.tintLine }]}>
                    <Body size={13} weight={800} color={T.red} style={{ width: 34 }}>
                      {gradeParts(grading.failLabel)[0]}
                    </Body>
                    <Bar pct={Math.max(0, grading.pass - 1)} color={!r.passed ? T.red : T.dash} height={8} animate={false} style={{ flex: 1 }} />
                    <Muted size={11.5} weight={800} style={{ width: 54, textAlign: "right" }}>
                      pod {grading.pass}%
                    </Muted>
                  </View>
                </View>
              </Card>
            </Motion>
            <Motion kind="up" d={4}>
              {nw ? (
                <Press onPress={() => router.replace({ pathname: "/review-run", params: { subjectId: subject.id, deck: "1" } })} drop={4} edge={TONES.red.tintShadow} radius={22} faceStyle={[s.deck, { backgroundColor: TONES.red.tint, borderColor: TONES.red.tintLine }]} accessibilityLabel="Talia błędów">
                  <IconTile icon="alert" size={44} tone="red" stroke={2.8} />
                  <View style={{ flex: 1 }}>
                    <Body size={14.5} weight={800} color={TONES.red.txt}>
                      {npl(nw, "błąd do powtórki", "błędy do powtórki", "błędów do powtórki")}
                    </Body>
                    <Muted size={12.5} color={TONES.red.sub} style={{ marginTop: 2 }}>
                      W osobnej talii — wraca też na ekranie Dziś
                    </Muted>
                  </View>
                  <Icon name="chevron-right" size={20} color={TONES.red.sub} />
                </Press>
              ) : (
                <View style={[s.deck, { backgroundColor: TONES.acid.tint, borderColor: TONES.acid.tintLine }]}>
                  <IconTile icon="check" size={44} tone="acid" stroke={3.4} />
                  <View style={{ flex: 1 }}>
                    <Body size={14.5} weight={800} color={TONES.acid.txt}>
                      Bez błędów
                    </Body>
                    <Muted size={12.5} color={TONES.acid.sub} style={{ marginTop: 2 }}>
                      Cały zakres opanowany
                    </Muted>
                  </View>
                </View>
              )}
            </Motion>
            <Motion kind="up" d={5} style={{ gap: 10 }}>
              <Eyebrow>Przegląd pytań{nw ? " — błędy najpierw" : ""}</Eyebrow>
              {items.map((it) => {
                const q = it.q;
                const c = ctxOf(q);
                return (
                  <View key={it.i} style={[s.item, it.bad ? { borderColor: TONES.red.tintLine } : { borderColor: TONES.acid.tintLine }]}>
                    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                      <View style={[s.numTile, { backgroundColor: it.bad ? TONES.red.tint : TONES.acid.tint }]}>
                        <Body size={12} weight={800} color={it.bad ? TONES.red.txt : TONES.acid.txt}>
                          {it.i + 1}
                        </Body>
                      </View>
                      <Body size={14} weight={800} style={{ flex: 1 }} lh={19}>
                        {q.q.q}
                      </Body>
                    </View>
                    {it.bad ? (
                      <Body size={13} weight={700} color={TONES.red.txt} style={{ marginTop: 8 }}>
                        Twoja: {it.sel == null ? "bez odpowiedzi" : `${KEYS_ABC[it.sel]}. ${q.q.a[it.sel]}`}
                      </Body>
                    ) : null}
                    <Body size={13} weight={700} color={T.acid} style={{ marginTop: it.bad ? 3 : 8 }}>
                      {it.bad ? "Dobra: " : ""}
                      {KEYS_ABC[q.q.c]}. {q.q.a[q.q.c]}
                    </Body>
                    {it.bad && q.q.e ? (
                      <Muted size={12.5} lh={17} style={{ marginTop: 6 }}>
                        {q.q.e}
                      </Muted>
                    ) : null}
                    {q.q.src && c ? <SrcLine q={q.q} onPress={() => setSrc(c)} /> : null}
                    <Touch onPress={() => router.push({ pathname: "/edit-question", params: { topicId: q.topicId, levelId: q.levelId, qi: String(q.qi) } })} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                      <Icon name="edit" size={14} color={T.muted} />
                      <Body size={12} weight={800} color={T.muted}>
                        {q.q.edited ? "Poprawione · edytuj" : "Zgłoś / popraw"}
                      </Body>
                    </Touch>
                  </View>
                );
              })}
            </Motion>
            <View style={{ gap: 10, marginTop: 6 }}>
              <Btn label={nw ? `Talia błędów · ${nw}` : "Gotowe"} glow onPress={nw ? () => router.replace({ pathname: "/review-run", params: { subjectId: subject.id, deck: "1" } }) : exit} />
              <Btn label={nw ? "Wróć do ścieżki" : "Jeszcze raz"} variant="ghost" onPress={exit} />
            </View>
          </View>
          <SourceSheet open={!!src} q={src?.q} ctx={src} onClose={() => setSrc(null)} onEdit={src ? () => { const c = src; setSrc(null); router.push({ pathname: "/edit-question", params: { topicId: c.topic.id, levelId: c.level.id, qi: String(c.qi ?? 0) } }); } : undefined} />
        </Screen>
      </AccentProvider>
    );
  }

  /* ---------- bieg (ExamRun.html) ---------- */
  const q = pool[idx]!;
  const sel = pick[idx];
  const flag = flags[idx];
  const last = idx + 1 >= M;
  const warn = !!limit && left <= 120;
  const un = pick.filter((p) => p == null).length;
  const fl = flags.filter(Boolean).length;
  const select = (i: number) => setPick((p) => p.map((v, k) => (k === idx ? (v === i ? null : i) : v)));
  const goTo = (i: number) => setIdx(Math.max(0, Math.min(M - 1, i)));
  return (
    <AccentProvider color={subject.accent2} seed={subject.name}>
      <Screen pad={false}>
        <View style={[s.band, { paddingTop: top }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <RoundBtn icon="close" onPress={() => setConfirm(true)} label="Przerwij egzamin" size={38} />
            <View style={{ flex: 1 }}>
              <Body size={13} weight={800}>
                Pytanie {idx + 1} z {M}
              </Body>
              <Bar pct={(idx / M) * 100} color={T.violet} height={8} style={{ marginTop: 5 }} animate={false} />
            </View>
            <Touch onPress={() => app.showToast(limit ? `Zostało ${fmtClock(left)}` : "Egzamin bez limitu czasu", "clock")} accessibilityRole="button" accessibilityLabel="Pozostały czas" style={[s.timer, warn && { borderColor: T.red, backgroundColor: TONES.red.tint }]}>
              <Icon name="clock" size={15} color={warn ? T.red : "#FFB27A"} />
              <Motion kind={warn ? "blink" : "none"}>
                <Body size={13.5} weight={800} color={warn ? TONES.red.txt : "#FFB27A"}>
                  {limit ? fmtClock(left) : "—"}
                </Body>
              </Motion>
            </Touch>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
            {pool.map((_, i) => {
              const cur = i === idx;
              const c = cur ? T.violet : flags[i] ? "#574319" : pick[i] != null ? "#4E6B24" : T.line2;
              const sq = (
                <Touch key={i} onPress={() => goTo(i)} accessibilityRole="button" accessibilityLabel={`Pytanie ${i + 1}${flags[i] ? ", do wrócenia" : pick[i] != null ? ", z odpowiedzią" : ", bez odpowiedzi"}`} style={[s.sq, { backgroundColor: c }]}>
                <View />
                </Touch>
              );
              return cur ? (
                <Motion key={i} kind="pulse">
                  {sq}
                </Motion>
              ) : (
                sq
              );
            })}
          </View>
          <View style={{ flexDirection: "row", gap: 14, marginTop: 10 }}>
            {(
              [
                ["#4E6B24", "odpowiedziane"],
                ["#574319", "do wrócenia"],
                [T.line2, "puste"],
              ] as [string, string][]
            ).map(([c, l]) => (
              <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c }} />
                <Muted size={10.5} weight={700}>
                  {l}
                </Muted>
              </View>
            ))}
          </View>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={s.qn}>
              <Eyebrow size={10.5}>{q.lvl}</Eyebrow>
            </View>
            {flag ? (
              <View style={[s.qn, { backgroundColor: TONES.gold.tint, borderColor: TONES.gold.tintLine }]}>
                <Eyebrow size={10.5} color={T.gold}>
                  Do wrócenia
                </Eyebrow>
              </View>
            ) : null}
          </View>
          <Motion key={idx} kind="up" style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <Display size={23} ls={-0.7} lh={28} style={{ flex: 1 }}>
              {q.q.q}
            </Display>
            <Touch onPress={() => setFlags((f) => f.map((v, k) => (k === idx ? !v : v)))} accessibilityRole="button" accessibilityState={{ selected: flag }} accessibilityLabel="Oznacz do wrócenia" style={[s.flag, flag && { backgroundColor: T.gold, borderColor: T.gold }]}>
              <Icon name="bookmark" size={18} fill={flag} color={flag ? T.onGold : T.gold} />
            </Touch>
          </Motion>
          <View style={{ gap: 10 }}>
            {q.q.a.map((a, i) => (
              <Option key={`${idx}-${i}`} k={KEYS_ABC[i] ?? String(i + 1)} text={a} state={sel === i ? "sel" : "idle"} onPress={() => select(i)} d={i + 1} />
            ))}
          </View>
        </ScrollView>
        <View style={s.nav}>
          <Press onPress={() => idx > 0 && goTo(idx - 1)} disabled={idx === 0} drop={4} edge={T.shadow} radius={18} faceStyle={[s.prev, idx === 0 && { opacity: 0.4 }]} accessibilityLabel="Poprzednie pytanie">
            <Icon name="back" size={20} stroke={3} color={T.txt} />
          </Press>
          <Btn label={last ? "Zakończ" : "Dalej"} tone="violet" glow onPress={() => (last ? setConfirm(true) : goTo(idx + 1))} style={{ flex: 1 }} />
        </View>
        <Sheet open={confirm} onClose={() => setConfirm(false)} bg={T.surface2} tone="violet">
          <Display size={22} ls={-0.6}>
            Zakończyć egzamin?
          </Display>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(
              [
                [String(un), "bez odpowiedzi", TONES.red, 1],
                [String(fl), "do wrócenia", TONES.gold, 2],
                [String(M - un), "z odpowiedzią", TONES.acid, 3],
              ] as [string, string, (typeof TONES)["acid"], number][]
            ).map(([v, k, tn, d]) => (
              <Motion key={k} kind="pop" d={d} style={{ flex: 1 }}>
                <View style={[s.sum, { backgroundColor: tn.tint, borderColor: tn.tintLine }]}>
                  <Num size={24} color={tn.color}>
                    {v}
                  </Num>
                  <Muted size={10.5} weight={700} color={tn.sub} center style={{ marginTop: 2 }}>
                    {k}
                  </Muted>
                </View>
              </Motion>
            ))}
          </View>
          <Muted size={13} lh={18}>
            {un ? "Pytania bez odpowiedzi liczą się jako błędne." : "Każde pytanie ma odpowiedź."}
            {fl ? " Oznaczone możesz jeszcze sprawdzić." : ""}
          </Muted>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn label={un > 0 ? "Do pustych" : "Wróć"} variant="ghost" onPress={() => { setConfirm(false); const f = pick.findIndex((p) => p == null); if (un > 0 && f >= 0) goTo(f); }} style={{ flex: 1 }} />
            <Btn label="Zakończ" tone="violet" onPress={() => finish(false)} style={{ flex: 1 }} />
          </View>
          <Btn label="Przerwij bez wyniku" variant="text" onPress={() => { setConfirm(false); app.showToast("Egzamin przerwany", "close"); exit(); }} />
        </Sheet>
      </Screen>
    </AccentProvider>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18 },
  wrap: { paddingHorizontal: 18, paddingTop: 22, gap: 16 },
  band: { paddingHorizontal: 18, paddingBottom: 12, backgroundColor: T.surface2, borderBottomWidth: 2, borderBottomColor: T.line },
  timer: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: TONES.amber.tint, borderWidth: 2, borderColor: TONES.amber.tintLine, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  sq: { width: 22, height: 22, borderRadius: 7 },
  qn: { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 },
  flag: { width: 40, height: 40, borderRadius: 14, backgroundColor: TONES.gold.tint, borderWidth: 2, borderColor: TONES.gold.tintLine, alignItems: "center", justifyContent: "center" },
  nav: { flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 26 },
  prev: { width: 58, height: 58, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, alignItems: "center", justifyContent: "center" },
  sum: { borderWidth: 2, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 6, alignItems: "center" },
  stat: { flex: 1, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 6, alignItems: "center" },
  srow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 12, borderWidth: 2, borderColor: "transparent" },
  deck: { flexDirection: "row", alignItems: "center", gap: 13, borderWidth: 2, paddingVertical: 14, paddingHorizontal: 16 },
  item: { backgroundColor: T.surface, borderWidth: 2, borderRadius: 18, padding: 14 },
  numTile: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center", marginTop: 1 },
});
