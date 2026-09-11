import type { FeedItem } from "@nauka/shared";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { C, FONT, R } from "@/lib/theme";
import { AccentWash, useAccent } from "./Accent";
import { HtmlText } from "./HtmlText";
import { Tag } from "./ui";

/** Mikro-dawka z feedu („roladka”) — port `.fcard`. */
export function FeedCard({ item, tag }: { item: FeedItem; tag?: string }) {
  const a = useAccent();
  return (
    <View style={s.card}>
      <AccentWash opacity={0.1} radius={R.xl} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 22 }}>
        {tag ? <Tag>{tag}</Tag> : null}
        <Text style={s.title}>{item.title}</Text>
        <HtmlText html={item.body} inline textStyle={s.body} />
        {item.real ? (
          <View style={[s.real, { borderLeftColor: a.solid }]}>
            <Text style={[s.lbl, { color: a.solid }]}>po ludzku 🗣️</Text>
            <HtmlText html={item.real} inline textStyle={s.realTxt} />
          </View>
        ) : null}
        {item.mnemo ? (
          <View style={s.mnemo}>
            <Text style={[s.lbl, { color: C.lime }]}>zapamiętaj 🧠</Text>
            <HtmlText html={item.mnemo} inline textStyle={s.realTxt} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.xl, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 30, shadowOffset: { width: 0, height: 20 } },
  title: { color: C.txt, fontSize: 24, fontWeight: FONT.black, lineHeight: 28, letterSpacing: -0.5, marginBottom: 14 },
  body: { fontSize: 16, lineHeight: 24, color: "#e7e7f4" },
  real: { marginTop: 16, padding: 13, paddingHorizontal: 15, backgroundColor: "rgba(0,0,0,0.2)", borderLeftWidth: 3, borderRadius: 12 },
  mnemo: { marginTop: 12, padding: 12, paddingHorizontal: 15, backgroundColor: "rgba(42,35,0,0.4)", borderLeftWidth: 3, borderLeftColor: C.lime, borderRadius: 12 },
  lbl: { fontWeight: FONT.bold, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  realTxt: { fontSize: 14.5, lineHeight: 21, color: "#dcdcf0" },
});
