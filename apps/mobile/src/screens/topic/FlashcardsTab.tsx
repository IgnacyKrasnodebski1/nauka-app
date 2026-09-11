import { XP, cardKey, isDue, newCard, review, type SrsGrade, type Topic } from "@nauka/shared";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Flashcard } from "@/components/Flashcard";
import { Chips, Empty, ProgressRow, Touch } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { COLORS, RADIUS, SPACE, UI, body } from "@/lib/theme";

interface CardRef {
  t: string;
  d: string;
  key: string;
  topicId: string;
  lvl: string;
  levelId: string;
}

export const GRADES: { g: SrsGrade; label: string; color: string; soft: string }[] = [
  { g: 0, label: "Nie", color: COLORS.danger, soft: COLORS.dangerSoft },
  { g: 1, label: "Trudne", color: COLORS.streak, soft: "rgba(255,138,61,0.14)" },
  { g: 2, label: "Umiem", color: COLORS.success, soft: COLORS.successSoft },
  { g: 3, label: "Łatwe", color: COLORS.info, soft: COLORS.infoSoft },
];

/** 4 chipy oceny 0–3 (SRS). */
export function GradeRow({ onGrade }: { onGrade: (g: SrsGrade) => void }) {
  return (
    <View style={gr.row}>
      {GRADES.map((x) => (
        <Touch key={x.g} onPress={() => onGrade(x.g)} style={[gr.btn, { backgroundColor: x.soft, borderColor: x.color }]}>
          <Text style={[gr.txt, { color: x.color }]}>{x.label}</Text>
        </Touch>
      ))}
    </View>
  );
}
export const gr = StyleSheet.create({
  row: { flexDirection: "row", gap: SPACE[2], marginTop: SPACE[4] },
  btn: { flex: 1, height: 48, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  txt: { fontSize: 14, fontFamily: body(700) },
  show: { height: 48, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.lineStrong, marginTop: SPACE[4] },
});

/** Fiszki z jednego tematu albo z całego przedmiotu: „do powtórki” (SRS), „wszystko”, po poziomach/tematach. */
export function FlashcardsTab({ topics }: { topics: Topic[] }) {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<string>("due");
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const multi = topics.length > 1;

  const all = useMemo<CardRef[]>(
    () => topics.flatMap((tp) => tp.levels.flatMap((l) => l.flashcards.map((c, i) => ({ t: c.t, d: c.d, key: cardKey(l.id, i), topicId: tp.id, lvl: multi ? tp.name : l.title, levelId: l.id })))),
    [topics, multi],
  );
  const due = useMemo(
    () =>
      all.filter((c) => {
        const st = app.srs[c.topicId]?.[c.key];
        return st ? isDue(st) : true;
      }),
    [all, app.srs],
  );
  const list = useMemo(() => {
    if (filter === "due") return due;
    if (filter === "all") return all;
    return all.filter((c) => (multi ? c.topicId === filter : c.levelId === filter));
  }, [filter, all, due, multi]);

  const safeIdx = list.length ? idx % list.length : 0;
  const card = list[safeIdx];

  const grade = (g: SrsGrade) => {
    if (!card) return;
    const srs = app.srsFor(card.topicId);
    app.setSrsFor(card.topicId, { ...srs, [card.key]: review(srs[card.key] ?? newCard(), g) });
    if (g >= 2) {
      app.addXp(card.topicId, XP.flashcardKnown);
      haptic.ok();
    } else haptic.tap();
    setFlipped(false);
    if (filter === "due") setIdx((i) => (list.length > 1 ? Math.min(i, list.length - 2) : 0));
    else setIdx((i) => (i + 1) % Math.max(1, list.length));
  };

  const chips = [
    { id: "due", label: `Do powtórki · ${due.length}` },
    { id: "all", label: "Wszystkie" },
    ...(multi ? topics.map((t) => ({ id: t.id, label: `${t.emoji} ${t.name}` })) : (topics[0]?.levels ?? []).map((l) => ({ id: l.id, label: l.title }))),
  ];

  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom + SPACE[3] }]}>
      <Chips
        items={chips}
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setIdx(0);
          setFlipped(false);
        }}
      />
      {!card ? (
        <Empty icon="✓" title={filter === "due" ? "Nic do powtórki" : "Brak fiszek"} text={filter === "due" ? "Na dziś czysto. Wróć jutro albo przejrzyj wszystkie." : "Nie ma tu jeszcze fiszek."} />
      ) : (
        <>
          <ProgressRow pct={list.length ? (safeIdx / list.length) * 100 : 0} label={`${safeIdx + 1}/${list.length}`} />
          <Flashcard term={card.t} def={card.d} tag={card.lvl} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
          {flipped ? (
            <GradeRow onGrade={grade} />
          ) : (
            <Touch onPress={() => setFlipped(true)} style={gr.show}>
              <Text style={[gr.txt, { color: COLORS.text }]}>Pokaż odpowiedź</Text>
            </Touch>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: UI.gutter },
});
