import React, { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { htmlToBoxes, type Block, type Run } from "@/lib/html";
import { T, body, display } from "@/lib/theme";
import { useAccent } from "./Accent";

function Runs({ runs, style, boldColor }: { runs: Run[]; style?: StyleProp<TextStyle>; boldColor?: string }) {
  return (
    <Text style={[s.p, style]}>
      {runs.map((r, i) => (
        <Text key={i} style={[r.bold && { fontFamily: body(800), color: boldColor ?? T.txt }, r.italic && { fontStyle: "italic" }]}>
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
            <Runs key={i} runs={c} style={[textStyle, s.td, i === arr.length - 1 && arr.length > 1 && s.tdLast]} boldColor={boldColor} />
          ))}
        </View>
      );
    default:
      return <Runs runs={b.runs} style={textStyle} boldColor={boldColor} />;
  }
}

/** Prosty HTML (b/i/br/p/ul/li/h3/table, div.zbox → karta) jako natywny tekst. Bez WebView. Pogrubienia w kolorze akcentu. */
export function HtmlText({ html, inline, style, textStyle, boldColor }: { html: string; inline?: boolean; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>; boldColor?: string }) {
  const boxes = useMemo(() => htmlToBoxes(html), [html]);
  const acc = useAccent();
  if (!boxes.length) return null;
  return (
    <View style={style}>
      {boxes.map((box, i) => (
        <View key={i} style={[box.boxed && !inline && s.zbox, { gap: 6 }]}>
          {box.blocks.map((b, j) => (
            <BlockView key={j} b={b} textStyle={textStyle} boldColor={boldColor ?? acc.color} headColor={acc.color} />
          ))}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  p: { color: T.txt2, fontSize: 15.5, lineHeight: 24, fontFamily: body(500) },
  h3: { fontSize: 10.5, fontFamily: body(800), textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4, marginTop: 2 },
  li: { paddingLeft: 6 },
  tr: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 7, borderBottomWidth: 2, borderBottomColor: T.line2 },
  td: { flex: 1, fontSize: 14 },
  tdLast: { textAlign: "right", fontFamily: display(800), flex: 0 },
  zbox: { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 22, padding: 16, marginBottom: 12 },
});
