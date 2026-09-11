import { dayDiff, subjectCompletion, todayStr, type Subject, type SubjectProgress, type Topic } from "@nauka/shared";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useApp } from "@/lib/app-state";
import { pl } from "@/lib/plural";
import { COLORS, RADIUS, SPACE, hueFrom, shadowCard, tabular } from "@/lib/theme";
import { Glow } from "./Accent";
import { Muted, Title } from "./Text";
import { IconTile, Touch } from "./ui";

export function examCountdown(s: Pick<Subject, "examDate">): number | null {
  if (!s.examDate) return null;
  const d = dayDiff(todayStr(), s.examDate);
  return d < 0 ? null : d;
}

export function examBadge(days: number): string {
  if (days === 0) return "sprawdzian dziś";
  if (days === 1) return "sprawdzian jutro";
  return `sprawdzian za ${pl(days, "dzień", "dni", "dni")}`;
}

/** Krótka wersja do ciasnych miejsc (badge na karcie). */
export function examBadgeShort(days: number): string {
  if (days === 0) return "dziś";
  if (days === 1) return "jutro";
  return `za ${pl(days, "dzień", "dni", "dni")}`;
}

export function subjectStats(topics: Topic[], progress: (topicId: string) => SubjectProgress) {
  let done = 0,
    total = 0;
  for (const t of topics) {
    const c = subjectCompletion(t, progress(t.id));
    done += c.done;
    total += c.total;
  }
  return { topics: topics.length, done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Karta przedmiotu w siatce Home: tile z ringiem hue, nazwa, tematy/poziomy, pasek w hue, badge sprawdzianu. */
export function SubjectCard({ subject, onPress }: { subject: Subject; onPress: () => void }) {
  const app = useApp();
  const st = subjectStats(app.topicsOf(subject.id), app.progressFor);
  const hue = hueFrom(subject.accent2, subject.name);
  const days = examCountdown(subject);
  return (
    <Touch onPress={onPress} style={s.card}>
      <View style={s.hl} />
      <Glow color={hue.color} size={220} alpha={0.12} style={{ top: -120, right: -80 }} />
      <View style={s.top}>
        <IconTile emoji={subject.emoji} hue={hue} size={48} />
        {days !== null ? (
          <View style={[s.badge, days <= 2 && { backgroundColor: COLORS.dangerSoft }]}>
            <Muted size="xs" weight={600} color={days <= 2 ? COLORS.danger : COLORS.textSoft} numberOfLines={1}>
              ◷ {examBadgeShort(days)}
            </Muted>
          </View>
        ) : null}
      </View>
      <Title size="md" numberOfLines={2} style={{ marginTop: SPACE[3] }}>
        {subject.name}
      </Title>
      <Muted size="xs" style={[tabular, { marginTop: 2 }]}>
        {st.topics === 0 ? "pusto — dodaj temat" : `${pl(st.topics, "temat", "tematy", "tematów")} · ${st.done}/${st.total} ${pl(st.total, "poziom", "poziomy", "poziomów", false)}`}
      </Muted>
      <View style={s.bar}>
        <View style={{ width: `${st.pct}%`, height: "100%", borderRadius: 999, backgroundColor: hue.color }} />
      </View>
    </Touch>
  );
}

const s = StyleSheet.create({
  card: { flexBasis: "47%", flexGrow: 1, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.lg, padding: SPACE[4], overflow: "hidden", minHeight: 164, ...shadowCard },
  hl: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: COLORS.highlight, zIndex: 2 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 6 },
  badge: { backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.pill, paddingVertical: 4, paddingHorizontal: 8, flexShrink: 1 },
  bar: { height: 4, backgroundColor: COLORS.bg3, borderRadius: 999, overflow: "hidden", marginTop: "auto", paddingTop: 0 },
});
