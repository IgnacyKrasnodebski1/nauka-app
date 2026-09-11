import React, { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { htmlToBoxes, type Block, type Run } from "@/lib/html";
import { COLORS, RADIUS, SPACE, body, display, shadowCard } from "@/lib/theme";
import { useHue } from "./Accent";

function Runs({ runs, style, boldColor }: { runs: Run[]; style?: StyleProp<TextStyle>; boldColor?: string }) {
  return (
    <Text style={[s.p, style]}>
      {runs.map((r, i) => (
        <Text key={i} style={[r.bold && { fontFamily: body(700), color: boldColor ?? COLORS.text }, r.italic && { fontStyle: "italic" }]}>
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

/** Prosty HTML (b/i/br/p/ul/li/h3/table, div.zbox → karta) jako natywny tekst. Bez WebView. */
export function HtmlText({ html, inline, style, textStyle, boldColor }: { html: string; inline?: boolean; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>; boldColor?: string }) {
  const boxes = useMemo(() => htmlToBoxes(html), [html]);
  const hue = useHue();
  if (!boxes.length) return null;
  return (
    <View style={style}>
      {boxes.map((box, i) => (
        <View key={i} style={[box.boxed && !inline && s.zbox, { gap: 6 }]}>
          {box.boxed && !inline ? <View style={s.hl} /> : null}
          {box.blocks.map((b, j) => (
            <BlockView key={j} b={b} textStyle={textStyle} boldColor={boldColor} headColor={hue.color} />
          ))}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  p: { color: COLORS.textSoft, fontSize: 15, lineHeight: 23, fontFamily: body(400) },
  h3: { fontSize: 12, fontFamily: body(600), textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 4, marginTop: 2 },
  li: { paddingLeft: 6 },
  tr: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line },
  td: { flex: 1, fontSize: 14 },
  tdLast: { textAlign: "right", fontFamily: display(700), color: COLORS.accent, flex: 0 },
  zbox: { backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.lg, padding: SPACE[5], marginBottom: SPACE[3], overflow: "hidden", ...shadowCard },
  hl: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: COLORS.highlight },
});
