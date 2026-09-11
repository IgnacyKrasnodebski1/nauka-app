import type { Topic } from "@nauka/shared";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HtmlText } from "@/components/HtmlText";
import { Body, Display, Label, Muted } from "@/components/Text";
import { Card } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { COLORS, SPACE, UI, display, tabular } from "@/lib/theme";

export function InfoTab({ topic }: { topic: Topic }) {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const subject = app.findSubject(topic.subjectId);
  const nQ = topic.levels.reduce((a, l) => a + l.quiz.length, 0);
  const nF = topic.levels.reduce((a, l) => a + l.flashcards.length, 0);
  return (
    <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 60 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <View style={s.hero}>
        <Label>{subject ? subject.name : "temat"}</Label>
        <Display size="2xl" weight={700}>
          {topic.name}
        </Display>
        {topic.tagline ? <Body color={COLORS.muted}>{topic.tagline}</Body> : null}
        <Muted size="xs" style={tabular}>
          {topic.source === "prompt" ? "z hasła" : "z materiałów"} · {topic.levels.length} poziomów · {nQ} pytań · {nF} fiszek
        </Muted>
      </View>
      {topic.info?.trim() ? (
        <HtmlText html={topic.info} />
      ) : (
        <Card>
          <Body color={COLORS.muted}>Brak dodatkowych informacji o tym temacie.</Body>
        </Card>
      )}
      <Card style={{ marginTop: SPACE[1] }}>
        <Label style={{ marginBottom: SPACE[2] }}>siatka ocen · egzamin</Label>
        {topic.grading.scale.map(([thr, label]) => (
          <View key={`${thr}-${label}`} style={s.row}>
            <Body style={tabular}>≥ {thr}%</Body>
            <Body weight={700} color={COLORS.accent} style={{ fontFamily: display(700) }}>
              {label}
            </Body>
          </View>
        ))}
        <View style={[s.row, { borderBottomWidth: 0 }]}>
          <Body style={tabular}>{"<"} {topic.grading.pass}%</Body>
          <Body weight={700} color={COLORS.danger}>
            {topic.grading.failLabel}
          </Body>
        </View>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: UI.gutter },
  hero: { paddingVertical: SPACE[3], paddingBottom: SPACE[5], gap: SPACE[2] },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line },
});
