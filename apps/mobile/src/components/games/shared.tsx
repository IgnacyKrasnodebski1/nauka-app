import React from "react";
import { StyleSheet, View } from "react-native";
import { COLORS, HARD_EDGE, PLAY, RADIUS, SPACE, body } from "@/lib/theme";
import { Body, Display, Label } from "../Text";

export interface GameProps<G> {
  game: G;
  /** wynik: ile trafionych z ilu (wywołane raz, po skończeniu gry) */
  onDone(correct: number, total: number): void;
  /** każda pojedyncza odpowiedź (combo, questy, dźwięk) */
  onAnswer?(correct: boolean): void;
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
    <View style={[g.fb, { backgroundColor: ok ? COLORS.successSoft : COLORS.dangerSoft, borderColor: ok ? COLORS.success : COLORS.danger }]}>
      <Body size="sm" weight={700} color={ok ? COLORS.success : COLORS.danger}>
        {ok ? "Dobrze!" : "Nie tym razem"}
        {text ? <Body size="sm" color={COLORS.textSoft}>{` — ${text}`}</Body> : null}
      </Body>
    </View>
  );
}

/** Kafle odpowiedzi 3D: bg3 + krawędź surfaceDeep; wybrany = niebieski ring; ok = zielony; źle = czerwony. */
export const g = StyleSheet.create({
  tile: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.bg3, borderWidth: 1.5, borderColor: COLORS.lineStrong, borderBottomWidth: HARD_EDGE + 1.5, borderBottomColor: PLAY.surfaceDeep, minHeight: 50, justifyContent: "center" },
  tileTxt: { color: COLORS.textSoft, fontSize: 14.5, fontFamily: body(600), lineHeight: 20 },
  tileSel: { borderColor: PLAY.blue, borderBottomColor: PLAY.blueDeep, backgroundColor: PLAY.blueSoft },
  tileOk: { borderColor: PLAY.green, borderBottomColor: PLAY.greenDeep, backgroundColor: PLAY.greenSoft },
  tileBad: { borderColor: PLAY.red, borderBottomColor: PLAY.redDeep, backgroundColor: PLAY.redSoft },
  fb: { marginTop: SPACE[4], padding: SPACE[3], paddingHorizontal: SPACE[4], borderRadius: RADIUS.md, borderWidth: 1.5 },
});
