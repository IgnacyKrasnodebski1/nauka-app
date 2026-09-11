import React, { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useReduceMotion } from "@/lib/motion";
import { COLORS, MOTION, RADIUS, SPACE, body, shadowCard } from "@/lib/theme";
import { useHue } from "./Accent";
import { HtmlText } from "./HtmlText";
import { Display, Label, Muted } from "./Text";

/** Fiszka 3D (rotateY + perspective, spring z MOTION): front bg3 z display, tył bg2. */
export function Flashcard({ term, def, tag, flipped, onFlip }: { term: string; def: string; tag?: string; flipped: boolean; onFlip: () => void }) {
  const hue = useHue();
  const reduce = useReduceMotion();
  const rot = useSharedValue(flipped ? 180 : 0);
  useEffect(() => {
    rot.set(reduce ? withTiming(flipped ? 180 : 0, { duration: 0 }) : withSpring(flipped ? 180 : 0, MOTION.spring));
  }, [flipped, rot, reduce]);

  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 1400 }, { rotateY: `${rot.value}deg` }],
    opacity: interpolate(rot.value, [0, 89, 90, 180], [1, 1, 0, 0]),
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 1400 }, { rotateY: `${rot.value + 180}deg` }],
    opacity: interpolate(rot.value, [0, 89, 90, 180], [0, 0, 1, 1]),
  }));

  return (
    <Pressable onPress={onFlip} style={s.wrap} accessibilityRole="button" accessibilityLabel="Odwróć fiszkę">
      <Animated.View style={[s.face, s.front, { borderColor: hue.ring }, front]} pointerEvents={flipped ? "none" : "auto"}>
        <View style={s.hl} />
        {tag ? (
          <Label style={s.tag} numberOfLines={1}>
            {tag}
          </Label>
        ) : null}
        <ScrollView contentContainerStyle={s.center} showsVerticalScrollIndicator={false}>
          <Display size="xl" weight={700} center>
            {term}
          </Display>
        </ScrollView>
        <Muted size="xs" center style={s.hint}>
          dotknij, żeby odwrócić
        </Muted>
      </Animated.View>
      <Animated.View style={[s.face, s.back, back]} pointerEvents={flipped ? "auto" : "none"}>
        <View style={s.hl} />
        <Label color={hue.color} style={s.tag}>
          odpowiedź
        </Label>
        <ScrollView contentContainerStyle={s.center} showsVerticalScrollIndicator={false}>
          <HtmlText html={def} inline textStyle={s.def} boldColor={COLORS.text} />
        </ScrollView>
        <Muted size="xs" center style={s.hint}>
          dotknij, żeby wrócić
        </Muted>
      </Animated.View>
      <View style={{ flex: 1 }} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, minHeight: 260 },
  face: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: RADIUS.xl, borderWidth: 1, padding: SPACE[6], paddingTop: 56, backfaceVisibility: "hidden", overflow: "hidden", ...shadowCard },
  hl: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: COLORS.highlight },
  front: { backgroundColor: COLORS.bg3 },
  back: { backgroundColor: COLORS.bg2, borderColor: COLORS.line },
  tag: { position: "absolute", top: SPACE[5], left: SPACE[6], right: SPACE[6] },
  center: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingBottom: SPACE[6] },
  def: { fontSize: 16.5, lineHeight: 25, color: COLORS.textSoft, textAlign: "center", fontFamily: body(400) },
  hint: { position: "absolute", bottom: SPACE[4], left: 0, right: 0 },
});
