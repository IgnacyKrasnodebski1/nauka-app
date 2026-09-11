import { subjectCompletion } from "@nauka/shared";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useApp } from "@/lib/app-state";
import type { AppSubject } from "@/lib/subjects";
import { C, FONT, R, parseAccent } from "@/lib/theme";
import { AccentWash, AccentGradient } from "./Accent";
import { Touch } from "./ui";

export function SubjectCard({ subject, onPress, right }: { subject: AppSubject; onPress: () => void; right?: React.ReactNode }) {
  const app = useApp();
  const p = app.progressFor(subject);
  const { done, total, pct } = subjectCompletion(subject, p);
  const accent = parseAccent(subject.accent, subject.accent2);
  return (
    <Touch onPress={onPress} style={s.card}>
      <AccentWash accent={accent} radius={R.lg} />
      <View style={s.emoji}>
        <Text style={{ fontSize: 38 }}>{subject.emoji}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.name} numberOfLines={2}>
          {subject.name}
        </Text>
        {subject.tagline ? (
          <Text style={s.sub} numberOfLines={2}>
            {subject.tagline}
          </Text>
        ) : null}
        <View style={s.prog}>
          <View style={s.bar}>
            <AccentGradient accent={accent} style={{ width: `${pct}%`, height: "100%", borderRadius: 999 }} />
          </View>
          <Text style={s.small}>
            {done}/{total} poziomów
          </Text>
        </View>
      </View>
      {right ?? <Text style={s.chev}>›</Text>}
    </Touch>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: 16, marginBottom: 14, overflow: "hidden" },
  emoji: { width: 62, height: 62, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.25)", alignItems: "center", justifyContent: "center" },
  name: { color: C.txt, fontSize: 18, fontWeight: FONT.black, letterSpacing: -0.3 },
  sub: { color: C.muted, fontSize: 13, marginTop: 3, lineHeight: 17 },
  prog: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 9 },
  bar: { flex: 1, height: 7, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" },
  small: { color: C.muted, fontSize: 12, fontWeight: FONT.bold },
  chev: { color: C.muted, fontSize: 24 },
});
