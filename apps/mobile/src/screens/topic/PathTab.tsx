import { subjectCompletion, unlockedIndex, type Topic } from "@nauka/shared";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useHue } from "@/components/Accent";
import { Button3D } from "@/components/Button3D";
import { Icon } from "@/components/Icon";
import { Ring } from "@/components/Ring";
import { Body, Display, Label, Muted, Num } from "@/components/Text";
import { WindingPath } from "@/components/WindingPath";
import { useApp } from "@/lib/app-state";
import { COLORS, PLAY, RADIUS, SPACE, UI, tabular } from "@/lib/theme";

/** Ścieżka tematu: baner jednostki (kolor przedmiotu, ring, Kontynuuj 3D) + wijąca się ścieżka SVG. */
export function PathTab({ topic }: { topic: Topic }) {
  const app = useApp();
  const router = useRouter();
  const hue = useHue();
  const p = app.progressFor(topic.id);
  const { done, total, pct } = subjectCompletion(topic, p);
  const activeIdx = unlockedIndex(topic, p);
  const active = topic.levels[activeIdx];
  const allDone = done === total && total > 0;
  const open = (levelId: string) => {
    if (!app.canStartLesson) {
      app.showToast("Brak serc — poczekaj albo uzupełnij klejnotami");
      // lekcja sama pokaże modal braku serc
    }
    router.push({ pathname: "/t/[topicId]/l/[levelId]", params: { topicId: topic.id, levelId } });
  };
  const header = (
    <View style={s.wrap}>
      <View style={[s.banner, { backgroundColor: hue.color, borderBottomColor: hue.deep }]}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Label color="rgba(255,255,255,0.8)">
            {allDone ? "temat ukończony" : `jednostka ${activeIdx + 1} z ${total}`}
          </Label>
          <Display size="lg" weight={800} color="#fff" numberOfLines={2}>
            {allDone ? "Wszystko zaliczone" : (active?.title ?? topic.name)}
          </Display>
          <Body size="sm" color="rgba(255,255,255,0.85)" style={tabular}>
            {done}/{total} poziomów · {p.xp} XP
          </Body>
        </View>
        <Ring pct={pct} size={64} stroke={7} color="#fff" track="rgba(0,0,0,0.25)">
          <Num size="sm" weight={800} color="#fff" style={[tabular, { fontSize: 14 }]}>
            {pct}%
          </Num>
        </Ring>
      </View>
      <View style={s.ctaRow}>
        <Button3D label={allDone ? "Powtórz od nowa" : done === 0 ? "Start" : "Kontynuuj"} variant={allDone ? "blue" : "green"} onPress={() => active && open(active.id)} style={{ flex: 1 }} right={<Icon name="play" size={16} color="#fff" />} />
      </View>
      <View style={s.legend}>
        <Legend color={hue.color} icon="checkmark" label="zrobione" />
        <Legend color={PLAY.yellow} icon="gift" label="skrzynka co 3" />
        <Legend color={PLAY.yellow} icon="trophy" label="trofeum" />
      </View>
    </View>
  );
  return (
    <WindingPath
      topic={topic}
      progress={p}
      header={header}
      onOpen={open}
      onLocked={() => app.showToast("Najpierw zalicz poprzedni poziom")}
      onChest={(idx) => {
        const g = app.openChest(topic.id, idx);
        if (g) app.showToast(`Skrzynka: +${g} klejnotów`);
        return g;
      }}
      onTrophy={() => {
        const g = app.claimTrophy(topic.id);
        if (g) app.showToast(`Trofeum zdobyte: +${g} klejnotów`);
        return g;
      }}
      footer={
        <Muted size="xs" center style={{ marginTop: SPACE[4] }}>
          {topic.levels.length} poziomów · {topic.levels.reduce((a, l) => a + l.quiz.length, 0)} pytań · {topic.levels.reduce((a, l) => a + l.flashcards.length, 0)} fiszek
        </Muted>
      }
    />
  );
}

function Legend({ color, icon, label }: { color: string; icon: React.ComponentProps<typeof Icon>["name"]; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={11} color={COLORS.bg0} />
      </View>
      <Muted size="xs" weight={600}>
        {label}
      </Muted>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: UI.gutter, gap: SPACE[3], paddingBottom: SPACE[2] },
  banner: { flexDirection: "row", alignItems: "center", gap: SPACE[4], borderRadius: RADIUS.lg, padding: SPACE[4], borderBottomWidth: 5 },
  ctaRow: { flexDirection: "row", gap: SPACE[2] },
  legend: { flexDirection: "row", justifyContent: "center", gap: SPACE[4], flexWrap: "wrap" },
});
