import type { MatchGame as MatchGameT } from "@nauka/shared";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { haptic } from "@/lib/app-state";
import { shuffle } from "@/lib/games";
import { useReduceMotion } from "@/lib/motion";
import { MOTION, SPACE } from "@/lib/theme";
import { Touch } from "../ui";
import { g, GameHead, type GameProps } from "./shared";

function Tile({ text, sel, done, bad, onPress }: { text: string; sel: boolean; done: boolean; bad: boolean; onPress: () => void }) {
  const reduce = useReduceMotion();
  const sc = useSharedValue(1);
  const op = useSharedValue(1);
  useEffect(() => {
    if (done) {
      sc.set(withTiming(reduce ? 1 : 0.94, { duration: MOTION.base }));
      op.set(withTiming(0.45, { duration: MOTION.base }));
    }
  }, [done, sc, op, reduce]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }], opacity: op.value }));
  return (
    <Animated.View style={anim}>
      <Touch disabled={done} onPress={onPress} style={[g.tile, sel && g.tileSel, done && g.tileOk, bad && g.tileBad]}>
        <Text style={g.tileTxt}>{text}</Text>
      </Touch>
    </Animated.View>
  );
}

/** Dopasuj pary: tapnij lewy, potem prawy. Dopasowane znikają (skala/alfa), błędne — czerwony błysk. */
export function MatchGame({ game, onDone, onAnswer }: GameProps<MatchGameT>) {
  const left = useMemo(() => shuffle(game.pairs.map((p, i) => ({ i, t: p.l }))), [game]);
  const right = useMemo(() => shuffle(game.pairs.map((p, i) => ({ i, t: p.r }))), [game]);
  const [selL, setSelL] = useState<number | null>(null);
  const [selR, setSelR] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [bad, setBad] = useState<{ l: number; r: number } | null>(null);
  const mistakes = useRef<Set<number>>(new Set());
  const finished = useRef(false);

  const resolve = (l: number, r: number) => {
    onAnswer?.(l === r);
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
      <GameHead title={game.title ?? "Dopasuj pary"} sub={`${done.size}/${game.pairs.length} par`} />
      <View style={s.cols}>
        <View style={s.col}>
          {left.map((it) => (
            <Tile key={`l${it.i}`} text={it.t} sel={selL === it.i} done={done.has(it.i)} bad={bad?.l === it.i} onPress={() => pickL(it.i)} />
          ))}
        </View>
        <View style={s.col}>
          {right.map((it) => (
            <Tile key={`r${it.i}`} text={it.t} sel={selR === it.i} done={done.has(it.i)} bad={bad?.r === it.i} onPress={() => pickR(it.i)} />
          ))}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  cols: { flexDirection: "row", gap: SPACE[2] },
  col: { flex: 1, gap: SPACE[2] },
});
