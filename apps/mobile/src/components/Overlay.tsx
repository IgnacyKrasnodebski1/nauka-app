import type { Achievement, Rank } from "@nauka/shared";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/lib/app-state";
import { play } from "@/lib/sfx";
import { T, TONES } from "@/lib/theme";
import { Icon } from "./Icon";
import { Motion } from "./Motion";
import { Body, Display, Eyebrow, Muted } from "./Text";
import { Btn, Sheet, Toast } from "./ui";

/** Odznaka (`toast .a-pop` z legacy): górny pasek z ikoną i nazwą, znika po 2,6 s. */
function AchievementToast({ a, onDone }: { a: Achievement; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <View pointerEvents="none" style={[s.top, { top: insets.top + 10 }]}>
      <Motion kind="pop" style={s.ach}>
        <View style={s.achIco}>
          <Icon name={a.icon} size={22} stroke={2.6} color={T.onGold} />
        </View>
        <View style={{ flex: 1 }}>
          <Eyebrow size={10.5} color={TONES.gold.txt}>
            Odznaka
          </Eyebrow>
          <Body size={14} weight={800}>
            {a.title}
          </Body>
          <Muted size={11.5}>
            {a.desc} · +{a.gems} gemów
          </Muted>
        </View>
      </Motion>
    </View>
  );
}

/** Awans rangi: arkusz z nazwą rangi w jej kolorze. */
function LevelUpSheet({ rank, onClose }: { rank: Rank; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} bg={T.surface2}>
      <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
        <Motion kind="pop">
          <View style={[s.rankIco, { backgroundColor: rank.color }]}>
            <Icon name="trophy" size={34} stroke={2.4} color={T.bg} />
          </View>
        </Motion>
        <Eyebrow color={rank.color}>Nowa ranga</Eyebrow>
        <Display size={32} color={rank.color} center>
          {rank.name}
        </Display>
        <Muted center>{rank.next ? `Następna od ${rank.next} XP` : "Najwyższa ranga"}</Muted>
      </View>
      <Btn label="Dalej" onPress={onClose} />
    </Sheet>
  );
}

/** Globalny overlay: toast, odznaki, awanse rangi + dźwięki. */
export function Overlay() {
  const app = useApp();
  const rank = app.levelUpQueue[0];
  const ach = app.unlockedQueue[0];
  useEffect(() => {
    if (rank) play("levelup");
  }, [rank]);
  useEffect(() => {
    if (ach) play("gem");
  }, [ach]);
  return (
    <>
      <Toast text={app.toast} icon={app.toastIcon ?? undefined} tone={toneOf(app.toastIcon)} />
      {ach ? <AchievementToast a={ach} onDone={app.popUnlocked} /> : null}
      {rank ? <LevelUpSheet rank={rank} onClose={app.popLevelUp} /> : null}
    </>
  );
}

function toneOf(icon: string | null): "acid" | "red" | "gold" | "cyan" | "amber" | "violet" | "pink" {
  switch (icon) {
    case "flame":
      return "amber";
    case "close":
    case "x-circle":
    case "alert":
    case "heart":
      return "red";
    case "gem":
    case "snow":
    case "cards":
    case "refresh":
    case "clock":
    case "wifi":
    case "info":
      return "cyan";
    case "trophy":
    case "bolt":
    case "star":
    case "chest":
    case "calendar":
      return "gold";
    case "boss":
    case "palette":
      return "violet";
    default:
      return "acid";
  }
}

const s = StyleSheet.create({
  top: { position: "absolute", left: 18, right: 18, zIndex: 100 },
  ach: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: TONES.gold.tint, borderWidth: 2, borderColor: T.gold, borderRadius: 20, padding: 12 },
  achIco: { width: 44, height: 44, borderRadius: 14, backgroundColor: T.gold, alignItems: "center", justifyContent: "center" },
  rankIco: { width: 84, height: 84, borderRadius: 28, alignItems: "center", justifyContent: "center" },
});
