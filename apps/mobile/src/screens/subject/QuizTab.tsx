import type { QuizQuestion } from "@nauka/shared";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QuizCard } from "@/components/QuizCard";
import { ResultView, ScoreLine } from "@/components/ResultView";
import { Chips, Empty, PillButton, ProgressRow } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { shuffle } from "@/lib/games";
import type { AppSubject } from "@/lib/subjects";

interface Q extends QuizQuestion {
  lvl: string;
}
const PRACTICE_XP = 3;

/** Quiz treningowy z całego przedmiotu (filtr po poziomach), natychmiastowa informacja zwrotna. */
export function QuizTab({ subject }: { subject: AppSubject }) {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("all");
  const [seed, setSeed] = useState(0);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const list = useMemo<Q[]>(() => {
    const src = filter === "all" ? subject.levels : subject.levels.filter((l) => l.id === filter);
    return shuffle(src.flatMap((l) => l.quiz.map((q) => ({ ...q, lvl: l.title }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, filter, seed]);

  const reset = (f = filter) => {
    setFilter(f);
    setSeed((x) => x + 1);
    setIdx(0);
    setPicked(null);
    setScore(0);
  };

  const q = list[idx];
  const pick = (i: number) => {
    if (picked !== null || !q) return;
    setPicked(i);
    if (i === q.c) {
      setScore((x) => x + 1);
      app.addXp(subject, PRACTICE_XP);
      app.showToast(`GIT +${PRACTICE_XP}xp 🟢`);
      haptic.ok();
    } else {
      app.showToast("mid, czytaj wyjaśnienie 👇");
      haptic.bad();
    }
  };

  const chips = [{ id: "all", label: "Wszystko 🌀" }, ...subject.levels.map((l) => ({ id: l.id, label: l.title }))];
  const pct = list.length ? Math.round((score / list.length) * 100) : 0;

  return (
    <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 60 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <Chips items={chips} value={filter} onChange={reset} />
      {!list.length ? (
        <Empty emoji="🫥" title="Brak pytań" text="Ten poziom nie ma quizu." />
      ) : idx >= list.length ? (
        <View style={s.card}>
          <ResultView emoji={pct >= 70 ? "🔥" : pct >= 50 ? "😎" : "💀"} title="Wynik" score={<ScoreLine correct={score} total={list.length} />} verdict={pct >= 70 ? "Solidnie ogarniasz ten przedmiot." : pct >= 50 ? "Spoko, ale przejedź jeszcze fiszki." : "Wróć do fiszek i ścieżki, potem tu wróć."}>
            <PillButton label="jeszcze raz 🔁" onPress={() => reset()} style={{ marginTop: 6 }} />
          </ResultView>
        </View>
      ) : q ? (
        <>
          <ProgressRow pct={(idx / list.length) * 100} label={`${idx + 1}/${list.length}`} />
          <QuizCard q={q} picked={picked} reveal={picked !== null} onPick={pick} tag={q.lvl}>
            {picked !== null ? (
              <PillButton
                label={idx + 1 >= list.length ? "wynik 🏁" : "dalej →"}
                onPress={() => {
                  setIdx(idx + 1);
                  setPicked(null);
                }}
                style={{ marginTop: 14 }}
              />
            ) : null}
          </QuizCard>
        </>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 16 },
  card: { backgroundColor: "#1a1a2e", borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
});
