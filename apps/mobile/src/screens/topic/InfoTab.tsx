import type { Topic } from "@nauka/shared";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HtmlText } from "@/components/HtmlText";
import { Card, H1, Muted } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { C, FONT } from "@/lib/theme";

export function InfoTab({ topic }: { topic: Topic }) {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const subject = app.findSubject(topic.subjectId);
  const nQ = topic.levels.reduce((a, l) => a + l.quiz.length, 0);
  const nF = topic.levels.reduce((a, l) => a + l.flashcards.length, 0);
  return (
    <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 60 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <View style={s.hero}>
        <H1>
          {topic.emoji} {topic.name}
        </H1>
        {topic.tagline ? <Muted>{topic.tagline}</Muted> : null}
        <Text style={s.meta}>
          {subject ? `${subject.emoji} ${subject.name} · ` : ""}
          {topic.source === "prompt" ? "✍️ z hasła" : "📸 z materiałów"} · {topic.levels.length} poziomów · {nQ} pytań · {nF} fiszek
        </Text>
      </View>
      {topic.info?.trim() ? (
        <HtmlText html={topic.info} />
      ) : (
        <Card>
          <Text style={s.p}>Brak dodatkowych informacji o tym temacie.</Text>
        </Card>
      )}
      <Card style={{ marginTop: 4 }}>
        <Text style={s.h3}>Siatka ocen (egzamin)</Text>
        {topic.grading.scale.map(([thr, label]) => (
          <View key={`${thr}-${label}`} style={s.row}>
            <Text style={s.p}>≥ {thr}%</Text>
            <Text style={s.grade}>{label}</Text>
          </View>
        ))}
        <View style={s.row}>
          <Text style={s.p}>{"<"} {topic.grading.pass}%</Text>
          <Text style={[s.grade, { color: "#ff8aa3" }]}>{topic.grading.failLabel}</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 16 },
  hero: { paddingVertical: 10, paddingBottom: 16, paddingHorizontal: 4, gap: 6 },
  meta: { color: C.muted, fontSize: 12.5, fontWeight: FONT.semi, marginTop: 4 },
  h3: { color: C.cyan, fontSize: 13, fontWeight: FONT.bold, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  p: { color: "#e7e7f4", fontSize: 15, lineHeight: 22 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  grade: { color: C.lime, fontWeight: FONT.black, fontSize: 15 },
});
