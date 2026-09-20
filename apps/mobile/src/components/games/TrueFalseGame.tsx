import type { TrueFalseGame as TrueFalseGameT } from "@nauka/shared";
import React, { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { haptic } from "@/lib/app-state";
import { COLORS, PLAY, RADIUS, SPACE, display } from "@/lib/theme";
import { Button3D } from "../Button3D";
import { Icon } from "../Icon";
import { SwipeDeck, type SwipeDeckHandle } from "../SwipeDeck";
import { Muted } from "../Text";
import { Feedback, GameHead, type GameProps } from "./shared";

/** Prawda / fałsz jako swipe (prawo = prawda, lewo = fałsz) + dwa przyciski 3D pod stosem. */
export function TrueFalseGame({ game, onDone, onAnswer }: GameProps<TrueFalseGameT>) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const deck = useRef<SwipeDeckHandle>(null);
  const item = game.items[idx];
  const ok = item ? picked === item.v : false;

  const answer = (v: boolean) => {
    if (picked !== null || !item) return;
    setPicked(v);
    onAnswer?.(v === item.v);
    if (v === item.v) {
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
      <GameHead title={game.title ?? "Prawda czy fałsz"} sub={`${idx + 1}/${game.items.length}`} />
      <View style={{ height: 210 }}>
        <SwipeDeck
          ref={deck}
          items={game.items}
          index={idx}
          keyOf={(_, i) => `tf${i}`}
          allowUp={false}
          labels={{ left: "Fałsz", right: "Prawda" }}
          icons={{ left: "close", right: "checkmark" }}
          onSwipe={(dir) => answer(dir === "right")}
          renderCard={(it, _i, top) => (
            <View style={[s.stmt, picked !== null && top && (ok ? s.stmtOk : s.stmtBad)]}>
              <Text style={s.stmtTxt}>{it.s}</Text>
              {top && picked === null ? (
                <View style={s.hint}>
                  <Icon name="arrow-back" size={12} color={PLAY.red} />
                  <Muted size="xs" weight={700}>
                    przesuń
                  </Muted>
                  <Icon name="arrow-forward" size={12} color={PLAY.green} />
                </View>
              ) : null}
            </View>
          )}
        />
      </View>
      {picked === null ? (
        <View style={s.row}>
          <Button3D label="Fałsz" variant="red" onPress={() => deck.current?.swipe("left")} style={{ flex: 1 }} left={<Icon name="close" size={18} color="#fff" />} />
          <Button3D label="Prawda" variant="green" onPress={() => deck.current?.swipe("right")} style={{ flex: 1 }} left={<Icon name="checkmark" size={18} color="#fff" />} />
        </View>
      ) : (
        <>
          <Feedback ok={ok} text={item?.e ?? (item?.v ? "to prawda" : "to fałsz")} />
          <Button3D label={idx + 1 >= game.items.length ? "Dalej" : "Następne"} variant={ok ? "green" : "red"} onPress={next} style={{ marginTop: SPACE[3] }} />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  stmt: { flex: 1, backgroundColor: COLORS.bg3, borderWidth: 1.5, borderColor: COLORS.lineStrong, borderBottomWidth: 5, borderBottomColor: PLAY.surfaceDeep, borderRadius: RADIUS.xl, padding: SPACE[5], justifyContent: "center", alignItems: "center", gap: SPACE[3] },
  stmtOk: { borderColor: PLAY.green, borderBottomColor: PLAY.greenDeep, backgroundColor: PLAY.greenSoft },
  stmtBad: { borderColor: PLAY.red, borderBottomColor: PLAY.redDeep, backgroundColor: PLAY.redSoft },
  stmtTxt: { color: COLORS.text, fontSize: 19, fontFamily: display(700), lineHeight: 27, textAlign: "center" },
  hint: { flexDirection: "row", alignItems: "center", gap: 6 },
  row: { flexDirection: "row", gap: SPACE[2], marginTop: SPACE[3] },
});
