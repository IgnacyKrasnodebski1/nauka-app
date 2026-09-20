import { MASCOT_LINES, type MascotState, type LeaderboardRow } from "@nauka/shared";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button3D, Tile3D } from "@/components/Button3D";
import { Leaderboard, QuestsCard, StreakCalendar } from "@/components/Gamification";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { Mascot, MascotBubble } from "@/components/Mascot";
import { GemsPill, HeartsPill, StreakPill } from "@/components/Pills";
import { DailyGoalRing, Ring } from "@/components/Ring";
import { examBadgeShort, examCountdown, subjectStats } from "@/components/SubjectCard";
import { Body, Display, Label, Muted, Num, Title } from "@/components/Text";
import { SectionHead, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { pl } from "@/lib/plural";
import { COLORS, PLAY, RADIUS, SPACE, UI, hueFrom, tabular } from "@/lib/theme";

/** Home „Start”: TopBar z logo i pillami, ring celu + maskotka, karta „Dziś” 3D, misje, kafle przedmiotów, ranking, seria. */
export default function Home() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const d = app.daily;
  const hasSession = d.items.length > 0;
  const sessionSubject = d.newLevel ? app.findSubject(app.findTopic(d.newLevel.topicId)?.subjectId ?? "") : app.subjects[0];
  const hue = hueFrom(sessionSubject?.accent2, sessionSubject?.name);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const dayIdx = useMemo(() => new Date().getDate(), []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      app
        .fetchLeaderboard(3)
        .then((rows) => alive && setBoard(rows))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [app.fetchLeaderboard, app.tick]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const mascotState: MascotState = app.goalMet ? "cheer" : app.streakAtRisk ? "sleep" : "idle";
  const line = app.goalMet ? "Cel dnia zrobiony. Jesteś w formie!" : app.streakAtRisk ? MASCOT_LINES.sleep[dayIdx % 2]! : hasSession ? MASCOT_LINES.idle[dayIdx % 3]! : "Dodaj pierwszy temat, a ułożę Ci plan.";

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
      <View style={[s.top, { paddingTop: insets.top + SPACE[2] }]}>
        <Logo size={30} />
        <View style={s.pills}>
          <StreakPill streak={app.streak} compact />
          <GemsPill gems={app.gems} compact />
          <HeartsPill hearts={app.hearts} compact />
        </View>
      </View>
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 110 + insets.bottom }]} refreshControl={<RefreshControl refreshing={app.refreshing} onRefresh={app.refresh} tintColor={PLAY.green} />} showsVerticalScrollIndicator={false}>
        {/* cel dzienny + maskotka */}
        <Animated.View entering={FadeInDown.duration(300)} style={s.hero}>
          <DailyGoalRing xp={app.todayXp} goal={app.dailyGoal} size={104} />
          <View style={{ flex: 1, gap: SPACE[2] }}>
            <MascotBubble state={mascotState} text={line} tail="left" style={{ maxWidth: undefined }} />
            <Muted size="xs" weight={600}>
              cel dzienny {app.dailyGoal} XP · {app.rank.name} · {app.totalXp} XP łącznie
            </Muted>
          </View>
          <Mascot state={mascotState} size={88} streak={app.streak} />
        </Animated.View>

        {/* karta „Dziś” */}
        <Animated.View entering={FadeInDown.delay(60).duration(300)}>
          <Tile3D color={hue.color} deep={hue.deep} onPress={() => router.push("/(tabs)/today")} style={{ marginBottom: SPACE[4] }} faceStyle={s.today}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE[3] }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Label color="rgba(255,255,255,0.85)">dzienna misja · ~{d.minutes} min</Label>
                <Display size="xl" weight={800} color="#fff" numberOfLines={2}>
                  {hasSession ? (d.newLevel ? d.newLevel.title : "Powtórka na dziś") : "Dodaj pierwszy temat"}
                </Display>
                <Body size="sm" color="rgba(255,255,255,0.9)">
                  {hasSession ? `${pl(d.reviewCount, "powtórka", "powtórki", "powtórek")} · ${pl(d.weakCount, "słabe pytanie", "słabe pytania", "słabych pytań")}${d.newLevel ? " · nowy poziom" : ""}` : "Ułożę Ci sesję, gdy pojawi się pierwszy temat."}
                </Body>
              </View>
              <View style={s.todayIcon}>
                <Icon name="rocket" size={30} color="#fff" />
              </View>
            </View>
            <Button3D label={hasSession ? "Start" : "Zobacz"} variant="ghost" color="#fff" deep="#C9CCDA" textColor={hue.deep} onPress={() => router.push("/(tabs)/today")} style={{ marginTop: SPACE[4] }} right={<Icon name="play" size={16} color={hue.deep} />} />
          </Tile3D>
        </Animated.View>

        {app.offline ? (
          <Muted size="xs" center style={{ marginBottom: SPACE[3] }}>
            offline — pokazuję zapisane dane
          </Muted>
        ) : null}

        {/* misje */}
        <Animated.View entering={FadeInDown.delay(120).duration(300)}>
          <QuestsCard quests={app.quests} onClaim={app.claimQuest} style={{ marginBottom: SPACE[5] }} />
        </Animated.View>

        {/* przedmioty */}
        <SectionHead
          label="przedmioty"
          right={
            <Touch onPress={() => router.push("/onboarding-add")} style={s.addBtn}>
              <Icon name="add" size={16} color={PLAY.green} />
              <Muted size="xs" weight={700} color={PLAY.green}>
                dodaj
              </Muted>
            </Touch>
          }
        />
        <View style={s.grid}>
          {app.subjects.map((sub, i) => (
            <Animated.View key={sub.id} entering={FadeInDown.delay(160 + i * 60).duration(300)} style={s.cell}>
              <SubjectTile subject={sub} onPress={() => router.push({ pathname: "/s/[subjectId]", params: { subjectId: sub.id } })} />
            </Animated.View>
          ))}
          <Animated.View entering={FadeInDown.delay(160 + app.subjects.length * 60).duration(300)} style={s.cell}>
            <Touch onPress={() => router.push("/onboarding-add")} style={s.addcard}>
              <View style={s.plus}>
                <Icon name="add" size={26} color={COLORS.muted} />
              </View>
              <Muted size="sm" weight={700}>
                nowy przedmiot
              </Muted>
            </Touch>
          </Animated.View>
        </View>

        {/* ranking */}
        <SectionHead
          label="ranking tygodnia"
          right={
            <Touch onPress={() => router.push("/(tabs)/ranking")} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Muted size="xs" weight={700} color={PLAY.blue}>
                cały
              </Muted>
              <Icon name="chevron-forward" size={14} color={PLAY.blue} />
            </Touch>
          }
          style={{ marginTop: SPACE[5] }}
        />
        <View style={s.board}>
          <Leaderboard rows={board} compact />
        </View>

        {/* seria */}
        <StreakCalendar week={app.week} streak={app.streak} style={{ marginTop: SPACE[4] }} />
      </ScrollView>
    </View>
  );
}

/** Kafel przedmiotu: hue.soft tło + deep krawędź, emoji 40, nazwa, tematy, mini-ring %, badge sprawdzianu. */
function SubjectTile({ subject, onPress }: { subject: Parameters<typeof examCountdown>[0] & { id: string; name: string; emoji: string; accent2: string }; onPress: () => void }) {
  const app = useApp();
  const st = subjectStats(app.topicsOf(subject.id), app.progressFor);
  const hue = hueFrom(subject.accent2, subject.name);
  const days = examCountdown(subject);
  return (
    <Tile3D color={hue.soft} deep={hue.deep} onPress={onPress} faceStyle={[s.tile, { borderColor: hue.ring }]} accessibilityLabel={subject.name}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Display size="3xl" weight={700} style={{ lineHeight: 44 }}>
          {subject.emoji}
        </Display>
        <Ring pct={st.pct} size={40} stroke={5} color={hue.color}>
          <Num size="xs" weight={800} color={COLORS.text} style={[tabular, { fontSize: 10 }]}>
            {st.pct}%
          </Num>
        </Ring>
      </View>
      <Title size="md" numberOfLines={2} style={{ marginTop: SPACE[2] }}>
        {subject.name}
      </Title>
      <Muted size="xs" weight={600} style={[tabular, { marginTop: 2 }]}>
        {st.topics === 0 ? "pusto — dodaj temat" : `${pl(st.topics, "temat", "tematy", "tematów")} · ${st.done}/${st.total} lvl`}
      </Muted>
      {days !== null ? (
        <View style={[s.badge, days <= 2 ? { backgroundColor: PLAY.red } : { backgroundColor: hue.color }]}>
          <Icon name="alarm" size={11} color="#fff" />
          <Muted size="xs" weight={700} color="#fff" numberOfLines={1} style={{ fontSize: 10 }}>
            {examBadgeShort(days)}
          </Muted>
        </View>
      ) : null}
    </Tile3D>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: UI.gutter, paddingBottom: SPACE[3], backgroundColor: COLORS.bg0 },
  pills: { flexDirection: "row", alignItems: "center", gap: 6 },
  scroll: { paddingHorizontal: UI.gutter, paddingTop: SPACE[2] },
  hero: { flexDirection: "row", alignItems: "center", gap: SPACE[3], marginBottom: SPACE[4] },
  today: { padding: SPACE[5] },
  todayIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 4, paddingHorizontal: 8, borderRadius: RADIUS.pill, backgroundColor: PLAY.greenSoft },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE[3] },
  cell: { width: "47.5%", flexGrow: 1 },
  tile: { padding: SPACE[4], minHeight: 156, borderWidth: 1 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 3, paddingHorizontal: 8, borderRadius: RADIUS.pill, marginTop: SPACE[2] },
  addcard: { minHeight: 156 + 4, borderWidth: 2, borderStyle: "dashed", borderColor: COLORS.lineStrong, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", gap: SPACE[2] },
  plus: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.bg3, alignItems: "center", justifyContent: "center" },
  board: { backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.lg, padding: SPACE[4], paddingBottom: 0, overflow: "hidden" },
});
