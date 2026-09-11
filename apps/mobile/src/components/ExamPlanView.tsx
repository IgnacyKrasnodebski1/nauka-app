import { buildExamPlan, todayStr, type SubjectProgress, type Topic } from "@nauka/shared";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { pl } from "@/lib/plural";
import { COLORS, RADIUS, SPACE, tabular } from "@/lib/theme";
import { useHue } from "./Accent";
import { Body, Display, Label, Muted } from "./Text";
import { Touch } from "./ui";

const DOW = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];
function fmtDay(date: string): string {
  const d = new Date(date + "T00:00:00");
  return `${DOW[d.getDay()]} ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Plan do sprawdzianu (shared `buildExamPlan`): odliczanie + lista dni z zadaniami. */
export function ExamPlanView({ topics, progress, examDate, onLevel }: { topics: Topic[]; progress: Record<string, SubjectProgress>; examDate: string; onLevel: (topicId: string, levelId: string) => void }) {
  const plan = useMemo(() => buildExamPlan(topics, progress, examDate), [topics, progress, examDate]);
  const hue = useHue();
  const today = todayStr();
  return (
    <View style={{ gap: SPACE[2] }}>
      <View style={s.head}>
        <Display size="2xl" weight={700} color={plan.daysLeft <= 2 ? COLORS.danger : COLORS.text} style={tabular}>
          {plan.daysLeft === 0 ? "dziś" : pl(plan.daysLeft, "dzień", "dni", "dni")}
        </Display>
        <Muted size="xs" weight={600} style={{ flexShrink: 1, textAlign: "right" }}>
          {plan.levelsLeft === 0 ? "wszystkie poziomy zrobione" : `${pl(plan.levelsLeft, "poziom", "poziomy", "poziomów")} do zrobienia`}
        </Muted>
      </View>
      {topics.length === 0 ? <Muted>Dodaj tematy, a rozpiszę je na dni.</Muted> : null}
      {plan.days.slice(0, 6).map((d) => {
        const isToday = d.date === today;
        return (
          <View key={d.date} style={[s.day, isToday && { borderColor: hue.ring, backgroundColor: hue.soft }]}>
            <Label color={isToday ? hue.color : COLORS.faint} style={{ width: 78 }} numberOfLines={1}>
              {isToday ? "dziś" : fmtDay(d.date)}
            </Label>
            <View style={{ flex: 1, gap: 4 }}>
              {d.tasks.map((t, i) =>
                t.kind === "level" && t.topicId && t.levelId ? (
                  <Touch key={i} onPress={() => onLevel(t.topicId!, t.levelId!)}>
                    <Body size="sm" weight={600} color={COLORS.text}>
                      {t.label} ›
                    </Body>
                  </Touch>
                ) : (
                  <Muted key={i} size="sm">
                    {t.kind === "exam" ? "Symulacja sprawdzianu" : t.label}
                  </Muted>
                ),
              )}
            </View>
          </View>
        );
      })}
      {plan.days.length > 6 ? <Muted size="xs">…i {plan.days.length - 6} kolejnych dni (codziennie powtórka fiszek)</Muted> : null}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACE[3], marginBottom: SPACE[1] },
  day: { flexDirection: "row", gap: SPACE[3], backgroundColor: COLORS.glass, borderRadius: RADIUS.sm, padding: SPACE[3], borderWidth: 1, borderColor: COLORS.line },
});
