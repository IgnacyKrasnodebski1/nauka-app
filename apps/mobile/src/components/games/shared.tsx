import React from "react";
import { StyleSheet, View } from "react-native";
import { COLORS, RADIUS, SPACE, body } from "@/lib/theme";
import { Body, Display, Label } from "../Text";

export interface GameProps<G> {
  game: G;
  /** wynik: ile trafionych z ilu (wywołane raz, po skończeniu gry) */
  onDone(correct: number, total: number): void;
}

export function GameHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: SPACE[4], gap: 4 }}>
      <Label>{title}</Label>
      {sub ? (
        <Display size="lg" weight={700}>
          {sub}
        </Display>
      ) : null}
    </View>
  );
}

export function Feedback({ ok, text }: { ok: boolean; text?: string }) {
  return (
    <View style={[g.fb, { backgroundColor: ok ? COLORS.successSoft : COLORS.dangerSoft }]}>
      <Body size="sm" weight={600} color={ok ? COLORS.success : COLORS.danger}>
        {ok ? "Dobrze" : "Nie tym razem"}
        {text ? <Body size="sm" color={COLORS.textSoft}>{` — ${text}`}</Body> : null}
      </Body>
    </View>
  );
}

export const g = StyleSheet.create({
  tile: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.line, minHeight: 48, justifyContent: "center" },
  tileTxt: { color: COLORS.textSoft, fontSize: 14.5, fontFamily: body(600), lineHeight: 20 },
  tileSel: { borderColor: COLORS.accent, backgroundColor: COLORS.bg4 },
  tileOk: { borderColor: COLORS.success, backgroundColor: COLORS.successSoft },
  tileBad: { borderColor: COLORS.danger, backgroundColor: COLORS.dangerSoft },
  fb: { marginTop: SPACE[4], padding: SPACE[3], paddingHorizontal: SPACE[4], borderRadius: RADIUS.sm },
});
