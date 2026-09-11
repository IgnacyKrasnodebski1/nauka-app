import React, { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { C, FONT, R } from "@/lib/theme";
import { HtmlText } from "./HtmlText";
import { Tag } from "./ui";
import { useAccent } from "./Accent";

/** Fiszka z animacją odwracania (rotateY) — port `.flip` z legacy. */
export function Flashcard({ term, def, tag, flipped, onFlip }: { term: string; def: string; tag?: string; flipped: boolean; onFlip: () => void }) {
  const a = useAccent();
  const rot = useSharedValue(flipped ? 180 : 0);
  useEffect(() => {
    rot.value = withSpring(flipped ? 180 : 0, { damping: 16, stiffness: 140 });
  }, [flipped, rot]);

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
      <Animated.View style={[s.face, s.front, front]} pointerEvents={flipped ? "none" : "auto"}>
        {tag ? <Tag style={s.tag}>{tag}</Tag> : null}
        <ScrollView contentContainerStyle={s.center} showsVerticalScrollIndicator={false}>
          <Text style={s.term}>{term}</Text>
        </ScrollView>
        <Text style={s.hint}>tapnij = odpowiedź 👀</Text>
      </Animated.View>
      <Animated.View style={[s.face, s.back, back]} pointerEvents={flipped ? "auto" : "none"}>
        <Tag style={s.tag}>odpowiedź ✅</Tag>
        <ScrollView contentContainerStyle={s.center} showsVerticalScrollIndicator={false}>
          <HtmlText html={def} inline textStyle={s.def} boldColor={a.solid} />
        </ScrollView>
        <Text style={s.hint}>tapnij = wróć ↩</Text>
      </Animated.View>
      <View style={s.spacer} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, minHeight: 260 },
  spacer: { flex: 1 },
  face: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, padding: 26, paddingTop: 56, backfaceVisibility: "hidden" },
  front: { backgroundColor: "#2a1840" },
  back: { backgroundColor: "#0f2f33" },
  tag: { position: "absolute", top: 18, left: 18, marginBottom: 0 },
  center: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingBottom: 24 },
  term: { color: C.txt, fontSize: 25, fontWeight: FONT.black, letterSpacing: -0.5, lineHeight: 30, textAlign: "center" },
  def: { fontSize: 16.5, lineHeight: 24, color: "#eaeaf6", textAlign: "center" },
  hint: { position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", color: C.muted, fontSize: 12.5, fontWeight: FONT.semi },
});
