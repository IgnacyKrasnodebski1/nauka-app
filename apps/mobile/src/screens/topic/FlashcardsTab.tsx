import { XP, cardKey, isDue, newCard, review, type SrsGrade, type Topic } from "@nauka/shared";
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button3D } from "@/components/Button3D";
import { FlashcardDeck, type DeckCard } from "@/components/FlashcardDeck";
import { Icon } from "@/components/Icon";
import { Mascot } from "@/components/Mascot";
import { Body, Display, Muted, Num } from "@/components/Text";
import { Chips } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { play } from "@/lib/sfx";
import { COLORS, PLAY, RADIUS, SPACE, UI, tabular } from "@/lib/theme";

interface CardRef extends DeckCard {
  topicId: string;
  levelId: string;
}

/** Fiszki jako stos swipe (SwipeDeck): „do powtórki” (SRS), „wszystko”, po poziomach/tematach; licznik sesji. */
export function FlashcardsTab({ topics }: { topics: Topic[] }) {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<string>("due");
  const [idx, setIdx] = useState(0);
  const [session, setSession] = useState({ known: 0, again: 0 });
  const multi = topics.length > 1;

  const all = useMemo<CardRef[]>(
    () => topics.flatMap((tp) => tp.levels.flatMap((l) => l.flashcards.map((c, i) => ({ t: c.t, d: c.d, key: `${tp.id}:${cardKey(l.id, i)}`, tag: multi ? tp.name : l.title, topicId: tp.id, levelId: l.id })))),
    [topics, multi],
  );
  const due = useMemo(
    () =>
      all.filter((c) => {
        const st = app.srs[c.topicId]?.[c.key.slice(c.topicId.length + 1)];
        return st ? isDue(st) : true;
      }),
    [all, app.srs],
  );
  const list = useMemo(() => {
    if (filter === "due") return due;
    if (filter === "all") return all;
    return all.filter((c) => (multi ? c.topicId === filter : c.levelId === filter));
  }, [filter, all, due, multi]);

  const card = list[idx];
  const finished = list.length > 0 && idx >= list.length;

  const grade = (g: SrsGrade, c: DeckCard) => {
    const ref = c as CardRef;
    const key = ref.key.slice(ref.topicId.length + 1);
    const srs = app.srsFor(ref.topicId);
    app.setSrsFor(ref.topicId, { ...srs, [key]: review(srs[key] ?? newCard(), g) });
    app.questEvent({ type: "review", count: 1 });
    app.bumpStats((st) => ({ cardsReviewed: st.cardsReviewed + 1 }));
    if (g >= 2) {
      app.addXp(ref.topicId, XP.flashcardKnown);
      haptic.ok();
      play("correct");
      setSession((x) => ({ ...x, known: x.known + 1 }));
    } else {
      haptic.tap();
      setSession((x) => ({ ...x, again: x.again + 1 }));
    }
    setIdx((i) => i + 1);
  };

  const reset = (f = filter) => {
    setFilter(f);
    setIdx(0);
    setSession({ known: 0, again: 0 });
  };

  const chips = [
    { id: "due", label: `Do powtórki · ${due.length}` },
    { id: "all", label: "Wszystkie" },
    ...(multi ? topics.map((t) => ({ id: t.id, label: `${t.emoji} ${t.name}` })) : (topics[0]?.levels ?? []).map((l) => ({ id: l.id, label: l.title }))),
  ];

  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom + SPACE[3] }]}>
      <Chips items={chips} value={filter} onChange={(f) => reset(f)} />
      {!list.length ? (
        <View style={s.empty}>
          <Mascot state="happy" size={120} streak={app.streak} />
          <Display size="lg" weight={700} center>
            {filter === "due" ? "Nic do powtórki" : "Brak fiszek"}
          </Display>
          <Body center color={COLORS.muted}>
            {filter === "due" ? "Na dziś czysto. Wróć jutro albo przejrzyj wszystkie." : "Nie ma tu jeszcze fiszek."}
          </Body>
          {filter === "due" && all.length ? <Button3D label="Przejrzyj wszystkie" variant="blue" onPress={() => reset("all")} /> : null}
        </View>
      ) : finished ? (
        <View style={s.empty}>
          <Mascot state="cheer" size={120} streak={app.streak} />
          <Display size="lg" weight={700} center>
            Stos przerobiony
          </Display>
          <View style={{ flexDirection: "row", gap: SPACE[3] }}>
            <Stat value={session.known} label="umiem" color={PLAY.green} />
            <Stat value={session.again} label="do powtórki" color={PLAY.red} />
            <Stat value={session.known * XP.flashcardKnown} label="XP" color={PLAY.yellow} />
          </View>
          <Button3D label="Jeszcze raz" variant="green" onPress={() => reset()} />
        </View>
      ) : (
        <>
          <View style={s.meta}>
            <View style={s.count}>
              <Icon name="layers" size={14} color={COLORS.muted} />
              <Muted size="xs" weight={700} style={tabular}>
                {idx + 1}/{list.length}
              </Muted>
            </View>
            <View style={s.count}>
              <Icon name="checkmark" size={14} color={PLAY.green} />
              <Muted size="xs" weight={700} color={PLAY.green} style={tabular}>
                {session.known}
              </Muted>
              <Icon name="refresh" size={14} color={PLAY.red} style={{ marginLeft: 6 }} />
              <Muted size="xs" weight={700} color={PLAY.red} style={tabular}>
                {session.again}
              </Muted>
            </View>
          </View>
          <FlashcardDeck cards={list} index={idx} onGrade={(g, c) => grade(g, c)} style={{ flex: 1 }} />
          {card ? null : null}
        </>
      )}
    </View>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={[s.stat, { borderBottomColor: color }]}>
      <Num size="lg" weight={800} color={color}>
        {value}
      </Num>
      <Muted size="xs" weight={600}>
        {label}
      </Muted>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: UI.gutter },
  meta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE[3] },
  count: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.pill, paddingVertical: 5, paddingHorizontal: 10 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE[3], paddingHorizontal: SPACE[4] },
  stat: { minWidth: 84, alignItems: "center", backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderBottomWidth: 4, borderRadius: RADIUS.md, padding: SPACE[3] },
});
