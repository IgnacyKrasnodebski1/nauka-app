import { XP, cardKey, isDue, newCard, review, type Flashcard as FlashcardT } from "@nauka/shared";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Flashcard } from "@/components/Flashcard";
import { Chips, Empty, ProgressRow, Touch } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import type { AppSubject } from "@/lib/subjects";
import { FONT } from "@/lib/theme";

interface CardRef extends FlashcardT {
  key: string;
  lvl: string;
}

/** Fiszki całego przedmiotu: filtr po poziomach + tryb „do powtórki” (SRS z shared `review()`). */
export function FlashcardsTab({ subject }: { subject: AppSubject }) {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<string>("due");
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const srs = app.srsFor(subject);

  const all = useMemo<CardRef[]>(() => subject.levels.flatMap((l) => l.flashcards.map((c, i) => ({ ...c, key: cardKey(l.id, i), lvl: l.title }))), [subject]);
  const due = useMemo(() => all.filter((c) => (srs[c.key] ? isDue(srs[c.key]!) : true)), [all, srs]);
  const list = useMemo(() => {
    if (filter === "due") return due;
    if (filter === "all") return all;
    return all.filter((c) => c.key.startsWith(`${filter}:`));
  }, [filter, all, due]);

  const safeIdx = list.length ? idx % list.length : 0;
  const card = list[safeIdx];

  const grade = (known: boolean) => {
    if (!card) return;
    const prev = srs[card.key] ?? newCard();
    const next = review(prev, known ? 3 : 0);
    app.setSrsFor(subject, { ...srs, [card.key]: next });
    if (known) {
      app.addXp(subject, XP.flashcardKnown);
      app.showToast(`+${XP.flashcardKnown}xp 💪`);
      haptic.ok();
    } else haptic.tap();
    setFlipped(false);
    // w trybie „do powtórki” karta znika z listy → nie zwiększamy indeksu
    if (filter === "due") setIdx((i) => (list.length > 1 ? Math.min(i, list.length - 2) : 0));
    else setIdx((i) => (i + 1) % Math.max(1, list.length));
  };

  const chips = [{ id: "due", label: `🔁 do powtórki (${due.length})` }, { id: "all", label: "Wszystko 🌀" }, ...subject.levels.map((l) => ({ id: l.id, label: l.title }))];

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
        <Empty emoji={filter === "due" ? "🧘" : "🫥"} title={filter === "due" ? "Nic do powtórki" : "Brak fiszek"} text={filter === "due" ? "Wszystko ogarnięte na dziś. Wróć jutro albo przejdź na „Wszystko”." : "Ten poziom nie ma fiszek."} />
      ) : (
        <>
          <ProgressRow pct={list.length ? (safeIdx / list.length) * 100 : 0} label={`${safeIdx + 1}/${list.length}`} />
          <Flashcard term={card.t} def={card.d} tag={card.lvl} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
          <View style={s.btns}>
            <Touch onPress={() => grade(false)} style={[s.btn, s.no]}>
              <Text style={[s.btnTxt, { color: "#ff7a99" }]}>jeszcze nie 😵</Text>
            </Touch>
            <Touch onPress={() => grade(true)} style={[s.btn, s.yes]}>
              <Text style={[s.btnTxt, { color: "#7dffa6" }]}>umiem 💪</Text>
            </Touch>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 16 },
  btns: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: { flex: 1, padding: 15, borderRadius: 16, alignItems: "center", borderWidth: 1 },
  no: { backgroundColor: "#33222e", borderColor: "rgba(255,59,92,.25)" },
  yes: { backgroundColor: "#16331f", borderColor: "rgba(30,215,96,.25)" },
  btnTxt: { fontSize: 15, fontWeight: FONT.bold },
});
