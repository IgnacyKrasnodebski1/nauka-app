import { shuffleAnswers, type QuizQuestion, type Topic } from "@nauka/shared";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QuizCard } from "@/components/QuizCard";
import { ResultView, ScoreLine } from "@/components/ResultView";
import { Button, Card, Chips, Empty, ProgressRow } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { shuffle } from "@/lib/games";
import { SPACE, UI } from "@/lib/theme";

interface Q extends QuizQuestion {
  lvl: string;
}
const PRACTICE_XP = 3;

/** Quiz treningowy z całego tematu (filtr po poziomach), natychmiastowa informacja zwrotna. */
export function QuizTab({ topic }: { topic: Topic }) {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("all");
  const [seed, setSeed] = useState(0);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const list = useMemo<Q[]>(() => {
    const src = filter === "all" ? topic.levels : topic.levels.filter((l) => l.id === filter);
    return shuffle(src.flatMap((l) => l.quiz.map((q) => ({ ...shuffleAnswers(q), lvl: l.title }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, filter, seed]);

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
      app.addXp(topic.id, PRACTICE_XP);
      haptic.ok();
    } else haptic.bad();
  };

  const chips = [{ id: "all", label: "Wszystkie" }, ...topic.levels.map((l) => ({ id: l.id, label: l.title }))];
  const pct = list.length ? Math.round((score / list.length) * 100) : 0;

  return (
    <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 60 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <Chips items={chips} value={filter} onChange={reset} />
      {!list.length ? (
        <Empty icon="?" title="Brak pytań" text="Ten poziom nie ma quizu." />
      ) : idx >= list.length ? (
        <Card>
          <ResultView eyebrow="quiz" title={pct >= 70 ? "Solidnie" : pct >= 50 ? "Nieźle" : "Do powtórki"} score={<ScoreLine correct={score} total={list.length} />} verdict={pct >= 70 ? "Ogarniasz ten temat." : pct >= 50 ? "Spoko, ale przejrzyj jeszcze fiszki." : "Wróć do fiszek i ścieżki, potem tu wróć."} celebrate={pct >= 70}>
            <Button label="Jeszcze raz" variant="secondary" onPress={() => reset()} />
          </ResultView>
        </Card>
      ) : q ? (
        <>
          <ProgressRow pct={(idx / list.length) * 100} label={`${idx + 1}/${list.length}`} />
          <QuizCard q={q} picked={picked} reveal={picked !== null} onPick={pick} tag={q.lvl}>
            {picked !== null ? (
              <Button
                label={idx + 1 >= list.length ? "Zobacz wynik" : "Następne"}
                onPress={() => {
                  setIdx(idx + 1);
                  setPicked(null);
                }}
                style={{ marginTop: SPACE[4] }}
              />
            ) : null}
          </QuizCard>
        </>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: UI.gutter },
});
