import type { OrderGame as OrderGameT } from "@nauka/shared";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { haptic } from "@/lib/app-state";
import { shuffle } from "@/lib/games";
import { C, FONT } from "@/lib/theme";
import { PillButton, Touch } from "../ui";
import { Feedback, g, GameHead, type GameProps } from "./shared";

/** Ułóż w kolejności: tapnij klocki po kolei; tapnięcie w ułożony klocek cofa go. Sprawdź → zielone/czerwone pozycje. */
export function OrderGame({ game, onDone }: GameProps<OrderGameT>) {
  const pool = useMemo(() => {
    let sh = shuffle(game.steps.map((t, i) => ({ i, t })));
    // nie pokazujemy od razu poprawnej kolejności
    if (sh.every((x, k) => x.i === k) && sh.length > 1) sh = [...sh.slice(1), sh[0]!];
    return sh;
  }, [game]);
  const [order, setOrder] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const correctCount = order.filter((v, k) => v === k).length;

  const add = (i: number) => {
    if (checked || order.includes(i)) return;
    haptic.tap();
    setOrder([...order, i]);
  };
  const remove = (k: number) => {
    if (checked) return;
    setOrder(order.filter((_, j) => j !== k));
  };
  const check = () => {
    setChecked(true);
    if (correctCount === game.steps.length) haptic.ok();
    else haptic.bad();
  };

  return (
    <View>
      <GameHead title={game.title ?? "Ułóż w kolejności 🔢"} sub={game.prompt} />
      <View style={s.build}>
        {order.length === 0 ? <Text style={s.hint}>tapnij klocki poniżej w dobrej kolejności 👇</Text> : null}
        {order.map((i, k) => (
          <Touch key={i} onPress={() => remove(k)} style={[g.tile, s.row, checked && (i === k ? g.tileOk : g.tileBad), checked && { opacity: 1 }]}>
            <Text style={s.num}>{k + 1}.</Text>
            <Text style={[g.tileTxt, { flex: 1 }]}>{game.steps[i]}</Text>
            {checked && i !== k ? <Text style={s.fix}>→ {i + 1}</Text> : null}
          </Touch>
        ))}
      </View>
      <View style={s.pool}>
        {pool
          .filter((x) => !order.includes(x.i))
          .map((x) => (
            <Touch key={x.i} onPress={() => add(x.i)} style={g.tile}>
              <Text style={g.tileTxt}>{x.t}</Text>
            </Touch>
          ))}
      </View>
      {!checked ? (
        <PillButton label="sprawdź ✅" onPress={check} disabled={order.length !== game.steps.length} style={{ marginTop: 14 }} />
      ) : (
        <>
          <Feedback ok={correctCount === game.steps.length} text={`${correctCount}/${game.steps.length} na dobrym miejscu`} />
          <PillButton label="dalej 🏁" onPress={() => onDone(correctCount, game.steps.length)} style={{ marginTop: 14 }} />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  build: { minHeight: 64, borderBottomWidth: 2, borderStyle: "dashed", borderBottomColor: "rgba(255,255,255,0.15)", paddingBottom: 10, marginBottom: 12, gap: 8 },
  hint: { color: C.muted, fontSize: 13, fontWeight: FONT.semi, textAlign: "center", paddingVertical: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  num: { color: C.cyan, fontWeight: FONT.black, fontSize: 14, width: 24 },
  fix: { color: C.red, fontWeight: FONT.black, fontSize: 13 },
  pool: { gap: 8 },
});
