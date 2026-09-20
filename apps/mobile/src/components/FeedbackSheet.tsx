import { MASCOT_LINES } from "@nauka/shared";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, PLAY, RADIUS, SPACE, UI, body } from "@/lib/theme";
import { Button3D } from "./Button3D";
import { HtmlText } from "./HtmlText";
import { Icon } from "./Icon";
import { XpChip } from "./Lesson";
import { Mascot } from "./Mascot";
import { Body, Display } from "./Text";

/**
 * Arkusz feedbacku po odpowiedzi: wjeżdża z dołu, zielony (dobrze) / czerwony (źle), maskotka happy/sad,
 * tytuł, wyjaśnienie (HTML), chip „+5 XP ×2”, przycisk DALEJ 3D. Absolutnie na dole ekranu (safe-area).
 */
export function FeedbackSheet({ ok, title, explanation, correctLabel, xp, mult = 1, onNext, nextLabel = "Dalej", heartLost, seed = 0 }: { ok: boolean; title?: string; explanation?: string; correctLabel?: string; xp?: number; mult?: number; onNext: () => void; nextLabel?: string; heartLost?: boolean; seed?: number }) {
  const insets = useSafeAreaInsets();
  const accent = ok ? PLAY.green : PLAY.red;
  const line = useMemo(() => (ok ? MASCOT_LINES.happy : MASCOT_LINES.sad)[seed % 3]!, [ok, seed]);
  return (
    <Animated.View entering={SlideInDown.duration(260)} exiting={SlideOutDown.duration(200)} style={[s.sheet, { paddingBottom: insets.bottom + SPACE[4], borderTopColor: accent }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: ok ? PLAY.greenSoft : PLAY.redSoft, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl }]} />
      <View style={s.head}>
        <Mascot state={ok ? "happy" : "sad"} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name={ok ? "checkmark-circle" : "close-circle"} size={20} color={accent} />
            <Display size="lg" weight={800} color={accent}>
              {title ?? (ok ? "Dobrze!" : "Nie tym razem")}
            </Display>
          </View>
          <Body size="sm" color={COLORS.textSoft}>
            {line}
          </Body>
        </View>
        {ok && xp ? <XpChip xp={xp} mult={mult} color={PLAY.yellow} /> : null}
        {!ok && heartLost ? (
          <View style={s.heart}>
            <Icon name="heart-dislike" size={16} color={PLAY.red} />
            <Body size="sm" weight={700} color={PLAY.red}>
              −1
            </Body>
          </View>
        ) : null}
      </View>
      {correctLabel ? (
        <View style={s.correct}>
          <Body size="sm" weight={700} color={PLAY.green} style={{ textTransform: "uppercase", letterSpacing: 1, fontSize: 12 }}>
            Poprawna odpowiedź
          </Body>
          <Body weight={600} color={COLORS.text}>
            {correctLabel}
          </Body>
        </View>
      ) : null}
      {explanation ? (
        <ScrollView style={{ maxHeight: 132 }} showsVerticalScrollIndicator={false}>
          <HtmlText html={explanation} inline textStyle={s.explain} boldColor={COLORS.text} />
        </ScrollView>
      ) : null}
      <Button3D label={nextLabel} variant={ok ? "green" : "red"} onPress={onNext} style={{ marginTop: SPACE[1] }} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: COLORS.bg2, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, borderTopWidth: 3, paddingHorizontal: UI.gutter, paddingTop: SPACE[4], gap: SPACE[3], overflow: "hidden", zIndex: 50, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 20 },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE[3] },
  heart: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: COLORS.bg3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill },
  correct: { backgroundColor: COLORS.bg3, borderRadius: RADIUS.sm, padding: SPACE[3], gap: 2 },
  explain: { fontSize: 14.5, lineHeight: 21, color: COLORS.textSoft, fontFamily: body(500) },
});
