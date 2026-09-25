import { untilMidnight, type Quest, type QuestKind } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Bar, Motion } from "@/components/Motion";
import { Body, Eyebrow, Muted } from "@/components/Text";
import { Blob, Btn, Note, Pill, Press, Screen, TopBar, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { T, TONES, type Tone } from "@/lib/theme";

const KIND: Record<QuestKind, { icon: string; tone: Tone }> = {
  xp: { icon: "bolt", tone: "acid" },
  combo: { icon: "star", tone: "pink" },
  review: { icon: "refresh", tone: "cyan" },
  levels: { icon: "check", tone: "acid" },
  perfect: { icon: "clock", tone: "gold" },
  games: { icon: "grid", tone: "amber" },
  minutes: { icon: "clock", tone: "cyan" },
  correct: { icon: "check", tone: "pink" },
};

/** Misje (Missions.html): 3 dzienne z puli (deterministycznie z dnia) + 1 tygodniowa; „Odbierz” płaci gemy (`claimQuest`). */
export default function Missions() {
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  return (
    <Screen scroll pad={false} bottom={26} blob={<Blob tone="gold" size={260} top={-110} right={-80} />}>
      <View style={[s.wrap, { paddingTop: top }]}>
        <TopBar title="Misje" onBack={back} right={<Pill kind="gems" value={app.gems} onPress={() => router.push("/shop")} />} />
        <Motion kind="up" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Eyebrow>Dzienne</Eyebrow>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="clock" size={14} stroke={2.6} color={T.muted} />
            <Motion kind="blink">
              <Body size={12} weight={800} color={T.muted}>
                {untilMidnight().text}
              </Body>
            </Motion>
          </View>
        </Motion>
        <View style={{ gap: 11 }}>
          {app.quests.map((q, i) => (
            <QuestRow key={q.id} q={q} d={i + 1} onClaim={() => app.claimQuest(q.id)} />
          ))}
        </View>
        <Eyebrow>Tygodniowa</Eyebrow>
        <QuestRow q={app.weeklyQuest} d={4} weekly onClaim={() => app.claimQuest(app.weeklyQuest.id)} />
        <Motion kind="up" d={5}>
          <Note dashed icon="info" text="Misje odświeżają się o północy, niedokończone przepadają. Tygodniowa trwa do niedzieli." />
        </Motion>
        <Btn label="Dokończ misje" glow onPress={back} style={{ marginTop: 4 }} />
      </View>
    </Screen>
  );
}

function QuestRow({ q, d, weekly, onClaim }: { q: Quest; d: number; weekly?: boolean; onClaim: () => void }) {
  const k = KIND[q.kind] ?? KIND.xp;
  const set = TONES[weekly ? "gold" : k.tone];
  const ready = q.done && !q.claimed;
  const done = q.claimed;
  const pct = Math.round(Math.min(1, q.progress / Math.max(1, q.target)) * 100);
  const tinted = done || ready || weekly;
  return (
    <Motion kind={done ? "pop" : "up"} d={d}>
      <View style={[s.row, tinted ? { backgroundColor: set.tint, borderColor: set.tintLine, shadowColor: set.tintShadow } : null, weekly && { borderRadius: 24, padding: 16 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
          <Motion kind={done ? "pop" : weekly ? "sway" : "none"}>
            <View style={[s.ico, { width: weekly ? 54 : 46, height: weekly ? 54 : 46, borderRadius: weekly ? 17 : 15, backgroundColor: tinted ? set.color : set.tint }]}>
              <Icon name={done ? "check" : k.icon} size={weekly ? 28 : 24} stroke={done ? 3.4 : 2.6} color={tinted ? set.on : set.color} />
            </View>
          </Motion>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Body size={weekly ? 15 : 14} weight={800} color={tinted ? set.txt : T.txt}>
              {q.title}
            </Body>
            <Muted size={weekly ? 12.5 : 12} weight={700} color={tinted ? set.sub : T.muted} style={{ marginTop: 3 }}>
              {done ? "zrobione" : q.target > 1 ? `${q.progress} z ${q.target}` : ready ? "gotowe — odbierz nagrodę" : "jeszcze nie"}
              {weekly && !done ? " · duża nagroda" : ""}
            </Muted>
          </View>
          {ready ? (
            <Motion kind="pop">
              <Press onPress={onClaim} drop={4} edge={T.acidDark} radius={14} faceStyle={s.claim} accessibilityLabel={`Odbierz nagrodę: ${q.reward} gemów`}>
                <Body size={13} weight={800} color={T.onAcid}>
                  Odbierz
                </Body>
              </Press>
            </Motion>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="gem" size={15} color={T.cyan} />
              <Body size={13} weight={800} color="#7EE8FA">
                {q.reward}
              </Body>
            </View>
          )}
        </View>
        {!done ? <Bar pct={pct} color={set.color} height={weekly ? 12 : 10} track={weekly ? "#1A1409" : T.line2} d={d} style={{ marginTop: 12 }} /> : null}
      </View>
    </Motion>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 16 },
  row: { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 22, padding: 14, shadowColor: T.shadow, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 } },
  ico: { alignItems: "center", justifyContent: "center" },
  claim: { backgroundColor: T.acid, paddingVertical: 10, paddingHorizontal: 14 },
});
