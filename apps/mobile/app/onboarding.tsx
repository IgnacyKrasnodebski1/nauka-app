import type { Stage } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Display, Eyebrow, Muted } from "@/components/Text";
import { Blob, Btn, IconTile, Press, Screen, Touch, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import type { Goal } from "@/lib/extra";
import { T, TONES, type Tone } from "@/lib/theme";

export const LEVELS: { id: Stage; t: string; s: string; icon: IconName; tone: Tone }[] = [
  { id: "podstawowa", t: "Szkoła podstawowa", s: "klasy 4–8", icon: "edit", tone: "gold" },
  { id: "liceum", t: "Liceum lub technikum", s: "klasy 1–5", icon: "book", tone: "acid" },
  { id: "studia", t: "Studia", s: "licencjat, magisterka", icon: "cap", tone: "pink" },
  { id: "inne", t: "Coś innego", s: "języki, kursy, certyfikaty", icon: "globe", tone: "cyan" },
];
export const GOALS: { id: Goal; t: string; for: Stage[] }[] = [
  { id: "sprawdziany", t: "Kartkówki i sprawdziany", for: ["podstawowa", "liceum", "inne"] },
  { id: "matura-p", t: "Matura podstawowa", for: ["liceum"] },
  { id: "matura-r", t: "Matura rozszerzona", for: ["liceum"] },
  { id: "olimpiada", t: "Olimpiada", for: ["podstawowa", "liceum"] },
  { id: "sesja", t: "Sesja i kolokwia", for: ["studia"] },
  { id: "wlasny", t: "Własny cel", for: ["podstawowa", "liceum", "studia", "inne"] },
];
export const GOAL_DEFAULT: Record<Stage, Goal> = { podstawowa: "sprawdziany", liceum: "matura-r", studia: "sesja", inne: "wlasny" };
export const GOAL_NAME: Record<Goal, string> = { sprawdziany: "kartkówki i sprawdziany", "matura-p": "matura podstawowa", "matura-r": "matura rozszerzona", olimpiada: "olimpiada", sesja: "sesja i kolokwia", wlasny: "własny cel" };

/** Pasek kroków onboardingu (4 segmenty, bieżący mruga). */
export function StepBar({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {Array.from({ length: total }, (_, i) => {
        const seg = <View style={{ flex: 1, height: 7, borderRadius: 4, backgroundColor: i < step ? T.acid : T.line2 }} />;
        return i === step - 1 ? (
          <Motion key={i} kind="blink" style={{ flex: 1 }}>
            {seg}
          </Motion>
        ) : (
          <View key={i} style={{ flex: 1 }}>
            {seg}
          </View>
        );
      })}
    </View>
  );
}

/** LevelPick (LevelPick.html): etap nauki + cel (kartkówki / matura / olimpiada / sesja / własny). `?from=settings` wraca do Ustawień. */
export default function LevelPick() {
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const first = from !== "settings";
  const [level, setLevel] = useState<Stage | null>(app.stage);
  const [goal, setGoal] = useState<Goal | null>(app.extra.goal);
  const goals = GOALS.filter((g) => !level || g.for.includes(level));
  const pick = (id: Stage) => {
    setLevel(id);
    if (!goal || !GOALS.find((g) => g.id === goal)!.for.includes(id)) setGoal(GOAL_DEFAULT[id]);
  };
  const next = () => {
    if (!level) return;
    app.setStage(level);
    app.setGoal(goal ?? GOAL_DEFAULT[level]);
    if (first) router.push({ pathname: "/goal", params: { from: "first" } });
    else {
      app.showToast("Zapisane: " + LEVELS.find((l) => l.id === level)!.t, "check");
      router.back();
    }
  };
  return (
    <Screen scroll pad={false} blob={<Blob tone="acid" size={280} top={-100} right={-90} />}>
      <View style={[s.wrap, { paddingTop: top }]}>
        <StepBar step={2} />
        <Motion kind="up" style={{ marginTop: 8 }}>
          <Display size={30} ls={-1} lh={33}>
            Na jakim etapie jesteś?
          </Display>
          <Muted size={13.5} lh={20} style={{ marginTop: 7 }}>
            Dopasujemy poziom trudności, język wyjaśnień i gotowe przedmioty.
          </Muted>
        </Motion>
        <View style={{ gap: 10 }}>
          {LEVELS.map((l, i) => {
            const on = level === l.id;
            const set = TONES[l.tone];
            return (
              <Motion key={l.id} kind={on ? "pop" : "up"} d={on ? 0 : i + 1}>
                <Press onPress={() => pick(l.id)} drop={4} edge={on ? T.acidDark : T.shadow} radius={22} faceStyle={[s.opt, on ? { backgroundColor: TONES.acid.tint, borderColor: T.acid } : { backgroundColor: T.surface, borderColor: T.line }]} accessibilityLabel={l.t}>
                  <IconTile icon={l.icon} size={48} color={on ? T.acid : set.color} on={on ? T.onAcid : set.on} />
                  <View style={{ flex: 1 }}>
                    <Body size={15.5} weight={800} color={on ? TONES.acid.txt : T.txt}>
                      {l.t}
                    </Body>
                    <Muted size={12.5} color={on ? TONES.acid.sub : T.muted} style={{ marginTop: 2 }}>
                      {l.s}
                    </Muted>
                  </View>
                  <View style={[s.ck, on && { backgroundColor: T.acid, borderColor: T.acid }]}>{on ? <Icon name="check" size={15} stroke={4} color={T.onAcid} /> : null}</View>
                </Press>
              </Motion>
            );
          })}
        </View>
        <Eyebrow style={{ marginTop: 4 }}>Do czego się przygotowujesz?</Eyebrow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
          {goals.map((g, i) => {
            const on = goal === g.id;
            return (
              <Motion key={g.id} kind={on ? "pop" : "up"} d={on ? 0 : Math.min(6, i + 3)}>
                <Touch onPress={() => setGoal(g.id)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.chip, on && { backgroundColor: T.acid, borderColor: T.acid }]}>
                  <Body size={13} weight={800} color={on ? T.onAcid : T.txt2}>
                    {g.t}
                  </Body>
                </Touch>
              </Motion>
            );
          })}
        </View>
        <View style={{ gap: 10, marginTop: 8 }}>
          <Btn label={first ? "Dalej" : "Zapisz"} onPress={next} disabled={!level} glow />
          {!first ? <Btn label="Wróć bez zmian" variant="text" onPress={() => router.back()} /> : null}
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, gap: 13 },
  opt: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, paddingHorizontal: 15, borderWidth: 2 },
  ck: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: T.dash, alignItems: "center", justifyContent: "center" },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line },
});
