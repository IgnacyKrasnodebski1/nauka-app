import { DAILY_GOALS, type DailyGoal } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Display, Muted } from "@/components/Text";
import { Blob, Btn, Card, IconTile, Press, Screen, Toggle, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { T, TONES } from "@/lib/theme";
import { StepBar } from "./onboarding";

const GOAL_ROWS: { xp: DailyGoal; t: string; mins: string }[] = [
  { xp: 20, t: "Spokojnie", mins: "5 minut" },
  { xp: 50, t: "Normalnie", mins: "10 minut" },
  { xp: 100, t: "Solidnie", mins: "15 minut" },
];

/** Onboarding (Onboarding.html): cel dzienny XP (`DAILY_GOALS`) + przypomnienie. `?from=first` → Dziś, inaczej wraca. */
export default function GoalScreen() {
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const first = from === "first";
  const [goal, setGoal] = useState<DailyGoal>(app.dailyGoal);
  const [remOn, setRemOn] = useState(app.extra.reminder?.on ?? false);
  const at = app.extra.reminder?.at ?? "19:30";
  const save = () => {
    app.setDailyGoal(goal);
    app.setReminder({ on: remOn, at });
    app.showToast(`Cel dzienny: ${goal} XP`, "bolt");
    if (first) router.replace(app.subjects.length ? "/(tabs)" : "/empty");
    else router.back();
  };
  return (
    <Screen scroll pad={false} blob={<Blob tone="acid" size={280} top={-90} left={-80} />}>
      <View style={[s.wrap, { paddingTop: top }]}>
        <StepBar step={3} />
        <Motion kind="up">
          <Display size={30} ls={-1} lh={33}>
            Ile czasu dziennie?
          </Display>
          <Muted size={13.5} lh={20} style={{ marginTop: 8 }}>
            Cel możesz zmienić w każdej chwili. Lepiej zacząć niżej i utrzymać serię.
          </Muted>
        </Motion>
        <View style={{ gap: 11 }}>
          {GOAL_ROWS.filter((g) => DAILY_GOALS.includes(g.xp)).map((g, i) => {
            const on = goal === g.xp;
            return (
              <Motion key={g.xp} kind={on ? "pop" : "up"} d={on ? 0 : i + 1}>
                <Press onPress={() => setGoal(g.xp)} drop={4} edge={on ? T.acid : T.shadow} radius={20} faceStyle={[s.opt, on ? { backgroundColor: TONES.acid.tint, borderColor: T.acid } : { backgroundColor: T.surface, borderColor: T.line }]} accessibilityLabel={`${g.t}: ${g.mins}, ${g.xp} XP`}>
                  <View style={{ width: 10, height: 34, borderRadius: 5, backgroundColor: on ? T.acid : T.dash }} />
                  <View style={{ flex: 1 }}>
                    <Body size={15} weight={800} color={on ? TONES.acid.txt : T.txt}>
                      {g.t}
                    </Body>
                    <Muted size={12.5} color={on ? TONES.acid.sub : T.muted} style={{ marginTop: 2 }}>
                      {g.mins} · {g.xp} XP
                    </Muted>
                  </View>
                  <View style={[s.ck, on && { backgroundColor: T.acid, borderColor: T.acid }]}>{on ? <Icon name="check" size={14} stroke={4} color={T.onAcid} /> : null}</View>
                </Press>
              </Motion>
            );
          })}
        </View>
        <Motion kind="up" d={5}>
          <Card padding={16}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
              <IconTile icon="bell" size={44} color={T.line2} on={T.txt} stroke={2.4} />
              <View style={{ flex: 1 }}>
                <Body size={14} weight={800}>
                  Przypomnienie
                </Body>
                <Muted size={12.5} style={{ marginTop: 2 }}>
                  codziennie o {at} · wymaga aplikacji mobilnej
                </Muted>
              </View>
              <Toggle value={remOn} onChange={setRemOn} label="Przypomnienie" />
            </View>
          </Card>
        </Motion>
        <Motion kind="up" d={6}>
          <View style={s.note}>
            <Motion kind="beat">
              <Icon name="flame" size={26} color={T.flame} />
            </Motion>
            <Body size={13} weight={700} color={TONES.amber.txt} lh={18} style={{ flex: 1 }}>
              Seria rośnie każdego dnia, w którym dobijesz cel.
            </Body>
          </View>
        </Motion>
        <View style={{ gap: 10, marginTop: 6 }}>
          <Btn label={first ? "Ustaw cel" : "Zapisz cel"} onPress={save} glow />
          {!first ? <Btn label="Wróć bez zmian" variant="text" onPress={() => router.back()} /> : null}
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, gap: 20 },
  opt: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 15, paddingHorizontal: 16, borderWidth: 2 },
  ck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: T.dash, alignItems: "center", justifyContent: "center" },
  note: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: TONES.amber.tint, borderWidth: 2, borderColor: TONES.amber.tintLine, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16 },
});
