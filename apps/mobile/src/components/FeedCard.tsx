import type { FeedItem } from "@nauka/shared";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { COLORS, RADIUS, SPACE, body, shadowCard } from "@/lib/theme";
import { useHue } from "./Accent";
import { HtmlText } from "./HtmlText";
import { Display, Label } from "./Text";

/** Mikro-dawka z feedu: karta bg2, duży tytuł display, „po ludzku” i mnemo jako bloki info. */
export function FeedCard({ item, tag }: { item: FeedItem; tag?: string }) {
  const hue = useHue();
  return (
    <View style={s.card}>
      <View style={s.hl} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: SPACE[6], gap: SPACE[4] }}>
        {tag ? <Label>{tag}</Label> : null}
        <Display size="xl" weight={700}>
          {item.title}
        </Display>
        <HtmlText html={item.body} inline textStyle={s.body} />
        {item.real ? (
          <View style={[s.block, { borderLeftColor: hue.color }]}>
            <Label color={hue.color} style={{ marginBottom: 4 }}>
              po ludzku
            </Label>
            <HtmlText html={item.real} inline textStyle={s.blockTxt} />
          </View>
        ) : null}
        {item.mnemo ? (
          <View style={[s.block, { borderLeftColor: COLORS.accent, backgroundColor: COLORS.bg3 }]}>
            <Label color={COLORS.accent} style={{ marginBottom: 4 }}>
              zapamiętaj
            </Label>
            <HtmlText html={item.mnemo} inline textStyle={s.blockTxt} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.xl, overflow: "hidden", ...shadowCard },
  hl: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: COLORS.highlight, zIndex: 2 },
  body: { fontSize: 16, lineHeight: 26, color: COLORS.textSoft, fontFamily: body(400) },
  block: { padding: SPACE[4], backgroundColor: COLORS.glass, borderLeftWidth: 2, borderRadius: RADIUS.sm },
  blockTxt: { fontSize: 14.5, lineHeight: 22, color: COLORS.textSoft },
});
