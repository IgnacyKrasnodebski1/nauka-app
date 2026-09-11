import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring } from "react-native-reanimated";
import { C, FONT } from "@/lib/theme";
import { AccentText } from "./ui";

/** Ekran wyniku (lekcja/quiz/egzamin) z animowanym emoji i podsumowaniem. */
export function ResultView({ emoji, title, score, verdict, children }: { emoji: string; title: string; score?: React.ReactNode; verdict?: string; children?: React.ReactNode }) {
  const sc = useSharedValue(0.3);
  useEffect(() => {
    sc.value = withDelay(80, withSequence(withSpring(1.25, { damping: 8 }), withSpring(1)));
  }, [sc]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <View style={s.wrap}>
      <Animated.Text style={[s.big, st]}>{emoji}</Animated.Text>
      <Text style={s.h2}>{title}</Text>
      {score ? <Text style={s.score}>{score}</Text> : null}
      {verdict ? <Text style={s.p}>{verdict}</Text> : null}
      {children}
    </View>
  );
}

export function ScoreLine({ correct, total, extra }: { correct: number; total: number; extra?: string }) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  return (
    <>
      Trafione{" "}
      <AccentText style={{ fontWeight: FONT.black }}>
        {correct}/{total}
      </AccentText>{" "}
      ({pct}%){extra ? ` · ${extra}` : ""}
    </>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  big: { fontSize: 60 },
  h2: { color: C.txt, fontSize: 26, fontWeight: FONT.black, letterSpacing: -0.5, textAlign: "center" },
  score: { color: C.txt, fontSize: 19, fontWeight: FONT.black, textAlign: "center" },
  p: { color: C.muted, fontSize: 15.5, lineHeight: 23, textAlign: "center", maxWidth: 340 },
});
