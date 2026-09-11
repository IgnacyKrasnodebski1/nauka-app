import { levelProgress, subjectCompletion, type Topic } from "@nauka/shared";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useApp } from "@/lib/app-state";
import { C, FONT, R } from "@/lib/theme";
import { AccentGradient } from "./Accent";
import { Touch } from "./ui";

/** Karta tematu w przedmiocie: emoji, nazwa, poziomy zrobione/wszystkie, gwiazdki, źródło. */
export function TopicCard({ topic, onPress }: { topic: Topic; onPress: () => void }) {
  const app = useApp();
  const p = app.progressFor(topic.id);
  const { done, total, pct } = subjectCompletion(topic, p);
  const stars = topic.levels.reduce((a, l) => a + levelProgress(p, l.id).stars, 0);
  return (
    <Touch onPress={onPress} style={s.card}>
      <View style={s.emoji}>
        <Text style={{ fontSize: 28 }}>{topic.emoji}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.name} numberOfLines={2}>
          {topic.name}
        </Text>
        <Text style={s.meta}>
          {done}/{total} poziomów · ⭐ {stars}/{total * 3} · {topic.source === "prompt" ? "✍️ z hasła" : "📸 z materiałów"}
        </Text>
        <View style={s.bar}>
          <AccentGradient style={{ width: `${pct}%`, height: "100%", borderRadius: 999 }} />
        </View>
      </View>
      <Text style={s.chev}>›</Text>
    </Touch>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 14, marginBottom: 10 },
  emoji: { width: 50, height: 50, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.25)", alignItems: "center", justifyContent: "center" },
  name: { color: C.txt, fontSize: 15.5, fontWeight: FONT.black },
  meta: { color: C.muted, fontSize: 12, fontWeight: FONT.semi, marginTop: 2 },
  bar: { height: 5, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden", marginTop: 8 },
  chev: { color: C.muted, fontSize: 22 },
});
