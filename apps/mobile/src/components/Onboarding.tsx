import { CURRICULUM, STAGES, type Stage } from "@nauka/shared";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS, GOLD_HUE, RADIUS, SPACE, body, hueFrom } from "@/lib/theme";
import { Body, Muted, Title } from "./Text";
import { IconTile, Touch } from "./ui";

/** Wybór etapu (STAGES). */
export function StagePicker({ value, onChange }: { value: Stage | null; onChange: (s: Stage) => void }) {
  return (
    <View style={{ gap: SPACE[2] }}>
      {STAGES.map((st) => {
        const on = value === st.id;
        return (
          <Touch key={st.id} onPress={() => onChange(st.id)} style={[s.opt, on && s.optOn]}>
            <IconTile emoji={st.emoji} hue={on ? GOLD_HUE : hueFrom(null, st.id)} size={44} />
            <View style={{ flex: 1 }}>
              <Title size="base">{st.label}</Title>
              <Muted size="xs">{st.hint}</Muted>
            </View>
            {on ? <Text style={{ color: COLORS.accent, fontSize: 18, fontFamily: body(700) }}>✓</Text> : null}
          </Touch>
        );
      })}
    </View>
  );
}

export interface SubjectPick {
  key: string;
  name: string;
  emoji: string;
}

/** Chipsy przedmiotów z CURRICULUM[stage]; wybrane = złoty ring, `taken` = wyszarzone. */
export function SubjectChips({ stage, selected, taken = [], onToggle }: { stage: Stage; selected: string[]; taken?: string[]; onToggle: (p: SubjectPick) => void }) {
  return (
    <View style={s.chips}>
      {CURRICULUM[stage].map((p) => {
        const on = selected.includes(p.key);
        const has = taken.includes(p.key);
        return (
          <Touch key={p.key} onPress={() => !has && onToggle(p)} disabled={has} style={[s.chip, on && s.chipOn]}>
            <Body size="sm" weight={600} color={on ? COLORS.text : COLORS.textSoft}>
              {p.emoji} {p.name}
              {has ? "  ✓" : ""}
            </Body>
          </Touch>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  opt: { flexDirection: "row", alignItems: "center", gap: SPACE[3], backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.md, padding: SPACE[3] },
  optOn: { borderColor: COLORS.accent, backgroundColor: COLORS.bg3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACE[2] },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.line },
  chipOn: { backgroundColor: COLORS.bg3, borderColor: COLORS.accent },
});
