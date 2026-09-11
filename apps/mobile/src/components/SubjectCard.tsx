import { dayDiff, subjectCompletion, todayStr, type Subject, type SubjectProgress, type Topic } from "@nauka/shared";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useApp } from "@/lib/app-state";
import { C, FONT, R, parseAccent } from "@/lib/theme";
import { AccentGradient, AccentWash } from "./Accent";
import { Touch } from "./ui";

/** Ile dni do sprawdzianu (null gdy brak daty / już minął). */
export function examCountdown(s: Pick<Subject, "examDate">): number | null {
  if (!s.examDate) return null;
  const d = dayDiff(todayStr(), s.examDate);
  return d < 0 ? null : d;
}

export function examBadge(days: number): string {
  if (days === 0) return "sprawdzian DZIŚ 😱";
  if (days === 1) return "sprawdzian jutro";
  if (days < 5) return `sprawdzian za ${days} dni`;
  return `sprawdzian za ${days} dni`;
}

/** Statystyka przedmiotu: tematy, poziomy zrobione / wszystkie. */
export function subjectStats(topics: Topic[], progress: (topicId: string) => SubjectProgress) {
  let done = 0, total = 0;
  for (const t of topics) {
    const c = subjectCompletion(t, progress(t.id));
    done += c.done;
    total += c.total;
  }
  return { topics: topics.length, done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Karta przedmiotu (kontenera) na Home: emoji, nazwa, liczba tematów, % poziomów, badge sprawdzianu. */
export function SubjectCard({ subject, onPress }: { subject: Subject; onPress: () => void }) {
  const app = useApp();
  const st = subjectStats(app.topicsOf(subject.id), app.progressFor);
  const accent = parseAccent(subject.accent, subject.accent2);
  const days = examCountdown(subject);
  return (
    <Touch onPress={onPress} style={s.card}>
      <AccentWash accent={accent} radius={R.lg} />
      <View style={s.top}>
        <View style={s.emoji}>
          <Text style={{ fontSize: 30 }}>{subject.emoji}</Text>
        </View>
        {days !== null ? (
          <View style={[s.badge, days <= 2 && { backgroundColor: "rgba(255,59,92,.25)" }]}>
            <Text style={s.badgeTxt}>⏰ {examBadge(days)}</Text>
          </View>
        ) : null}
      </View>
      <Text style={s.name} numberOfLines={2}>
        {subject.name}
      </Text>
      <Text style={s.sub}>
        {st.topics === 0 ? "pusto — dodaj temat" : `${st.topics} ${st.topics === 1 ? "temat" : st.topics < 5 ? "tematy" : "tematów"} · ${st.done}/${st.total} poziomów`}
      </Text>
      <View style={s.bar}>
        <AccentGradient accent={accent} style={{ width: `${st.pct}%`, height: "100%", borderRadius: 999 }} />
      </View>
    </Touch>
  );
}

const s = StyleSheet.create({
  card: { flexBasis: "47%", flexGrow: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: 14, overflow: "hidden", gap: 6, minHeight: 150 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 6 },
  emoji: { width: 50, height: 50, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.25)", alignItems: "center", justifyContent: "center" },
  badge: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 8, flexShrink: 1 },
  badgeTxt: { color: C.txt, fontSize: 10.5, fontWeight: FONT.bold },
  name: { color: C.txt, fontSize: 16.5, fontWeight: FONT.black, letterSpacing: -0.3, marginTop: 4 },
  sub: { color: C.muted, fontSize: 12, fontWeight: FONT.semi, lineHeight: 16 },
  bar: { height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden", marginTop: "auto" },
});
