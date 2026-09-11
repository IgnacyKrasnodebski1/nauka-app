import { XP, cardKey, isDue, newCard, review, type SrsGrade, type Topic } from "@nauka/shared";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Flashcard } from "@/components/Flashcard";
import { Chips, Empty, ProgressRow, Touch } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { FONT } from "@/lib/theme";

interface CardRef {
  t: string;
  d: string;
  key: string;
  topicId: string;
  lvl: string;
  levelId: string;
}

/**
 * Fiszki z jednego tematu albo z całego przedmiotu (`topics` > 1): filtr „do powtórki” (SRS z shared `review()`),
 * „wszystko” i po poziomach/tematach. Ocena 0–3: „jeszcze nie” = 0, „trudne” = 1, „umiem” = 2, „łatwe” = 3.
 */
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
      app.showToast(`+${XP.flashcardKnown}xp 💪`);
      haptic.ok();
    } else haptic.tap();
    setFlipped(false);
    if (filter === "due") setIdx((i) => (list.length > 1 ? Math.min(i, list.length - 2) : 0));
    else setIdx((i) => (i + 1) % Math.max(1, list.length));
  };

  const chips = [
    { id: "due", label: `🔁 do powtórki (${due.length})` },
    { id: "all", label: "Wszystko 🌀" },
    ...(multi ? topics.map((t) => ({ id: t.id, label: `${t.emoji} ${t.name}` })) : (topics[0]?.levels ?? []).map((l) => ({ id: l.id, label: l.title }))),
  ];

  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom + 12 }]}>
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
        <Empty emoji={filter === "due" ? "🧘" : "🫥"} title={filter === "due" ? "Nic do powtórki" : "Brak fiszek"} text={filter === "due" ? "Wszystko ogarnięte na dziś. Wróć jutro albo przejdź na „Wszystko”." : "Nie ma tu jeszcze fiszek."} />
      ) : (
        <>
          <ProgressRow pct={list.length ? (safeIdx / list.length) * 100 : 0} label={`${safeIdx + 1}/${list.length}`} />
          <Flashcard term={card.t} def={card.d} tag={card.lvl} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
          {flipped ? (
            <View style={s.btns}>
              <Touch onPress={() => grade(0)} style={[s.btn, s.no]}>
                <Text style={[s.btnTxt, { color: "#ff7a99" }]}>nie 😵</Text>
              </Touch>
              <Touch onPress={() => grade(1)} style={[s.btn, s.hard]}>
                <Text style={[s.btnTxt, { color: "#ffc46b" }]}>trudne 😬</Text>
              </Touch>
              <Touch onPress={() => grade(2)} style={[s.btn, s.yes]}>
                <Text style={[s.btnTxt, { color: "#7dffa6" }]}>umiem 💪</Text>
              </Touch>
              <Touch onPress={() => grade(3)} style={[s.btn, s.easy]}>
                <Text style={[s.btnTxt, { color: "#8ff0ff" }]}>łatwe 😎</Text>
              </Touch>
            </View>
          ) : (
            <View style={s.btns}>
              <Touch onPress={() => setFlipped(true)} style={[s.btn, s.show]}>
                <Text style={s.btnTxt}>pokaż odpowiedź 👀</Text>
              </Touch>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 16 },
  btns: { flexDirection: "row", gap: 8, marginTop: 14 },
  btn: { flex: 1, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 16, alignItems: "center", borderWidth: 1 },
  no: { backgroundColor: "#33222e", borderColor: "rgba(255,59,92,.25)" },
  hard: { backgroundColor: "#33291f", borderColor: "rgba(255,196,107,.25)" },
  yes: { backgroundColor: "#16331f", borderColor: "rgba(30,215,96,.25)" },
  easy: { backgroundColor: "#0f2f33", borderColor: "rgba(34,211,238,.25)" },
  show: { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.13)" },
  btnTxt: { fontSize: 13.5, fontWeight: FONT.bold, color: "#fff" },
});
