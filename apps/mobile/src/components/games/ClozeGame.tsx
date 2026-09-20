import type { ClozeGame as ClozeGameT } from "@nauka/shared";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { haptic } from "@/lib/app-state";
import { shuffle } from "@/lib/games";
import { COLORS, SPACE, display } from "@/lib/theme";
import { useHue } from "../Accent";
import { Button, Touch } from "../ui";
import { Feedback, g, GameHead, type GameProps } from "./shared";

/** Uzupełnij lukę: zdanie z `___` (luka podświetlona ringiem przedmiotu), wybór z opcji. */
export function ClozeGame({ game, onDone, onAnswer }: GameProps<ClozeGameT>) {
  const hue = useHue();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const item = game.items[idx]!;
  const options = useMemo(() => shuffle([...new Set([item.answer, ...item.options])]), [item]);
  const ok = picked === item.answer;
  const parts = item.s.split("___");

  const pick = (o: string) => {
    if (picked !== null) return;
    setPicked(o);
    onAnswer?.(o === item.answer);
    if (o === item.answer) {
      haptic.ok();
      setScore((x) => x + 1);
    } else haptic.bad();
  };
  const next = () => {
    if (idx + 1 >= game.items.length) return onDone(score, game.items.length);
    setIdx(idx + 1);
    setPicked(null);
  };

  return (
    <View>
      <GameHead title={game.title ?? "Uzupełnij lukę"} sub={`${idx + 1}/${game.items.length}`} />
      <Text style={s.sentence}>
        {parts.map((p, i) => (
          <React.Fragment key={i}>
            {p}
            {i < parts.length - 1 ? (
              <Text style={[s.gap, { color: hue.color, backgroundColor: hue.soft }, picked !== null && (ok ? { color: COLORS.success, backgroundColor: COLORS.successSoft } : { color: COLORS.danger, backgroundColor: COLORS.dangerSoft })]}>
                {" "}
                {picked ?? "______"}{" "}
              </Text>
            ) : null}
          </React.Fragment>
        ))}
      </Text>
      <View style={s.opts}>
        {options.map((o) => {
          const isAns = o === item.answer;
          const st = picked === null ? null : isAns ? g.tileOk : picked === o ? g.tileBad : { opacity: 0.4 };
          return (
            <Touch key={o} onPress={() => pick(o)} disabled={picked !== null} style={[g.tile, st, isAns && picked !== null && { opacity: 1 }]}>
              <Text style={g.tileTxt}>{o}</Text>
            </Touch>
          );
        })}
      </View>
      {picked !== null ? (
        <>
          <Feedback ok={ok} text={ok ? item.e : `poprawnie: ${item.answer}${item.e ? ". " + item.e : ""}`} />
          <Button label={idx + 1 >= game.items.length ? "Dalej" : "Następne"} onPress={next} style={{ marginTop: SPACE[4] }} />
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  sentence: { color: COLORS.text, fontSize: 20, fontFamily: display(600), lineHeight: 30, marginBottom: SPACE[5] },
  gap: { borderRadius: 6, overflow: "hidden" },
  opts: { flexDirection: "row", flexWrap: "wrap", gap: SPACE[2] },
});
