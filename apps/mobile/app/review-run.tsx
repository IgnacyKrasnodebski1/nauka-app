import { dayDiff, newCard, review } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Flip, KnowButtons, SwipeHint } from "@/components/Flip";
import { Icon } from "@/components/Icon";
import { Confetti, Motion } from "@/components/Motion";
import { QuizBlock } from "@/components/QuizBlock";
import { ExplainSheet, SheetBad, SheetOk, SourceSheet, type QCtx } from "@/components/Sheets";
import { Body, Display, Eyebrow, Muted, Num } from "@/components/Text";
import { Blob, Btn, Card, Empty, IconTile, Press, Ring, RoundBtn, Screen, SegBar, Sep, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { noEmoji, npl, todayIso } from "@/lib/format";
import { play } from "@/lib/sfx";
import { dueEntries, type SrsEntry } from "@/lib/srs-view";
import { T, TONES } from "@/lib/theme";
import { cardPool, quizPool, shuffle, type QuizRef } from "@/lib/topic-view";

type Item = { kind: "card"; subjectId: string; e: SrsEntry } | { kind: "quiz"; subjectId: string; q: QuizRef };

/**
 * Sesja powtórki (legacy `renderReviewSession` → `finishReview`, FlashcardsDone.html): zaległe fiszki SRS (opcjonalnie jeden
 * przedmiot), `deck=1` = talia błędów (pytania z `weak`), `cram` = ustalona lista. Fiszka: tap = obrót, przeciągnięcie = odpowiedź;
 * pytanie: kafle + panele. Bez serc i combo; +2/+3 XP, plan dnia „review”/„weak”, misje, dzień planu do sprawdzianu.
 */
export default function ReviewRun() {
  const { subjectId, deck, limit } = useLocalSearchParams<{ subjectId?: string; deck?: string; limit?: string }>();
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const [items] = useState<Item[]>(() => {
    const max = limit ? Math.max(1, +limit || 15) : 0;
    if (deck === "1") {
      const out: Item[] = [];
      for (const t of app.topics) {
        if (subjectId && t.subjectId !== subjectId) continue;
        const w = app.weak[t.id] ?? {};
        const pool = quizPool(t, app.extra.overrides);
        for (const [lid, idxs] of Object.entries(w)) for (const qi of idxs) {
          const q = pool.find((x) => x.levelId === lid && x.qi === qi);
          if (q) out.push({ kind: "quiz", subjectId: t.subjectId, q });
        }
      }
      return shuffle(out);
    }
    const { due, all } = dueEntries(app, subjectId);
    const sidOf = (e: SrsEntry) => app.findTopic(e.topicId)?.subjectId ?? subjectId ?? "";
    if (due.length) return (max ? due.slice(0, max) : due).map((e) => ({ kind: "card", subjectId: sidOf(e), e }));
    if (!subjectId) return [];
    // plan do sprawdzianu: bez zaległości → losowe wpisy SRS przedmiotu, a bez SRS → fiszki (max 15)
    if (all.length) return shuffle(all).slice(0, max || 15).map((e) => ({ kind: "card", subjectId: sidOf(e), e }));
    const cards = app.topicsOf(subjectId).flatMap((t) => cardPool(t, app.extra.overrides).map((c) => ({ kind: "card" as const, subjectId, e: { topicId: c.topicId, levelId: c.levelId, index: c.index, key: c.key, card: app.srsFor(c.topicId)[c.key] ?? newCard(), term: c.t, def: c.d, lvl: c.lvl } })));
    return shuffle(cards).slice(0, max || 15);
  });
  const [list, setList] = useState<Item[]>(items);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ok, setOk] = useState(0);
  const [bad, setBad] = useState(0);
  const [xp, setXp] = useState(0);
  const [wrong, setWrong] = useState<Item[]>([]);
  const [marks, setMarks] = useState<Record<number, "bad">>({});
  const [sheet, setSheet] = useState<{ ok: boolean; xp: number; q: QuizRef } | null>(null);
  const [explain, setExplain] = useState<QCtx | null>(null);
  const [src, setSrc] = useState<QCtx | null>(null);
  const [finished, setFinished] = useState(false);
  const [conf, setConf] = useState(0);
  const [subs, setSubs] = useState<string[]>([]);
  const closed = useRef(false);
  const cur = list[idx];
  const exit = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/review"));
  const touchSub = (sid: string) => setSubs((s) => (s.includes(sid) ? s : [...s, sid]));

  const finish = (okN: number, badN: number, sids: string[] = subs) => {
    if (closed.current) return;
    closed.current = true;
    const total = okN + badN;
    if (deck === "1") {
      if (total && subjectId) {
        app.completeDaily(subjectId, "weak");
        app.markTestDone(subjectId, "weak");
      }
    } else {
      let doneAny = false;
      sids.forEach((sid) => {
        if (app.completeDaily(sid, "review")) doneAny = true;
      });
      if (!doneAny && total) {
        const t = app.planItems.find((p) => !p.task.done && p.kind === "review");
        if (t) app.completeDaily(t.subjectId, "review");
      }
      if (total) sids.forEach((sid) => app.markTestDone(sid, "review"));
    }
    if (total) play(okN >= badN ? "levelup" : "wrong");
    setFinished(true);
  };
  const advance = (nextIdx: number, okN: number, badN: number, sid?: string) => {
    setSheet(null);
    setFlipped(false);
    setIdx(nextIdx);
    if (nextIdx >= list.length) finish(okN, badN, sid && !subs.includes(sid) ? [...subs, sid] : subs);
  };
  const answerCard = (known: boolean) => {
    if (!cur || cur.kind !== "card") return;
    const e = cur.e;
    touchSub(cur.subjectId);
    const next = review(app.srsFor(e.topicId)[e.key] ?? e.card, known ? 2 : 0);
    app.reviewCard(e.topicId, e.levelId, e.index, e.key, next, e.term);
    app.tickDaily(cur.subjectId, "review", 1);
    app.questEvent({ type: "review", count: 1 });
    let okN = ok,
      badN = bad;
    if (known) {
      const got = app.addXp(e.topicId, 2);
      setXp((v) => v + got);
      okN++;
      setOk(okN);
      play("correct");
    } else {
      badN++;
      setBad(badN);
      setWrong((w) => [...w, cur]);
      setMarks((m) => ({ ...m, [idx]: "bad" }));
      play("wrong");
    }
    advance(idx + 1, okN, badN, cur.subjectId);
  };
  const answerQuiz = (i: number, okQ: boolean) => {
    if (!cur || cur.kind !== "quiz") return;
    const q = cur.q;
    touchSub(cur.subjectId);
    app.setWeak(q.topicId, q.levelId, okQ ? [] : [q.qi], okQ ? [q.qi] : []);
    app.tickDaily(cur.subjectId, "review", 1);
    app.questEvent({ type: "review", count: 1 });
    app.questEvent({ type: "answer", correct: okQ, combo: 0 });
    let got = 0;
    if (okQ) {
      got = app.addXp(q.topicId, 3);
      setXp((v) => v + got);
      setOk((v) => v + 1);
      setConf((c) => c + 1);
    } else {
      setBad((v) => v + 1);
      setWrong((w) => [...w, cur]);
      setMarks((m) => ({ ...m, [idx]: "bad" }));
    }
    setSheet({ ok: okQ, xp: got, q });
  };
  const ctxOf = (q: QuizRef): QCtx | null => {
    const t = app.findTopic(q.topicId);
    const lv = t?.levels.find((l) => l.id === q.levelId);
    return t && lv ? { topic: t, level: lv, qi: q.qi, q: q.q } : null;
  };
  const again = (l: Item[]) => {
    closed.current = false;
    setList(shuffle(l));
    setIdx(0);
    setOk(0);
    setBad(0);
    setXp(0);
    setWrong([]);
    setMarks({});
    setSheet(null);
    setFinished(false);
    setFlipped(false);
    setSubs([]);
  };
  const subjectName = (sid: string) => noEmoji(app.findSubject(sid)?.name ?? "");

  if (!list.length)
    return (
      <Screen>
        <Empty icon="refresh" title={deck === "1" ? "Talia błędów jest pusta" : "Nic do powtórki"} text={deck === "1" ? "Błędne odpowiedzi z quizu i egzaminu trafiają tutaj." : "Pojęcia wrócą tu we właściwym dniu. Ucz się z fiszek i lekcji."} action={<Btn label="Wróć" onPress={exit} />} />
      </Screen>
    );

  if (finished || !cur) {
    const total = ok + bad;
    const pct = total ? Math.round((ok / total) * 100) : 0;
    const doneItems = list.slice(0, idx);
    const cards = doneItems.filter((x) => x.kind === "card").length;
    const qs = doneItems.length - cards;
    const subsTxt = subs.map(subjectName).filter(Boolean).join(" · ");
    const n = app.streak;
    const plan = app.planItems;
    const dd = plan.filter((p) => p.task.done).length;
    const { all } = dueEntries(app);
    const today = todayIso();
    const fut = all.map((e) => e.card.due).filter((d) => d > today).sort();
    const nd = fut.length ? Math.max(1, dayDiff(today, fut[0]!)) : 0;
    const ndText = nd === 1 ? "jutro" : nd ? `za ${npl(nd, "dzień", "dni", "dni")}` : "";
    return (
      <Screen scroll pad={false} bottom={26} blob={<Blob tone="cyan2" size={300} top={70} center />}>
        {pct >= 50 ? <Confetti n={6} colors={[T.cyan, T.acid, T.gold, T.pink]} top={90} /> : null}
        <View style={[s.done, { paddingTop: top + 30 }]}>
          <Motion kind="pop">
            <Ring pct={pct} size={124} stroke={11} color={T.cyan}>
              <Num size={34} color={T.cyan}>
                {pct}%
              </Num>
              <Eyebrow size={10.5} color="#7FAEBC" style={{ marginTop: 3 }}>
                umiem
              </Eyebrow>
            </Ring>
          </Motion>
          <Motion kind="up" d={2} style={{ alignItems: "center" }}>
            <Display size={31} ls={-1.1} center>
              Powtórka skończona
            </Display>
            <Muted size={14} weight={700} center style={{ marginTop: 7 }}>
              {subsTxt ? subsTxt + " · " : ""}
              {npl(cards, "pojęcie", "pojęcia", "pojęć")}
              {qs ? ` · ${npl(qs, "pytanie", "pytania", "pytań")}` : ""}
            </Muted>
          </Motion>
          <Motion kind="up" d={3} style={{ flexDirection: "row", gap: 11, alignSelf: "stretch" }}>
            <Stat v={String(ok)} k="umiem" tone="acid" />
            <Stat v={String(bad)} k="do powtórki" tone="red" />
            <Stat v={`+${xp}`} k="XP" tone="gold" />
          </Motion>
          <Motion kind="up" d={4} style={{ alignSelf: "stretch" }}>
            <Card padding={0}>
              <View style={{ paddingHorizontal: 15 }}>
                <Eyebrow style={{ paddingTop: 11, paddingBottom: 5 }}>{wrong.length ? "Wracają dziś" : "Najbliższa powtórka"}</Eyebrow>
                {wrong.length ? (
                  wrong.slice(0, 3).map((w, i) => {
                    const name = w.kind === "card" ? w.e.term : w.q.q.q;
                    const seen = w.kind === "card" ? (app.srsFor(w.e.topicId)[w.e.key]?.lapses ?? 0) + 1 : 1;
                    return (
                      <React.Fragment key={i}>
                        {i ? <Sep /> : null}
                        <View style={s.wrow}>
                          <View style={[s.dot, { backgroundColor: seen > 1 ? T.red : T.gold }]} />
                          <Body size={13.5} color={T.txt2} style={{ flex: 1 }} numberOfLines={1}>
                            {name}
                          </Body>
                          <Muted size={11.5} weight={700}>
                            {seen}. raz
                          </Muted>
                        </View>
                      </React.Fragment>
                    );
                  })
                ) : (
                  <View style={s.wrow}>
                    <View style={[s.dot, { backgroundColor: T.gold }]} />
                    <Body size={13.5} color={T.txt2} style={{ flex: 1 }}>
                      Najbliższa powtórka
                    </Body>
                    <Body size={11.5} weight={800} color={T.acid}>
                      {ndText || "gdy dojdą nowe pojęcia"}
                    </Body>
                  </View>
                )}
                {wrong.length > 3 ? (
                  <>
                    <Sep />
                    <Muted size={12.5} weight={700} style={{ paddingVertical: 10 }}>
                      i {npl(wrong.length - 3, "kolejne", "kolejne", "kolejnych")}
                    </Muted>
                  </>
                ) : (
                  <View style={{ height: 8 }} />
                )}
              </View>
            </Card>
          </Motion>
          <Motion kind="up" d={5} style={{ alignSelf: "stretch" }}>
            <Press onPress={() => router.push("/streak")} drop={4} edge={TONES.amber.tintShadow} radius={22} faceStyle={s.streak} accessibilityLabel="Seria">
              <IconTile icon="flame" size={44} color={T.flame} on={T.onAmber} />
              <View style={{ flex: 1 }}>
                <Body size={15} weight={800}>
                  {n} {npl(n, "dzień", "dni", "dni").replace(/^\d+ /, "")} z rzędu
                </Body>
                <Muted size={12.5} color={TONES.amber.sub} style={{ marginTop: 2 }}>
                  {plan.length && dd >= plan.length ? "Plan dnia zrobiony" : `Plan dnia: ${dd} z ${plan.length}`}
                  {ndText ? ` · następna powtórka ${ndText}` : ""}
                </Muted>
              </View>
              <Icon name="chevron-right" size={20} color={TONES.amber.sub} />
            </Press>
          </Motion>
          <View style={{ flex: 1 }} />
          <View style={{ alignSelf: "stretch", gap: 10 }}>
            <Btn label={wrong.length ? `Powtórz te ${wrong.length}` : "Gotowe"} tone="cyan" glow onPress={wrong.length ? () => again(wrong) : exit} />
            <Btn label="Na dziś wystarczy" variant="text" onPress={exit} />
          </View>
        </View>
      </Screen>
    );
  }

  const subj = app.findSubject(cur.subjectId);
  const head = (
    <View style={[s.head, { paddingTop: top }]}>
      <RoundBtn icon="close" onPress={() => (idx > 0 ? finish(ok, bad) : exit())} label="Przerwij powtórkę" />
      <SegBar total={list.length} done={idx} marks={marks} color={T.cyan} />
      <Body size={12} weight={800} color={T.muted}>
        {idx + 1} z {list.length}
      </Body>
    </View>
  );
  return (
    <AccentProvider color={subj?.accent2 ?? T.cyan} seed={subj?.name ?? "powtórka"}>
      <Screen pad={false} blob={<Blob tone="cyan" size={300} top={120} right={-120} />}>
        {head}
        {cur.kind === "card" ? (
          <>
            <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 22 }}>
              <Flip key={`${cur.e.topicId}-${cur.e.key}-${idx}`} term={cur.e.term} def={cur.e.def} tag={`${subjectName(cur.subjectId)} · ${cur.e.lvl}`} counter={`${idx + 1} / ${list.length}`} flipped={flipped} onFlip={() => setFlipped((f) => !f)} onSwipe={answerCard} height={360} />
              <View style={{ marginTop: 22 }}>
                <SwipeHint left="w lewo = jeszcze nie" />
              </View>
            </View>
            <View style={{ paddingHorizontal: 18, paddingBottom: 26, paddingTop: 12 }}>
              <KnowButtons onNo={() => answerCard(false)} onYes={() => answerCard(true)} noLabel="jeszcze nie" />
            </View>
          </>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 20, paddingBottom: 26 }} showsVerticalScrollIndicator={false}>
            {conf ? <Confetti key={conf} n={4} colors={[T.acid, T.gold, T.pink, T.cyan]} top={30} /> : null}
            <QuizBlock key={`${cur.q.topicId}-${cur.q.levelId}-${cur.q.qi}-${idx}`} q={cur.q.q} n={idx + 1} total={list.length} tag={`${subjectName(cur.subjectId)}${cur.q.lvl ? ` · ${cur.q.lvl}` : ""}`} onAnswer={answerQuiz} footInline />
          </ScrollView>
        )}
        {sheet ? (
          sheet.ok ? (
            <SheetOk open fb={{ e: sheet.q.q.e }} xp={sheet.xp} mult={1} combo={0} onNext={() => advance(idx + 1, ok, bad)} q={sheet.q.q} onSource={sheet.q.q.src ? () => setSrc(ctxOf(sheet.q)) : undefined} />
          ) : (
            <SheetBad open fb={{ e: sheet.q.q.e }} q={sheet.q.q} onNext={() => advance(idx + 1, ok, bad)} onExplain={() => setExplain(ctxOf(sheet.q))} onEdit={() => router.push({ pathname: "/edit-question", params: { topicId: sheet.q.topicId, levelId: sheet.q.levelId, qi: String(sheet.q.qi) } })} onSource={sheet.q.q.src ? () => setSrc(ctxOf(sheet.q)) : undefined} />
          )
        ) : null}
        <ExplainSheet open={!!explain} ctx={explain} onClose={() => setExplain(null)} />
        <SourceSheet open={!!src} q={src?.q} ctx={src} onClose={() => setSrc(null)} />
      </Screen>
    </AccentProvider>
  );
}

function Stat({ v, k, tone }: { v: string; k: string; tone: "acid" | "red" | "gold" }) {
  const set = TONES[tone];
  return (
    <View style={[s.stat, { backgroundColor: set.tint, borderColor: set.tintLine, shadowColor: set.tintShadow }]}>
      <Num size={28} color={set.color}>
        {v}
      </Num>
      <Muted size={11.5} weight={700} color={set.sub} style={{ marginTop: 3 }}>
        {k}
      </Muted>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18 },
  done: { flex: 1, paddingHorizontal: 22, alignItems: "center", gap: 18 },
  stat: { flex: 1, borderWidth: 2, borderRadius: 22, paddingVertical: 15, paddingHorizontal: 10, alignItems: "center", shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 } },
  wrow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 9 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  streak: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: TONES.amber.tint, borderWidth: 2, borderColor: TONES.amber.tintLine, paddingVertical: 14, paddingHorizontal: 16 },
});
