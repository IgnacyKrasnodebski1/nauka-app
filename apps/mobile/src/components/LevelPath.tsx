import { isLevelUnlocked, levelProgress, type SubjectProgress, type Topic } from "@nauka/shared";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useReduceMotion } from "@/lib/motion";
import { COLORS, SPACE, UI, body, display, tabular } from "@/lib/theme";
import { useHue } from "./Accent";
import { Muted, Title } from "./Text";
import { Touch } from "./ui";

/** Pulsująca poświata aktywnego węzła (opacity/scale), wyłączona przy Reduce Motion. */
function Pulse({ color }: { color: string }) {
  const reduce = useReduceMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    v.set(withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 1100, easing: Easing.in(Easing.quad) })), -1, false));
  }, [v, reduce]);
  const st = useAnimatedStyle(() => ({ opacity: 0.18 + v.value * 0.25, transform: [{ scale: 1.15 + v.value * 0.3 }] }));
  return <Animated.View pointerEvents="none" style={[s.pulse, { backgroundColor: color }, st]} />;
}

/** Pionowa ścieżka poziomów: oś hairline, węzły 64px (zrobione = hue + ✓, aktywny = pulsująca poświata + złoty ring, zablokowany = bg3 + kłódka). */
export function LevelPath({ subject, progress, onOpen, onLocked }: { subject: Topic; progress: SubjectProgress; onOpen: (levelId: string) => void; onLocked: () => void }) {
  const hue = useHue();
  return (
    <View style={s.path}>
      <View style={s.axis} />
      {subject.levels.map((lv, i) => {
        const lp = levelProgress(progress, lv.id);
        const unlocked = isLevelUnlocked(subject, progress, lv.id);
        const active = unlocked && !lp.done;
        return (
          <View key={lv.id} style={[s.row, i === subject.levels.length - 1 && { paddingBottom: 0 }]}>
            <Touch onPress={unlocked ? () => onOpen(lv.id) : onLocked} style={s.nodeWrap} accessibilityLabel={lv.title}>
              {active ? <Pulse color={hue.color} /> : null}
              <View style={[s.node, lp.done && { backgroundColor: hue.color, borderColor: hue.color }, active && { backgroundColor: hue.soft, borderColor: COLORS.accent, borderWidth: 2 }, !unlocked && s.lock]}>
                <Text style={[s.nodeTxt, lp.done && { color: COLORS.bg0, fontFamily: display(800) }, !unlocked && { opacity: 0.55 }]}>{lp.done ? "✓" : unlocked ? lv.emoji || "•" : "🔒"}</Text>
              </View>
              {lp.done ? (
                <Text style={s.stars}>
                  {"★".repeat(lp.stars)}
                  <Text style={{ color: COLORS.faint }}>{"★".repeat(Math.max(0, 3 - lp.stars))}</Text>
                </Text>
              ) : null}
            </Touch>
            <Touch onPress={unlocked ? () => onOpen(lv.id) : onLocked} style={s.meta}>
              <Muted size="xs" weight={600} color={active ? COLORS.accent : COLORS.faint} style={tabular}>
                {active ? "TERAZ" : lp.done ? `NAJLEPSZY ${lp.best}%` : `POZIOM ${i + 1}`}
              </Muted>
              <Title size="base" color={unlocked ? COLORS.text : COLORS.muted} numberOfLines={2}>
                {lv.title}
              </Title>
              <Muted size="xs" style={tabular}>
                {lv.quiz.length} pytań · {lv.flashcards.length} fiszek
              </Muted>
            </Touch>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  path: { paddingVertical: SPACE[4], paddingLeft: SPACE[1] },
  axis: { position: "absolute", left: SPACE[1] + UI.node / 2, top: SPACE[4], bottom: SPACE[4], width: StyleSheet.hairlineWidth, backgroundColor: COLORS.lineStrong },
  row: { flexDirection: "row", alignItems: "flex-start", gap: SPACE[4], paddingBottom: SPACE[6] },
  nodeWrap: { width: UI.node, alignItems: "center" },
  pulse: { position: "absolute", top: 0, width: UI.node, height: UI.node, borderRadius: UI.node / 2 },
  node: { width: UI.node, height: UI.node, borderRadius: UI.node / 2, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.lineStrong },
  lock: { backgroundColor: COLORS.bg3, borderColor: COLORS.line },
  nodeTxt: { fontSize: 24, color: COLORS.text, fontFamily: body(700) },
  stars: { marginTop: 6, fontSize: 11, color: COLORS.accent, letterSpacing: 1 },
  meta: { flex: 1, gap: 2, paddingTop: 10 },
});
