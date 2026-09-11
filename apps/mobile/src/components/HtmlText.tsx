import React, { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { htmlToBoxes, type Block, type Run } from "@/lib/html";
import { C, FONT } from "@/lib/theme";
import { useAccent } from "./Accent";

function Runs({ runs, style, boldColor }: { runs: Run[]; style?: StyleProp<TextStyle>; boldColor?: string }) {
  return (
    <Text style={[s.p, style]}>
      {runs.map((r, i) => (
        <Text key={i} style={[r.bold && { fontWeight: FONT.bold, color: boldColor ?? "#fff" }, r.italic && { fontStyle: "italic" }]}>
          {r.text}
        </Text>
      ))}
    </Text>
  );
}

function BlockView({ b, textStyle, boldColor, headColor }: { b: Block; textStyle?: StyleProp<TextStyle>; boldColor?: string; headColor: string }) {
  switch (b.kind) {
    case "h3":
      return <Text style={[s.h3, { color: headColor }]}>{b.runs.map((r) => r.text).join("")}</Text>;
    case "li":
      return (
        <View style={s.li}>
          <Runs runs={b.runs} style={textStyle} boldColor={boldColor} />
        </View>
      );
    case "tr":
      return (
        <View style={s.tr}>
          {(b.cells ?? []).map((c, i, arr) => (
            <Runs key={i} runs={c} style={[textStyle, s.td, i === arr.length - 1 && arr.length > 1 && { textAlign: "right", fontWeight: FONT.black, color: C.lime, flex: 0 }]} boldColor={boldColor} />
          ))}
        </View>
      );
    default:
      return <Runs runs={b.runs} style={textStyle} boldColor={boldColor} />;
  }
}

/**
 * Renderuje prosty HTML (b/i/br/p/ul/li/h3/table, div.zbox → karta) jako natywny tekst. Bez WebView.
 * `inline` — bez ramek (feed body); domyślnie zboxy dostają kartę.
 */
export function HtmlText({ html, inline, style, textStyle, boldColor }: { html: string; inline?: boolean; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>; boldColor?: string }) {
  const boxes = useMemo(() => htmlToBoxes(html), [html]);
  const a = useAccent();
  if (!boxes.length) return null;
  return (
    <View style={style}>
      {boxes.map((box, i) => (
        <View key={i} style={[box.boxed && !inline && s.zbox, { gap: 6 }]}>
          {box.blocks.map((b, j) => (
            <BlockView key={j} b={b} textStyle={textStyle} boldColor={boldColor} headColor={a.solid} />
          ))}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  p: { color: "#e7e7f4", fontSize: 15, lineHeight: 23 },
  h3: { fontSize: 13, fontWeight: FONT.bold, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4, marginTop: 2 },
  li: { paddingLeft: 6 },
  tr: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  td: { flex: 1, fontSize: 14.5 },
  zbox: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18, marginBottom: 12 },
});
