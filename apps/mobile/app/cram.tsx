import { dayDiff, newCard, review, srsBox, todayStr } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Flip, KnowButtons } from "@/components/Flip";
import { Icon } from "@/components/Icon";
import { Bar, Confetti, Motion } from "@/components/Motion";
import { QuizBlock } from "@/components/QuizBlock";
import { ExplainSheet, SheetBad, SheetOk, SourceSheet, type QCtx } from "@/components/Sheets";
import { Body, Display, Eyebrow, Muted, Num } from "@/components/Text";
import { Btn, Empty, ListCard, Note, RoundBtn, Row, Screen, SegBar, TopBar, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { etaText, fmtClock, fmtDate, inDays, msToMidnight, noEmoji, nowMs, npl } from "@/lib/format";
import { play } from "@/lib/sfx";
import { dueEntries, type SrsEntry } from "@/lib/srs-view";
import { splitKey } from "@/lib/tests";
import { T, TONES, type Tone } from "@/lib/theme";
import { cardPool, quizPool, shuffle, type QuizRef } from "@/lib/topic-view";

const BG = "#08070F";
const BLOCK_SEC = 300;
const TONE: Record<string, Tone> = { weak: "red", cards: "gold", quiz: "cyan", errors: "violet" };
type Item = { kind: "card"; e: SrsEntry } | { kind: "quiz"; q: QuizRef };
interface Block {
  id: string;
  t: string;
  s: string;
  items: Item[];
}

/**
 * Noc przed egzaminem (Cram.html): 4 bloki po 5 minut — najsłabsze pojęcia (SRS), fiszki z zakresu, 10 pytań, błędy
 * (talia `weak`). Zapis jak w powtórce (SRS, +2/+3 XP, plan dnia „review”, dzień planu). Na koniec „Idź spać”.
 */
export default function Cram() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const subject = app.findSubject(subjectId ?? "");
  const topics = app.topicsOf(subjectId ?? "");
  const test = app.testFor(subjectId ?? "");
  const [blocks] = useState<Block[]>(() => {
    if (!subject) return [];
    const scope = test ? test.levels : topics.flatMap((t) => t.levels.map((l) => `${t.id}:${l.id}`));
    const inScope = (tid: string, lid: string) => scope.includes(`${tid}:${lid}`);
    const { all } = dueEntries(app, subject.id);
    const mine = all.filter((e) => inScope(e.topicId, e.levelId));
    const weak = mine
      .filter((e) => e.card.lapses > 0 || srsBox(e.card) <= 1)
      .sort((a, b) => b.card.lapses - a.card.lapses || srsBox(a.card) - srsBox(b.card))
      .slice(0, 10)
      .map((e) => ({ kind: "card" as const, e }));
    const cards = shuffle(topics.flatMap((t) => cardPool(t, app.extra.overrides).filter((c) => inScope(c.topicId, c.levelId))))
      .slice(0, 12)
      .map((c) => ({ kind: "card" as const, e: { topicId: c.topicId, levelId: c.levelId, index: c.index, key: c.key, card: app.srsFor(c.topicId)[c.key] ?? newCard(), term: c.t, def: c.d, lvl: c.lvl } }));
    const qs = shuffle(topics.flatMap((t) => quizPool(t, app.extra.overrides).filter((q) => inScope(q.topicId, q.levelId))))
      .slice(0, 10)
      .map((q) => ({ kind: "quiz" as const, q }));
    const errs: Item[] = [];
    for (const t of topics) {
      const pool = quizPool(t, app.extra.overrides);
      for (const [lid, idxs] of Object.entries(app.weak[t.id] ?? {})) for (const qi of idxs) {
        const q = pool.find((x) => x.levelId === lid && x.qi === qi);
        if (q && inScope(t.id, lid)) errs.push({ kind: "quiz", q });
      }
    }
    const lvNames = scope.map((k) => { const { topicId, levelId } = splitKey(k); return noEmoji(topics.find((t) => t.id === topicId)?.levels.find((l) => l.id === levelId)?.title ?? ""); }).filter(Boolean);
    const total = topics.reduce((a, t) => a + t.levels.length, 0);
    const scopeTxt = scope.length >= total ? "cały przedmiot" : lvNames.slice(0, 2).join(", ") + (lvNames.length > 2 ? ` +${lvNames.length - 2}` : "");
    return [
      { id: "weak", t: "Najsłabsze pojęcia", s: weak.length ? `${npl(weak.length, "pojęcie, które", "pojęcia, które", "pojęć, które")} najczęściej mylisz` : "bez historii pomyłek — biorę fiszki z zakresu", items: weak.length ? weak : cards.slice(0, 8) },
      { id: "cards", t: "Fiszki z zakresu", s: `${npl(cards.length, "fiszka", "fiszki", "fiszek")} · ${scopeTxt}`, items: cards },
      { id: "quiz", t: npl(qs.length, "pytanie", "pytania", "pytań"), s: "jak na egzaminie, z wyjaśnieniami po każdym", items: qs },
      { id: "errors", t: "Błędy z egzaminu", s: errs.length ? `${npl(errs.length, "pytanie", "pytania", "pytań")} z talii błędów` : "talia pusta — blok pominięty", items: errs.slice(0, 10) },
    ].filter((b) => b.items.length);
  });
  const [run, setRun] = useState<{ bi: number; ii: number; left: number; ok: number; bad: number; xp: number; marks: Record<number, "bad">; t0: number; done: boolean } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [sheet, setSheet] = useState<{ ok: boolean; xp: number; q: QuizRef } | null>(null);
  const [explain, setExplain] = useState<QCtx | null>(null);
  const [src, setSrc] = useState<QCtx | null>(null);
  const [conf, setConf] = useState(0);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/s/[subjectId]/exam", params: { subjectId: subjectId ?? "" } }));

  const finish = () => {
    const r = runRef.current;
    if (!r || r.done || !subject) return;
    if (r.ok + r.bad > 0) {
      app.completeDaily(subject.id, "review");
      app.markTestDone(subject.id, "review");
    }
    setSheet(null);
    setRun({ ...r, done: true });
    setTimeout(() => app.showToast("Powtórka zapisana — dobranoc", "moon"), 400);
  };
  const nextBlock = (msg?: string) => {
    const r = runRef.current;
    if (!r) return;
    setSheet(null);
    setFlipped(false);
    if (r.bi + 1 >= blocks.length) return finish();
    setRun({ ...r, bi: r.bi + 1, ii: 0, left: BLOCK_SEC, marks: {} });
    app.showToast(msg ?? "Blok gotowy", "check");
  };
  const nextBlockRef = useRef(nextBlock);
  useEffect(() => {
    nextBlockRef.current = nextBlock;
  });
  const active = !!run && !run.done;
  const bi = run?.bi ?? -1;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const r = runRef.current;
      if (!r || r.done) return;
      if (r.left <= 1) nextBlockRef.current("Czas na ten blok minął");
      else setRun({ ...r, left: r.left - 1 });
    }, 1000);
    return () => clearInterval(id);
  }, [active, bi]);

  if (!subject)
    return (
      <Screen style={{ backgroundColor: BG }}>
        <Empty icon="alert" title="Nie ma takiego przedmiotu" action={<Btn label="Wróć" onPress={back} />} />
      </Screen>
    );
  const N = test ? dayDiff(todayStr(), test.date) : null;
  const toMid = msToMidnight();
  const total = blocks.length * 5;

  /* ---------- Idź spać ---------- */
  if (run?.done) {
    const sec = Math.round((nowMs() - run.t0) / 1000);
    const doneBlocks = Math.min(blocks.length, run.bi + (run.ii > 0 ? 1 : 0));
    return (
      <AccentProvider color={subject.accent2} seed={subject.name}>
        <Screen scroll pad={false} style={{ backgroundColor: BG }} bottom={26}>
          <Stars />
          {run.ok >= run.bad ? <Confetti n={5} colors={[T.violet, T.acid, T.gold]} top={80} /> : null}
          <View style={[s.done, { paddingTop: top + 30 }]}>
            <Motion kind="pop">
              <View style={s.moon}>
                <Icon name="moon" size={64} color={T.violet} />
              </View>
            </Motion>
            <Motion kind="up" d={2} style={{ alignItems: "center" }}>
              <Display size={34} ls={-1.2} center>
                Idź spać
              </Display>
              <Muted size={14} weight={700} center style={{ marginTop: 7 }}>
                {noEmoji(subject.name)} · {doneBlocks} z {npl(blocks.length, "bloku", "bloków", "bloków")} · {fmtClock(sec)}
              </Muted>
            </Motion>
            <Motion kind="up" d={3} style={{ flexDirection: "row", gap: 11, alignSelf: "stretch" }}>
              {(
                [
                  [String(run.ok), "umiem", "acid"],
                  [String(run.bad), "do rana", "red"],
                  [`+${run.xp}`, "XP", "gold"],
                ] as [string, string, Tone][]
              ).map(([v, k, tn]) => (
                <View key={k} style={[s.stat, { backgroundColor: TONES[tn].tint, borderColor: TONES[tn].tintLine }]}>
                  <Num size={28} color={TONES[tn].color}>
                    {v}
                  </Num>
                  <Muted size={11.5} weight={700} color={TONES[tn].sub} style={{ marginTop: 3 }}>
                    {k}
                  </Muted>
                </View>
              ))}
            </Motion>
            <Motion kind="up" d={4} style={{ alignSelf: "stretch" }}>
              <ListCard>
                <Eyebrow style={{ paddingTop: 10 }}>Plan na jutro</Eyebrow>
                <Row icon="clock" title="Rano: 5 minut" sub={run.bad ? `${npl(run.bad, "pojęcie, które", "pojęcia, które", "pojęć, które")} dziś nie weszło — wracają w powtórce` : "tylko fiszki z najsłabszych, bez nowych rzeczy"} />
                <Row icon="close" title="Przed egzaminem: nic nowego" sub="przejrzyj notatki, nie ucz się nowych rzeczy" />
                {test ? <Row icon="calendar" title={`Sprawdzian: ${fmtDate(test.date)}`} sub={`${inDays(N ?? 0)} · powodzenia`} /> : <Row icon="moon" title="Teraz sen" sub="7–8 godzin robi więcej niż kolejna godzina nauki" />}
              </ListCard>
            </Motion>
            <View style={{ flex: 1 }} />
            <View style={{ alignSelf: "stretch", gap: 10 }}>
              <Btn label="Dobranoc" tone="violet" glow onPress={() => router.replace("/(tabs)")} />
              <Btn label="Wróć do egzaminu" variant="text" onPress={back} />
            </View>
          </View>
        </Screen>
      </AccentProvider>
    );
  }

  /* ---------- bieg bloku ---------- */
  if (run) {
    const b = blocks[run.bi]!;
    const it = b.items[Math.min(run.ii, b.items.length - 1)]!;
    const warn = run.left <= 30;
    const answer = (ok: boolean, xpGain: number, item: Item) => {
      const r = runRef.current!;
      if (item.kind === "card") {
        const e = item.e;
        app.reviewCard(e.topicId, e.levelId, e.index, e.key, review(app.srsFor(e.topicId)[e.key] ?? e.card, ok ? 2 : 0), e.term);
      } else app.setWeak(item.q.topicId, item.q.levelId, ok ? [] : [item.q.qi], ok ? [item.q.qi] : []);
      app.questEvent({ type: "review", count: 1 });
      let got = 0;
      if (ok) {
        got = app.addXp(item.kind === "card" ? item.e.topicId : item.q.topicId, xpGain);
        play("correct");
      } else play("wrong");
      setRun({ ...r, ok: r.ok + (ok ? 1 : 0), bad: r.bad + (ok ? 0 : 1), xp: r.xp + got, marks: ok ? r.marks : { ...r.marks, [r.ii]: "bad" } });
      return got;
    };
    const advance = () => {
      const r = runRef.current!;
      setSheet(null);
      setFlipped(false);
      if (r.ii + 1 >= b.items.length) nextBlock();
      else setRun({ ...r, ii: r.ii + 1 });
    };
    const ctxOf = (q: QuizRef): QCtx | null => {
      const t = app.findTopic(q.topicId);
      const lv = t?.levels.find((l) => l.id === q.levelId);
      return t && lv ? { topic: t, level: lv, qi: q.qi, q: q.q } : null;
    };
    return (
      <AccentProvider color={subject.accent2} seed={subject.name}>
        <Screen pad={false} style={{ backgroundColor: BG }}>
          <View style={[s.head, { paddingTop: top }]}>
            <RoundBtn icon="close" onPress={() => (run.ok + run.bad > 0 ? finish() : setRun(null))} label="Przerwij" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Eyebrow size={10.5}>
                Blok {run.bi + 1} z {blocks.length}
              </Eyebrow>
              <Body size={14} weight={800} numberOfLines={1}>
                {b.t}
              </Body>
            </View>
            <View style={[s.timer, warn && { borderColor: T.red, backgroundColor: TONES.red.tint }]}>
              <Icon name="clock" size={15} color={warn ? T.red : "#FFB27A"} />
              <Motion kind={warn ? "blink" : "none"}>
                <Body size={13.5} weight={800} color={warn ? TONES.red.txt : "#FFB27A"}>
                  {fmtClock(run.left)}
                </Body>
              </Motion>
            </View>
          </View>
          <View style={{ paddingHorizontal: 18, paddingTop: 10, gap: 8 }}>
            <Bar pct={(run.left / BLOCK_SEC) * 100} color={warn ? T.red : T.violet} height={6} animate={false} />
            <View style={{ flexDirection: "row" }}>
              <SegBar total={b.items.length} done={run.ii} marks={run.marks} color={T.violet} />
            </View>
          </View>
          {it.kind === "card" ? (
            <>
              <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 18 }}>
                <Flip key={`${run.bi}-${run.ii}`} term={it.e.term} def={it.e.def} tag={it.e.lvl} counter={`${run.ii + 1} / ${b.items.length}`} flipped={flipped} onFlip={() => setFlipped((f) => !f)} onSwipe={(k) => { answer(k, 2, it); advance(); }} height={340} />
              </View>
              <View style={{ paddingHorizontal: 18, paddingBottom: 8, paddingTop: 12 }}>
                <KnowButtons onNo={() => { answer(false, 0, it); advance(); }} onYes={() => { answer(true, 2, it); advance(); }} noLabel="jeszcze nie" />
              </View>
            </>
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              {conf ? <Confetti key={conf} n={4} colors={[T.violet, T.acid, T.gold]} top={20} /> : null}
              <QuizBlock key={`${run.bi}-${run.ii}`} q={it.q.q} n={run.ii + 1} total={b.items.length} tag={it.q.lvl} onAnswer={(i, ok) => { const got = answer(ok, 3, it); if (ok) setConf((c) => c + 1); setSheet({ ok, xp: got, q: it.q }); }} footInline />
            </ScrollView>
          )}
          <View style={{ paddingHorizontal: 18, paddingBottom: 22, alignItems: "center" }}>
            <Btn label="Pomiń blok" variant="text" small onPress={() => nextBlock("Blok pominięty")} />
          </View>
          {sheet ? (
            sheet.ok ? (
              <SheetOk open fb={{ e: sheet.q.q.e }} xp={sheet.xp} mult={1} combo={0} onNext={advance} q={sheet.q.q} onSource={sheet.q.q.src ? () => setSrc(ctxOf(sheet.q)) : undefined} />
            ) : (
              <SheetBad open fb={{ e: sheet.q.q.e }} q={sheet.q.q} onNext={advance} onExplain={() => setExplain(ctxOf(sheet.q))} onEdit={() => router.push({ pathname: "/edit-question", params: { topicId: sheet.q.topicId, levelId: sheet.q.levelId, qi: String(sheet.q.qi) } })} onSource={sheet.q.q.src ? () => setSrc(ctxOf(sheet.q)) : undefined} />
            )
          ) : null}
          <ExplainSheet open={!!explain} ctx={explain} onClose={() => setExplain(null)} />
          <SourceSheet open={!!src} q={src?.q} ctx={src} onClose={() => setSrc(null)} />
        </Screen>
      </AccentProvider>
    );
  }

  /* ---------- plan nocy ---------- */
  return (
    <AccentProvider color={subject.accent2} seed={subject.name}>
      <Screen scroll pad={false} style={{ backgroundColor: BG }} bottom={26}>
        <Stars />
        <View style={[s.wrap, { paddingTop: top }]}>
          <TopBar title="Noc przed egzaminem" onBack={back} />
          <Motion kind="up" style={{ alignItems: "center", gap: 10, paddingTop: 6 }}>
            <Motion kind="sway">
              <Icon name="moon" size={64} color="#D6B4F5" />
            </Motion>
            <Eyebrow size={12} color="#9B7FC0" center>
              {noEmoji(subject.name)} · {test && N != null ? `sprawdzian ${inDays(N)}` : "ostatnia powtórka przed egzaminem"}
            </Eyebrow>
            <Motion kind="blink">
              <Num size={44} ls={-1.5}>
                {total} min
              </Num>
            </Motion>
            <Muted size={12.5} color="#9B7FC0" center lh={17}>
              do północy {etaText(toMid)} — potem sen utrwala to, co dziś powtórzysz
            </Muted>
          </Motion>
          <Eyebrow>Plan na {total} minut</Eyebrow>
          <View style={{ gap: 10 }}>
            {blocks.map((b, i) => {
              const set = TONES[TONE[b.id] ?? "violet"];
              return (
                <Motion key={b.id} kind="up" d={i + 1}>
                  <View style={[s.row, { backgroundColor: set.tint, borderColor: set.tintLine }]}>
                    <View style={[s.num, { backgroundColor: set.color }]}>
                      <Display size={18} color={T.bg}>
                        {i + 1}
                      </Display>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Body size={14} weight={800}>
                        {b.t}
                      </Body>
                      <Muted size={12} style={{ marginTop: 2 }} lh={16}>
                        {b.s}
                      </Muted>
                    </View>
                    <Body size={13} weight={800} color={set.color}>
                      5 min
                    </Body>
                  </View>
                </Motion>
              );
            })}
            {!blocks.length ? <Muted center>Brak fiszek i pytań w tym przedmiocie.</Muted> : null}
          </View>
          <Motion kind="up" d={5}>
            <Note dashed icon="info" text="Blok kończy się po 5 minutach albo gdy przejrzysz wszystko. Potem idź spać — sen utrwala to, czego się właśnie nauczyłeś." />
          </Motion>
          <Btn label="Zaczynam" tone="violet" glow disabled={!blocks.length} onPress={() => setRun({ bi: 0, ii: 0, left: BLOCK_SEC, ok: 0, bad: 0, xp: 0, marks: {}, t0: nowMs(), done: false })} style={{ marginTop: 4 }} />
        </View>
      </Screen>
    </AccentProvider>
  );
}

function Stars() {
  return (
    <>
      {[
        [40, 110, 4],
        [320, 90, 3],
        [300, 200, 4],
        [70, 230, 3],
        [200, 70, 3],
      ].map(([x, y, sz], i) => (
        <Motion key={i} kind="blink" d={i + 1} pointerEvents="none" style={{ position: "absolute", left: x, top: y, width: sz, height: sz, borderRadius: sz! / 2, backgroundColor: "#D6B4F5" }} />
      ))}
    </>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 13 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18 },
  timer: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: TONES.amber.tint, borderWidth: 2, borderColor: TONES.amber.tintLine, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 13, borderWidth: 2, borderRadius: 20, padding: 14 },
  num: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  done: { flex: 1, paddingHorizontal: 22, alignItems: "center", gap: 18 },
  moon: { width: 132, height: 132, borderRadius: 66, backgroundColor: TONES.violet.tint, borderWidth: 2, borderColor: T.violet, alignItems: "center", justifyContent: "center" },
  stat: { flex: 1, borderWidth: 2, borderRadius: 22, paddingVertical: 15, paddingHorizontal: 10, alignItems: "center" },
});
