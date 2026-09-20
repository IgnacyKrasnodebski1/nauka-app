import { GEM_COSTS, formatCountdown, type Achievement, type HeartsView, type Rank } from "@nauka/shared";
import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInUp, FadeOut, FadeOutUp, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, PLAY, RADIUS, SPACE, withAlpha } from "@/lib/theme";
import { HueProvider } from "./Accent";
import { Button3D } from "./Button3D";
import { Confetti } from "./Confetti";
import { ACHIEVEMENT_ICON, Icon } from "./Icon";
import { Mascot } from "./Mascot";
import { GemIcon } from "./Pills";
import { Body, Display, Label, Muted } from "./Text";

function Sheet({ children, onClose, accent }: { children: React.ReactNode; onClose?: () => void; accent?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={ZoomIn.springify().damping(14).stiffness(220)} style={[s.box, { marginBottom: insets.bottom + SPACE[6], borderColor: accent ? withAlpha(accent, 0.5) : COLORS.lineStrong }]}>
          {accent ? <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(accent, 0.08) }]} /> : null}
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/** Awans rangi: confetti, maskotka cheer, nazwa rangi w jej kolorze. */
export function LevelUpModal({ rank, onClose }: { rank: Rank; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} accent={rank.color}>
      <HueProvider color={rank.color}>
        <Confetti run count={80} origin={0.5} top={40} />
      </HueProvider>
      <Mascot state="cheer" size={120} streak={7} />
      <Label color={rank.color}>nowa ranga</Label>
      <Display size="2xl" weight={800} center color={rank.color}>
        {rank.name}
      </Display>
      <Body center color={COLORS.muted}>
        {rank.next ? `Od ${rank.min} XP. Następna ranga od ${rank.next} XP — lecimy dalej.` : "Najwyższa ranga w Recall. Szacunek."}
      </Body>
      <Button3D label="Sztos" variant="green" onPress={onClose} style={{ alignSelf: "stretch", marginTop: SPACE[2] }} />
    </Sheet>
  );
}

/** Brak serc: czekaj (odliczanie) / 150 klejnotów / Pro. */
export function NoHeartsModal({ hearts, gems, isPro, onRefill, onPro, onClose }: { hearts: HeartsView; gems: number; isPro: boolean; onRefill: () => void; onPro: () => void; onClose: () => void }) {
  const canAfford = gems >= GEM_COSTS.heartRefill;
  return (
    <Sheet onClose={onClose} accent={PLAY.red}>
      <Mascot state="sad" size={110} />
      <View style={{ flexDirection: "row", gap: 4 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Icon key={i} name="heart-outline" size={22} color={PLAY.red} />
        ))}
      </View>
      <Display size="xl" weight={800} center>
        Brak serc
      </Display>
      <Body center color={COLORS.muted}>
        {hearts.nextInMs !== null ? `Kolejne serce za ${formatCountdown(hearts.nextInMs)}. Możesz poczekać, powtórzyć fiszki albo uzupełnić serca klejnotami.` : "Zaraz się odnowią."}
      </Body>
      <View style={{ alignSelf: "stretch", gap: SPACE[2], marginTop: SPACE[2] }}>
        <Button3D label={`Uzupełnij · ${GEM_COSTS.heartRefill}`} variant="blue" onPress={onRefill} disabled={!canAfford} right={<GemIcon size={16} color="#fff" />} />
        {!isPro ? <Button3D label="Pro — nieskończone serca" variant="purple" onPress={onPro} /> : null}
        <Button3D label="Poczekam" variant="ghost" onPress={onClose} />
      </View>
      <Muted size="xs" center>
        Masz {gems} 💎
      </Muted>
    </Sheet>
  );
}

/** Toast odznaki (góra ekranu, 3.2 s). */
export function AchievementToast({ achievement, onDone }: { achievement: Achievement; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone, achievement.key]);
  return (
    <Animated.View entering={FadeInUp.springify().damping(14)} exiting={FadeOutUp.duration(200)} style={[s.toast, { top: insets.top + SPACE[2] }]} pointerEvents="box-none">
      <Pressable onPress={onDone} style={s.toastBox}>
        <View style={s.toastIcon}>
          <Icon name={ACHIEVEMENT_ICON[achievement.icon] ?? "star"} size={24} color="#7A4E0A" />
        </View>
        <View style={{ flex: 1 }}>
          <Label color={PLAY.yellow}>odznaka odblokowana</Label>
          <Body weight={700} color={COLORS.text}>
            {achievement.title}
          </Body>
          <Muted size="xs" numberOfLines={1}>
            {achievement.desc}
          </Muted>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <GemIcon size={14} />
          <Body size="sm" weight={700} color={PLAY.gem}>
            +{achievement.gems}
          </Body>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Modal odznaki (po tapnięciu w siatce). */
export function AchievementModal({ achievement, unlocked, onClose }: { achievement: Achievement; unlocked: boolean; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} accent={unlocked ? PLAY.yellow : undefined}>
      <View style={[s.bigBadge, unlocked ? { backgroundColor: PLAY.yellow, borderBottomColor: PLAY.yellowDeep } : { backgroundColor: COLORS.bg3, borderBottomColor: PLAY.surfaceDeep }]}>
        <Icon name={unlocked ? (ACHIEVEMENT_ICON[achievement.icon] ?? "star") : "lock-closed"} size={40} color={unlocked ? "#7A4E0A" : COLORS.faint} />
      </View>
      <Display size="xl" weight={800} center>
        {achievement.title}
      </Display>
      <Body center color={COLORS.muted}>
        {achievement.desc}
      </Body>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <GemIcon size={16} />
        <Body weight={700} color={PLAY.gem}>
          {unlocked ? "zdobyte" : "nagroda"}: {achievement.gems} klejnotów
        </Body>
      </View>
      <Button3D label="OK" variant="ghost" onPress={onClose} style={{ alignSelf: "stretch", marginTop: SPACE[2] }} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(4,5,9,0.78)", alignItems: "center", justifyContent: "flex-end", padding: SPACE[4] },
  box: { alignSelf: "stretch", backgroundColor: COLORS.bg2, borderWidth: 1.5, borderRadius: RADIUS.xl, padding: SPACE[6], alignItems: "center", gap: SPACE[3], overflow: "hidden" },
  toast: { position: "absolute", left: SPACE[4], right: SPACE[4], zIndex: 200 },
  toastBox: { flexDirection: "row", alignItems: "center", gap: SPACE[3], backgroundColor: COLORS.bg3, borderWidth: 1.5, borderColor: PLAY.yellow, borderRadius: RADIUS.lg, padding: SPACE[3], shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  toastIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: PLAY.yellow, alignItems: "center", justifyContent: "center", borderBottomWidth: 4, borderBottomColor: PLAY.yellowDeep },
  bigBadge: { width: 96, height: 96, borderRadius: 28, alignItems: "center", justifyContent: "center", borderBottomWidth: 6 },
});
