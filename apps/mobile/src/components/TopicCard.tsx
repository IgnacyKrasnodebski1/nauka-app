import { levelProgress, subjectCompletion, type Topic } from "@nauka/shared";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useApp } from "@/lib/app-state";
import { COLORS, SPACE, tabular } from "@/lib/theme";
import { useHue } from "./Accent";
import { Muted, Title } from "./Text";
import { IconTile, Touch } from "./ui";

/** Wiersz tematu (lista rozdzielana hairline, nie ramkami): tile, nazwa, poziomy, gwiazdki, źródło. */
export function TopicCard({ topic, onPress, last }: { topic: Topic; onPress: () => void; last?: boolean }) {
  const app = useApp();
  const hue = useHue();
  const p = app.progressFor(topic.id);
  const { done, total, pct } = subjectCompletion(topic, p);
  const stars = topic.levels.reduce((a, l) => a + levelProgress(p, l.id).stars, 0);
  return (
    <Touch onPress={onPress} style={[s.row, !last && s.hair]}>
      <IconTile emoji={topic.emoji} size={48} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Title size="base" numberOfLines={2}>
          {topic.name}
        </Title>
        <Muted size="xs" style={tabular}>
          {done}/{total} poziomów · <Text style={{ color: COLORS.accent }}>★</Text> {stars}/{total * 3} · {topic.source === "prompt" ? "z hasła" : "z materiałów"}
        </Muted>
        <View style={s.bar}>
          <View style={{ width: `${pct}%`, height: "100%", borderRadius: 999, backgroundColor: hue.color }} />
        </View>
      </View>
      <Text style={s.chev}>›</Text>
    </Touch>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE[3], paddingVertical: SPACE[3] },
  hair: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.lineStrong },
  bar: { height: 3, backgroundColor: COLORS.bg3, borderRadius: 999, overflow: "hidden", marginTop: 4 },
  chev: { color: COLORS.faint, fontSize: 22 },
});
