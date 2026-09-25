import React, { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useReduceMotion } from "@/lib/motion";
import { T, TONES } from "@/lib/theme";
import { useAccent } from "./Accent";
import { HtmlText } from "./HtmlText";
import { Icon } from "./Icon";
import { Motion } from "./Motion";
import { Body, Display, Eyebrow, Muted } from "./Text";
import { Press, Tag } from "./ui";

/**
 * Fiszka (Flashcards.html): stos 3 kart (dwie z tyłu), przód w tincie przedmiotu z tagiem i terminem, tył z definicją;
 * dotknięcie = obrót (rotateY + perspective), przeciągnięcie w lewo = powtórz, w prawo = umiem.
 */
export function Flip({ term, def, tag, counter, flipped, onFlip, onSwipe, height = 392, sub, tagRight }: { term: string; def: string; tag?: string; counter?: string; flipped: boolean; onFlip: () => void; onSwipe?: (known: boolean) => void; height?: number; sub?: string; tagRight?: string }) {
  const acc = useAccent();
  const reduce = useReduceMotion();
  const rot = useSharedValue(flipped ? 180 : 0);
  const tx = useSharedValue(0);
  useEffect(() => {
    rot.set(reduce ? withTiming(flipped ? 180 : 0, { duration: 0 }) : withSpring(flipped ? 180 : 0, { damping: 18, stiffness: 220 }));
  }, [flipped, rot, reduce]);
  const pan = Gesture.Pan()
    .enabled(!!onSwipe)
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      tx.set(e.translationX);
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 80 && onSwipe) {
        tx.set(withTiming(e.translationX > 0 ? 500 : -500, { duration: reduce ? 0 : 220 }, () => {
          tx.set(0);
        }));
        runOnJS(onSwipe)(e.translationX > 0);
      } else tx.set(withSpring(0));
    });
  const wrap = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { rotate: `${tx.value / 20}deg` }] }));
  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 1400 }, { rotateY: `${rot.value}deg` }], opacity: interpolate(rot.value, [0, 89, 90, 180], [1, 1, 0, 0]) }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 1400 }, { rotateY: `${rot.value + 180}deg` }], opacity: interpolate(rot.value, [0, 89, 90, 180], [0, 0, 1, 1]) }));
  return (
    <View style={{ height: height + 8 }}>
      <View style={[s.ghost, { top: 26, left: 22, right: 22, height: height - 12, backgroundColor: "#16142C", borderColor: "#221E42" }]} />
      <View style={[s.ghost, { top: 20, left: 12, right: 12, height: height - 6, backgroundColor: T.surface, borderColor: T.line }]} />
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ height }, wrap]}>
          <Motion kind="sway" style={{ flex: 1 }}>
            <Pressable onPress={onFlip} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={flipped ? "Wróć na przód fiszki" : "Odwróć fiszkę"}>
              <Animated.View style={[s.face, { backgroundColor: acc.tint, borderColor: acc.tintLine, shadowColor: acc.tintShadow }, front]} pointerEvents={flipped ? "none" : "auto"}>
                <View style={s.top}>
                  <Tag label={tag ?? "Termin"} tone="accent" />
                  {counter ? (
                    <Body size={12} weight={800} color={acc.sub}>
                      {counter}
                    </Body>
                  ) : null}
                </View>
                <ScrollView contentContainerStyle={s.center} showsVerticalScrollIndicator={false}>
                  <Display size={term.length > 40 ? 24 : 34} center ls={-1.2} lh={term.length > 40 ? 30 : 38}>
                    {term}
                  </Display>
                  {sub ? (
                    <Body size={13.5} weight={600} color={acc.sub} center style={{ marginTop: 14 }}>
                      {sub}
                    </Body>
                  ) : null}
                </ScrollView>
                <View style={s.hint}>
                  <Icon name="refresh" size={18} color={acc.sub} />
                  <Muted size={13} weight={700} color={acc.sub}>
                    dotknij, żeby odwrócić
                  </Muted>
                </View>
              </Animated.View>
              <Animated.View style={[s.face, { backgroundColor: T.surface, borderColor: T.line }, back]} pointerEvents={flipped ? "auto" : "none"}>
                <View style={s.top}>
                  <Tag label={tagRight ?? "odpowiedź"} />
                </View>
                <ScrollView contentContainerStyle={[s.center, { justifyContent: "flex-start" }]} showsVerticalScrollIndicator={false}>
                  <HtmlText html={def} inline textStyle={{ fontSize: 17, lineHeight: 26, color: T.txt }} boldColor={acc.color} />
                </ScrollView>
                <View style={s.hint}>
                  <Muted size={13} weight={700}>
                    dotknij, żeby wrócić
                  </Muted>
                </View>
              </Animated.View>
            </Pressable>
          </Motion>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** Podpowiedź pod kartą: „w lewo = powtórz · w prawo = umiem”. */
export function SwipeHint({ left = "w lewo = powtórz", right = "w prawo = umiem" }: { left?: string; right?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Motion kind="bob">
          <Icon name="back" size={16} stroke={2.8} color="#FF6B84" />
        </Motion>
        <Body size={12} weight={800} color="#FF6B84">
          {left}
        </Body>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Body size={12} weight={800} color={T.acid}>
          {right}
        </Body>
        <Motion kind="bob" d={2}>
          <Icon name="chevron-right" size={16} stroke={2.8} color={T.acid} />
        </Motion>
      </View>
    </View>
  );
}

/** Przyciski „POWTÓRZ” / „UMIEM” (`.fbtns`). */
export function KnowButtons({ onNo, onYes, noLabel = "Powtórz", yesLabel = "Umiem" }: { onNo: () => void; onYes: () => void; noLabel?: string; yesLabel?: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <Press onPress={onNo} drop={5} edge={TONES.red.tintShadow} radius={20} style={{ flex: 1 }} faceStyle={[s.kbtn, { backgroundColor: TONES.red.tint, borderColor: TONES.red.tintLine }]} accessibilityLabel={noLabel}>
        <Icon name="refresh" size={18} stroke={2.8} color={TONES.red.txt} />
        <Body size={14} weight={800} color={TONES.red.txt} ls={1}>
          {noLabel.toUpperCase()}
        </Body>
      </Press>
      <Press onPress={onYes} drop={5} edge={T.acidDark} radius={20} style={{ flex: 1 }} faceStyle={[s.kbtn, { backgroundColor: T.acid, borderColor: T.acid }]} accessibilityLabel={yesLabel}>
        <Icon name="check" size={18} stroke={3.4} color={T.onAcid} />
        <Body size={14} weight={800} color={T.onAcid} ls={1}>
          {yesLabel.toUpperCase()}
        </Body>
      </Press>
    </View>
  );
}

/** Nagłówek „Fiszki · Makro” z licznikiem i pigułką XP. */
export function DeckEyebrow({ children }: { children: string }) {
  return <Eyebrow>{children}</Eyebrow>;
}

const s = StyleSheet.create({
  ghost: { position: "absolute", borderRadius: 30, borderWidth: 2 },
  face: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 30, borderWidth: 2, paddingVertical: 26, paddingHorizontal: 24, justifyContent: "space-between", backfaceVisibility: "hidden" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  center: { flexGrow: 1, justifyContent: "center", paddingVertical: 12 },
  hint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  kbtn: { height: 62, borderWidth: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
