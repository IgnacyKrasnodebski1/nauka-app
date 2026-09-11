import { buildExamPlan, todayStr, type SubjectProgress, type Topic } from "@nauka/shared";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { C, FONT, R } from "@/lib/theme";
import { Touch } from "./ui";

const DOW = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];
function fmtDay(date: string): string {
  const d = new Date(date + "T00:00:00");
  return `${DOW[d.getDay()]} ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Plan nauki do sprawdzianu (shared `buildExamPlan`): lista dni z zadaniami + odliczanie. */
export function ExamPlanView({ topics, progress, examDate, onLevel }: { topics: Topic[]; progress: Record<string, SubjectProgress>; examDate: string; onLevel: (topicId: string, levelId: string) => void }) {
  const plan = useMemo(() => buildExamPlan(topics, progress, examDate), [topics, progress, examDate]);
  const today = todayStr();
  return (
    <View style={{ gap: 8 }}>
      <View style={s.head}>
        <Text style={s.count}>{plan.daysLeft === 0 ? "DZIŚ 😱" : `za ${plan.daysLeft} ${plan.daysLeft === 1 ? "dzień" : "dni"}`}</Text>
        <Text style={s.left}>{plan.levelsLeft === 0 ? "wszystkie poziomy zrobione 💪" : `${plan.levelsLeft} poziomów do zrobienia`}</Text>
      </View>
      {topics.length === 0 ? <Text style={s.hint}>Dodaj tematy, a rozpiszę je na dni.</Text> : null}
      {plan.days.slice(0, 14).map((d) => (
        <View key={d.date} style={[s.day, d.date === today && s.dayToday]}>
          <Text style={[s.date, d.date === today && { color: C.lime }]}>{d.date === today ? "dziś" : fmtDay(d.date)}</Text>
          <View style={{ flex: 1, gap: 4 }}>
            {d.tasks.map((t, i) =>
              t.kind === "level" && t.topicId && t.levelId ? (
                <Touch key={i} onPress={() => onLevel(t.topicId!, t.levelId!)}>
                  <Text style={s.task}>📘 {t.label} ›</Text>
                </Touch>
              ) : (
                <Text key={i} style={[s.task, { color: C.muted }]}>
                  {t.kind === "exam" ? "🎯" : "🔁"} {t.label}
                </Text>
              ),
            )}
          </View>
        </View>
      ))}
      {plan.days.length > 14 ? <Text style={s.hint}>…i {plan.days.length - 14} kolejnych dni</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 4 },
  count: { color: C.txt, fontSize: 22, fontWeight: FONT.black, letterSpacing: -0.4 },
  left: { color: C.muted, fontSize: 12.5, fontWeight: FONT.bold, flexShrink: 1, textAlign: "right" },
  day: { flexDirection: "row", gap: 12, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: R.sm, padding: 10, borderWidth: 1, borderColor: C.border },
  dayToday: { borderColor: "rgba(170,255,0,.35)", backgroundColor: "rgba(170,255,0,.06)" },
  date: { color: C.muted, fontSize: 12.5, fontWeight: FONT.black, width: 58, textTransform: "uppercase" },
  task: { color: C.txt, fontSize: 13.5, fontWeight: FONT.semi, lineHeight: 19 },
  hint: { color: C.muted, fontSize: 13, fontWeight: FONT.semi },
});
