import { newCard, review } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Flip, KnowButtons, SwipeHint } from "@/components/Flip";
import { Bar, Confetti, Motion } from "@/components/Motion";
import { Body, Display, Eyebrow, Muted, Num } from "@/components/Text";
import { Blob, Btn, Card, Chip, Empty, Pill, Ring, RoundBtn, Screen, Sep, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { noEmoji, npl } from "@/lib/format";
import { play } from "@/lib/sfx";
import { T, TONES } from "@/lib/theme";
import { cardPool, shuffle, topicShort, type CardRef } from "@/lib/topic-view";

const HEAL_CARDS = 5;

/**
 * Fiszki przedmiotu (Flashcards.html → FlashcardsDone.html): talia z fiszek tematów (filtr po temacie / poziomie), tap = obrót,
 * przeciągnięcie = odpowiedź. Każda odpowiedź trafia do SRS (`reviewCard`), „umiem” = +2 XP, licznik planu dnia i misji.
 * `heal=1` (z arkusza Koniec żyć): po 5 fiszkach wraca jedno życie.
 */
export default function SubjectCards() {
  const { subjectId, topicId, levelId, heal } = useLocalSearchParams<{ subjectId: string; topicId?: string; levelId?: string; heal?: string }>();
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const subject = app.findSubject(subjectId ?? "");
  const topics = app.topicsOf(subjectId ?? "");
  const [filter, setFilter] = useState<string>(levelId && topicId ? `l:${topicId}:${levelId}` : topicId ? `t:${topicId}` : "all");
  const build = (f: string, mix: boolean) => {
    const [kind, fTopic, fLevel] = f.split(":");
    let list: CardRef[] = [];
    for (const t of topics) {
      if (kind !== "all" && t.id !== fTopic) continue;
      list = list.concat(cardPool(t, app.extra.overrides, kind === "l" && fLevel ? [fLevel] : null));
    }
    return mix ? shuffle(list) : list;
  };
  const [deck, setDeck] = useState<CardRef[]>(() => build(filter, false));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ok, setOk] = useState(0);
  const [wrong, setWrong] = useState<CardRef[]>([]);
  const [xp, setXp] = useState(0);
  const [again, setAgain] = useState<CardRef[] | null>(null);
  const [healed, setHealed] = useState(0);
  const list = again ?? deck;
  const card = list[idx];
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/s/[subjectId]", params: { subjectId: subjectId ?? "" } }));
  const reset = (l: CardRef[] | null, f = filter) => {
    setAgain(l);
    setIdx(0);
    setFlipped(false);
    setOk(0);
    setWrong([]);
    setXp(0);
    if (!l) setDeck(build(f, true));
  };
  const answer = (known: boolean) => {
      if (!card) return;
      const prev = app.srsFor(card.topicId)[card.key] ?? newCard();
      const next = review(prev, known ? 2 : 0);
      app.reviewCard(card.topicId, card.levelId, card.index, card.key, next, card.t);
      if (known) {
        const got = app.addXp(card.topicId, 2);
        setXp((v) => v + got);
        setOk((v) => v + 1);
        play("correct");
      } else {
        setWrong((w) => [...w, card]);
        play("wrong");
      }
      app.tickDaily(subjectId ?? "", "review", 1);
      app.questEvent({ type: "review", count: 1 });
      if (heal === "1" && healed < HEAL_CARDS) {
        setHealed(healed + 1);
        if (healed + 1 === HEAL_CARDS) {
          app.gainHeart(1);
          setTimeout(() => app.showToast("Życie odzyskane: +1", "heart"), 350);
        }
      }
      setFlipped(false);
      setIdx((i) => i + 1);
  };
  if (!subject)
    return (
      <Screen>
        <Empty icon="alert" title="Nie ma takiego przedmiotu" action={<Btn label="Wróć" onPress={back} />} />
      </Screen>
    );
  const chips = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
      <Chip label="Wszystko" active={filter === "all"} onPress={() => { setFilter("all"); reset(null, "all"); }} />
      {topics.map((t) => (
        <Chip key={t.id} label={topicShort(t)} active={filter === `t:${t.id}`} onPress={() => { setFilter(`t:${t.id}`); reset(null, `t:${t.id}`); }} />
      ))}
    </View>
  );
  if (!list.length)
    return (
      <AccentProvider color={subject.accent2} seed={subject.name}>
        <Screen pad={false}>
          <View style={[s.head, { paddingTop: top }]}>
            <RoundBtn icon="back" onPress={back} label="Wróć" />
            <Display size={18} ls={-0.4} style={{ flex: 1 }}>
              Fiszki · {noEmoji(subject.name)}
            </Display>
          </View>
          <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>{topics.length > 1 ? chips : null}</View>
          <Empty icon="cards" title="Brak fiszek" text="Dodaj materiał do tego przedmiotu — z każdej dawki powstają fiszki." action={<Btn label="Dodaj materiał" onPress={() => router.push({ pathname: "/add", params: { subjectId: subject.id } })} />} />
        </Screen>
      </AccentProvider>
    );
  if (!card) {
    const total = ok + wrong.length;
    const pct = total ? Math.round((ok / total) * 100) : 0;
    return (
      <AccentProvider color={subject.accent2} seed={subject.name}>
        <Screen scroll pad={false} bottom={26} blob={<Blob tone="cyan2" size={300} top={70} center />}>
          {pct >= 50 ? <Confetti n={5} colors={[T.cyan, T.acid, T.gold, T.pink]} top={90} /> : null}
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
                Talia skończona
              </Display>
              <Muted size={14} weight={700} center style={{ marginTop: 7 }}>
                {noEmoji(subject.name)} · {npl(total, "pojęcie", "pojęcia", "pojęć")}
              </Muted>
            </Motion>
            <Motion kind="up" d={3} style={{ flexDirection: "row", gap: 11, alignSelf: "stretch" }}>
              <Stat v={String(ok)} k="umiem" tone="acid" />
              <Stat v={String(wrong.length)} k="do powtórki" tone="red" />
              <Stat v={`+${xp}`} k="XP" tone="gold" />
            </Motion>
            <Motion kind="up" d={4} style={{ alignSelf: "stretch" }}>
              <Card padding={0}>
                <View style={{ paddingHorizontal: 15 }}>
                  <Eyebrow style={{ paddingTop: 11, paddingBottom: 5 }}>{wrong.length ? "Te wracają jutro" : "Najbliższa powtórka"}</Eyebrow>
                  {wrong.length ? (
                    wrong.slice(0, 3).map((w, i) => {
                      const seen = (app.srsFor(w.topicId)[w.key]?.lapses ?? 0) + 1;
                      return (
                        <React.Fragment key={w.topicId + w.key}>
                          {i ? <Sep /> : null}
                          <View style={s.wrow}>
                            <View style={[s.dot, { backgroundColor: seen > 1 ? T.red : T.gold }]} />
                            <Body size={13.5} color={T.txt2} style={{ flex: 1 }} numberOfLines={1}>
                              {w.t}
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
                        Wszystko umiesz
                      </Body>
                      <Body size={11.5} weight={800} color={T.acid}>
                        wracają wg terminów
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
            <View style={{ flex: 1 }} />
            <View style={{ alignSelf: "stretch", gap: 10 }}>
              {wrong.length ? <Btn label={`Powtórz te ${wrong.length}`} tone="cyan" glow onPress={() => reset(shuffle(wrong))} /> : <Btn label="Jeszcze raz" tone="cyan" glow onPress={() => reset(null)} />}
              <Btn label="Na dziś wystarczy" variant="text" onPress={back} />
            </View>
          </View>
        </Screen>
      </AccentProvider>
    );
  }
  const topic = topics.find((t) => t.id === card.topicId);
  return (
    <AccentProvider color={subject.accent2} seed={subject.name}>
      <Screen pad={false} blob={<Blob tone="cyan" size={300} bottom={-80} left={-60} />}>
        <View style={[s.head, { paddingTop: top }]}>
          <RoundBtn icon="back" onPress={back} label="Wróć" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Display size={18} ls={-0.4} numberOfLines={1}>
              Fiszki · {noEmoji(subject.name)}
            </Display>
            <Muted size={12} weight={700} style={{ marginTop: 2 }}>
              {idx + 1} z {list.length} · zostało {list.length - idx - 1}
              {heal === "1" && healed < HEAL_CARDS ? ` · życie za ${HEAL_CARDS - healed}` : ""}
            </Muted>
          </View>
          <Pill kind="acid" value={xp} />
        </View>
        <View style={{ paddingHorizontal: 18, paddingTop: 12, gap: 10 }}>
          {topics.length > 1 && idx === 0 ? chips : null}
          <Bar pct={(idx / list.length) * 100} color={T.acid} />
        </View>
        <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 22 }}>
          <Flip key={card.topicId + card.key + idx} term={card.t} def={card.d} tag={topics.length > 1 && topic ? `${topicShort(topic)} · ${card.lvl}` : card.lvl} counter={`${idx + 1} / ${list.length}`} flipped={flipped} onFlip={() => setFlipped((f) => !f)} onSwipe={answer} height={Math.min(392, 360)} />
          <View style={{ marginTop: 22 }}>
            <SwipeHint />
          </View>
        </View>
        <View style={{ paddingHorizontal: 18, paddingBottom: 26, paddingTop: 12 }}>
          <KnowButtons onNo={() => answer(false)} onYes={() => answer(true)} />
        </View>
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
});

