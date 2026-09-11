import type { MatchGame as MatchGameT } from "@nauka/shared";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { haptic } from "@/lib/app-state";
import { shuffle } from "@/lib/games";
import { Touch } from "../ui";
import { g, GameHead, type GameProps } from "./shared";

/** Dopasuj pary: tapnij lewy, potem prawy. Błędne = czerwony błysk. Wynik = pary trafione bez pomyłki. */
export function MatchGame({ game, onDone }: GameProps<MatchGameT>) {
  const left = useMemo(() => shuffle(game.pairs.map((p, i) => ({ i, t: p.l }))), [game]);
  const right = useMemo(() => shuffle(game.pairs.map((p, i) => ({ i, t: p.r }))), [game]);
  const [selL, setSelL] = useState<number | null>(null);
  const [selR, setSelR] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [bad, setBad] = useState<{ l: number; r: number } | null>(null);
  const mistakes = useRef<Set<number>>(new Set());
  const finished = useRef(false);

  const resolve = (l: number, r: number) => {
    if (l === r) {
      haptic.ok();
      setDone((d) => new Set(d).add(l));
    } else {
      haptic.bad();
      mistakes.current.add(l);
      setBad({ l, r });
      setTimeout(() => setBad(null), 450);
    }
    setSelL(null);
    setSelR(null);
  };
  const pickL = (i: number) => (selR === null ? setSelL(selL === i ? null : i) : resolve(i, selR));
  const pickR = (i: number) => (selL === null ? setSelR(selR === i ? null : i) : resolve(selL, i));

  useEffect(() => {
    if (done.size === game.pairs.length && !finished.current) {
      finished.current = true;
      const correct = game.pairs.length - mistakes.current.size;
      setTimeout(() => onDone(Math.max(0, correct), game.pairs.length), 350);
    }
  }, [done, game.pairs.length, onDone]);

  return (
    <View>
      <GameHead title={game.title ?? "Dopasuj pary 🧩"} sub={`${done.size}/${game.pairs.length} par`} />
      <View style={s.cols}>
        <View style={s.col}>
          {left.map((it) => (
            <Touch key={`l${it.i}`} disabled={done.has(it.i)} onPress={() => pickL(it.i)} style={[g.tile, selL === it.i && g.tileSel, done.has(it.i) && g.tileOk, bad?.l === it.i && g.tileBad]}>
              <Text style={g.tileTxt}>{it.t}</Text>
            </Touch>
          ))}
        </View>
        <View style={s.col}>
          {right.map((it) => (
            <Touch key={`r${it.i}`} disabled={done.has(it.i)} onPress={() => pickR(it.i)} style={[g.tile, selR === it.i && g.tileSel, done.has(it.i) && g.tileOk, bad?.r === it.i && g.tileBad]}>
              <Text style={g.tileTxt}>{it.t}</Text>
            </Touch>
          ))}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  cols: { flexDirection: "row", gap: 10 },
  col: { flex: 1, gap: 9 },
});
