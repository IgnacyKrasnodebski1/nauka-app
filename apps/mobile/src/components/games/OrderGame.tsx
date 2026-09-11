import type { OrderGame as OrderGameT } from "@nauka/shared";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { haptic } from "@/lib/app-state";
import { shuffle } from "@/lib/games";
import { COLORS, SPACE, display } from "@/lib/theme";
import { useHue } from "../Accent";
import { Muted } from "../Text";
import { Button, Touch } from "../ui";
import { Feedback, g, GameHead, type GameProps } from "./shared";

/** Ułóż w kolejności: tapnij klocki po kolei; tapnięcie w ułożony klocek cofa go. Sprawdź → success/danger na pozycjach. */
export function OrderGame({ game, onDone }: GameProps<OrderGameT>) {
  const hue = useHue();
  const pool = useMemo(() => {
    let sh = shuffle(game.steps.map((t, i) => ({ i, t })));
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
  const remove = (k: number) => !checked && setOrder(order.filter((_, j) => j !== k));
  const check = () => {
    setChecked(true);
    if (correctCount === game.steps.length) haptic.ok();
    else haptic.bad();
  };

  return (
    <View>
      <GameHead title={game.title ?? "Ułóż w kolejności"} sub={game.prompt} />
      <View style={s.build}>
        {order.length === 0 ? (
          <Muted size="xs" center style={{ paddingVertical: SPACE[3] }}>
            dotykaj klocków poniżej w dobrej kolejności
          </Muted>
        ) : null}
        {order.map((i, k) => (
          <Touch key={i} onPress={() => remove(k)} style={[g.tile, s.row, { borderColor: hue.ring }, checked && (i === k ? g.tileOk : g.tileBad)]}>
            <Text style={[s.num, { color: hue.color }]}>{k + 1}</Text>
            <Text style={[g.tileTxt, { flex: 1 }]}>{game.steps[i]}</Text>
            {checked && i !== k ? <Text style={s.fix}>→ {i + 1}</Text> : null}
          </Touch>
        ))}
      </View>
      <View style={{ gap: SPACE[2] }}>
        {pool
          .filter((x) => !order.includes(x.i))
          .map((x) => (
            <Touch key={x.i} onPress={() => add(x.i)} style={g.tile}>
              <Text style={g.tileTxt}>{x.t}</Text>
            </Touch>
          ))}
      </View>
      {!checked ? (
        <Button label="Sprawdź" onPress={check} disabled={order.length !== game.steps.length} style={{ marginTop: SPACE[4] }} />
      ) : (
        <>
          <Feedback ok={correctCount === game.steps.length} text={`${correctCount}/${game.steps.length} na dobrym miejscu`} />
          <Button label="Dalej" onPress={() => onDone(correctCount, game.steps.length)} style={{ marginTop: SPACE[4] }} />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  build: { minHeight: 64, borderBottomWidth: 1, borderStyle: "dashed", borderBottomColor: COLORS.lineStrong, paddingBottom: SPACE[3], marginBottom: SPACE[3], gap: SPACE[2] },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE[3] },
  num: { fontFamily: display(700), fontSize: 14, width: 20 },
  fix: { color: COLORS.danger, fontFamily: display(700), fontSize: 13 },
});
