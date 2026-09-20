import { useRouter } from "expo-router";
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glow } from "@/components/Accent";
import { SubjectCard } from "@/components/SubjectCard";
import { Body, Display, Label, Muted, Title } from "@/components/Text";
import { Button, MiniPill, SectionHead, StatPill, TopBar, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { dni } from "@/lib/plural";
import { COLORS, RADIUS, SPACE, UI, hueFrom, shadowCard, tabular } from "@/lib/theme";

/** Home „Przedmioty”: streak/XP, karta „Dziś”, siatka przedmiotów, „+ przedmiot”. */
export default function Home() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const d = app.daily;
  const hasSession = d.items.length > 0;
  const sessionSubject = d.newLevel ? app.findSubject(app.findTopic(d.newLevel.topicId)?.subjectId ?? "") : app.subjects[0];
  const hue = hueFrom(sessionSubject?.accent2, sessionSubject?.name);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
      <TopBar
        title={
          <View style={s.logo}>
            <View style={s.logoMark} />
            <Display size="md" weight={800} style={{ letterSpacing: 2 }}>
              Recall
            </Display>
          </View>
        }
        right={
          <>
            <StatPill kind="streak" value={app.streak} unit={dni(app.streak)} />
            <StatPill kind="xp" value={app.totalXp} unit="xp" />
          </>
        }
      />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 110 + insets.bottom }]} refreshControl={<RefreshControl refreshing={app.refreshing} onRefresh={app.refresh} tintColor={COLORS.accent} />} showsVerticalScrollIndicator={false}>
        <Touch onPress={() => router.push("/(tabs)/today")} style={s.today}>
          <View style={s.hl} />
          <Glow color={hue.color} size={360} alpha={0.16} style={{ top: -170, right: -110 }} />
          <Label>dziś · ~{d.minutes} min</Label>
          <Display size="xl" weight={700} style={{ marginTop: SPACE[2] }}>
            {hasSession ? (d.newLevel ? d.newLevel.title : "Powtórka na dziś") : "Dodaj pierwszy temat"}
          </Display>
          <Body color={COLORS.muted} style={{ marginTop: 4 }}>
            {hasSession ? "Powtórki, słabe pytania i jeden nowy poziom." : "Ułożę Ci sesję, gdy pojawi się pierwszy temat."}
          </Body>
          {hasSession ? (
            <View style={s.metrics}>
              <MiniPill value={d.reviewCount} label="powtórki" />
              <MiniPill value={d.weakCount} label="słabe" />
              <MiniPill value={d.newLevel ? 1 : 0} label="nowy" />
            </View>
          ) : null}
          <Button label={hasSession ? "Start" : "Zobacz"} onPress={() => router.push("/(tabs)/today")} style={{ marginTop: SPACE[5] }} />
        </Touch>

        {app.offline ? (
          <Muted size="xs" center style={{ marginBottom: SPACE[3] }}>
            offline — pokazuję zapisane dane
          </Muted>
        ) : null}

        <SectionHead label="przedmioty" right={<Muted size="xs" style={tabular}>{app.subjects.length}</Muted>} />
        <View style={s.grid}>
          {app.subjects.map((sub) => (
            <SubjectCard key={sub.id} subject={sub} onPress={() => router.push({ pathname: "/s/[subjectId]", params: { subjectId: sub.id } })} />
          ))}
          <Touch onPress={() => router.push("/onboarding-add")} style={s.addcard}>
            <View style={s.plus}>
              <Title size="lg" color={COLORS.muted}>
                +
              </Title>
            </View>
            <Muted size="sm" weight={600}>
              przedmiot
            </Muted>
          </Touch>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  logo: { flexDirection: "row", alignItems: "center", gap: SPACE[2] },
  logoMark: { width: 10, height: 10, borderRadius: 3, backgroundColor: COLORS.accent },
  scroll: { paddingHorizontal: UI.gutter, paddingTop: SPACE[2] },
  today: { backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.xl, padding: SPACE[6], marginBottom: SPACE[6], overflow: "hidden", ...shadowCard },
  hl: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: COLORS.highlight, zIndex: 2 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: SPACE[2], marginTop: SPACE[4] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE[3] },
  addcard: { flexBasis: "47%", flexGrow: 1, minHeight: 164, borderWidth: 1, borderStyle: "dashed", borderColor: COLORS.lineStrong, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", gap: SPACE[2] },
  plus: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center" },
});
