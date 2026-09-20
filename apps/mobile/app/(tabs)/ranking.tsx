import type { LeaderboardRow } from "@nauka/shared";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button3D } from "@/components/Button3D";
import { Leaderboard } from "@/components/Gamification";
import { Icon } from "@/components/Icon";
import { Mascot, MascotBubble } from "@/components/Mascot";
import { GemsPill, StreakPill } from "@/components/Pills";
import { Body, Label, Muted, Num, Title } from "@/components/Text";
import { Card, TopBar } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { COLORS, PLAY, RADIUS, SPACE, UI, tabular } from "@/lib/theme";

/** Do poniedziałku 00:00 (reset tygodniowego rankingu). */
function untilReset(now = new Date()): { d: number; h: number; m: number } {
  const next = new Date(now);
  const dow = (now.getDay() + 6) % 7; // 0 = pn
  next.setDate(now.getDate() + (7 - dow));
  next.setHours(0, 0, 0, 0);
  const ms = Math.max(0, next.getTime() - now.getTime());
  return { d: Math.floor(ms / 86400000), h: Math.floor((ms % 86400000) / 3600000), m: Math.floor((ms % 3600000) / 60000) };
}

/** Ranking tygodnia: podium top 3, lista, Twój wiersz, odliczanie do resetu, opt-in do widoczności. */
export default function Ranking() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [me, setMe] = useState<{ rank: number; xp: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reset, setReset] = useState(untilReset());

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [r, m] = await Promise.all([app.fetchLeaderboard(50), app.myWeeklyRank()]);
      setRows(r);
      setMe(m);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Nie udało się pobrać rankingu");
    } finally {
      setLoading(false);
    }
  }, [app.fetchLeaderboard, app.myWeeklyRank]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    const id = setInterval(() => setReset(untilReset()), 60_000);
    return () => clearInterval(id);
  }, []);

  const myRow = rows.find((r) => r.isMe);
  const weekXp = me?.xp ?? myRow?.xp ?? 0;
  const line = !app.showOnLeaderboard ? "Jesteś ukryty. Włącz widoczność w profilu, żeby zawalczyć." : (me?.rank ?? myRow?.rank) === 1 ? "Pierwsze miejsce! Utrzymaj tempo." : weekXp === 0 ? "Zrób lekcję, a wskoczysz na listę." : "Jeszcze kilka lekcji i będzie podium.";

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
      <TopBar
        title="Ranking"
        subtitle="ten tydzień · XP"
        right={
          <>
            <StreakPill streak={app.streak} compact />
            <GemsPill gems={app.gems} compact />
          </>
        }
      />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 120 + insets.bottom }]} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={PLAY.green} />} showsVerticalScrollIndicator={false}>
        {/* Twoja pozycja */}
        <View style={s.hero}>
          <View style={{ flex: 1, gap: SPACE[2] }}>
            <View style={{ flexDirection: "row", gap: SPACE[2] }}>
              <HeroStat label="Twoje miejsce" value={me?.rank ? `#${me.rank}` : myRow ? `#${myRow.rank}` : "—"} color={PLAY.yellow} />
              <HeroStat label="XP w tym tygodniu" value={String(weekXp)} color={PLAY.green} />
            </View>
            <MascotBubble text={line} tail="left" />
          </View>
          <Mascot state={(me?.rank ?? myRow?.rank) === 1 ? "cheer" : "idle"} size={92} streak={app.streak} />
        </View>

        {/* reset */}
        <Card style={s.reset}>
          <View style={[s.resetIcon, { backgroundColor: PLAY.orangeSoft }]}>
            <Icon name="hourglass" size={18} color={PLAY.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Label>reset rankingu</Label>
            <Title size="base">
              za {reset.d > 0 ? `${reset.d} d ` : ""}
              {reset.h} h {reset.m} min
            </Title>
          </View>
          <Muted size="xs" weight={600} style={tabular}>
            {me?.total ?? rows.length} {(me?.total ?? rows.length) === 1 ? "osoba" : "osób"}
          </Muted>
        </Card>

        {err ? (
          <Body size="sm" color={COLORS.danger} center style={{ marginBottom: SPACE[3] }}>
            {err}
          </Body>
        ) : null}

        <Leaderboard rows={rows} me={me} />

        {!app.showOnLeaderboard ? (
          <Card style={{ marginTop: SPACE[4], alignItems: "center", gap: SPACE[2] }}>
            <Icon name="eye-off" size={26} color={COLORS.muted} />
            <Body center color={COLORS.muted}>
              Ukrywasz się w rankingu. Inni widzą tylko imię i XP.
            </Body>
            <Button3D label="Pokaż mnie w rankingu" variant="blue" size="sm" onPress={() => app.setShowOnLeaderboard(true)} />
          </Card>
        ) : null}

        <Card style={{ marginTop: SPACE[4], gap: SPACE[2] }}>
          <Label>jak to działa</Label>
          <Row icon="flash" text="Liczy się XP zdobyte od poniedziałku: lekcje, fiszki, misje, egzaminy." />
          <Row icon="flame" text="Combo ×2 od 5 poprawnych z rzędu, ×3 od 10 — najszybsza droga na podium." />
          <Row icon="shield-checkmark" text="Widoczne tylko imię i XP. Wyłączysz w profilu." />
          <Button3D label="Zrób lekcję" variant="green" onPress={() => router.push("/(tabs)/today")} style={{ marginTop: SPACE[2] }} right={<Icon name="arrow-forward" size={16} color="#fff" />} />
        </Card>
      </ScrollView>
    </View>
  );
}

function HeroStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[s.hstat, { borderBottomColor: color }]}>
      <Num size="xl" weight={800} color={color} style={tabular}>
        {value}
      </Num>
      <Muted size="xs" weight={600} numberOfLines={1}>
        {label}
      </Muted>
    </View>
  );
}

function Row({ icon, text }: { icon: React.ComponentProps<typeof Icon>["name"]; text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: SPACE[2], alignItems: "flex-start" }}>
      <Icon name={icon} size={16} color={PLAY.blue} style={{ marginTop: 2 }} />
      <Body size="sm" color={COLORS.textSoft} style={{ flex: 1 }}>
        {text}
      </Body>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: UI.gutter, paddingTop: SPACE[2] },
  hero: { flexDirection: "row", alignItems: "center", gap: SPACE[3], marginBottom: SPACE[4] },
  hstat: { flex: 1, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderBottomWidth: 4, borderRadius: RADIUS.md, padding: SPACE[3], gap: 2 },
  reset: { flexDirection: "row", alignItems: "center", gap: SPACE[3], padding: SPACE[3], paddingHorizontal: SPACE[4], marginBottom: SPACE[4] },
  resetIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
