import { DAILY_GOALS, DAILY_GOAL_LABEL, GEM_COSTS, PLANS, STAGES, type Achievement, type DailyGoal, type Stage } from "@nauka/shared";
import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button3D } from "@/components/Button3D";
import { BadgesGrid, RankCard } from "@/components/Gamification";
import { Icon } from "@/components/Icon";
import { AchievementModal } from "@/components/Modals";
import { StagePicker } from "@/components/Onboarding";
import { GemIcon, HeartsPill } from "@/components/Pills";
import { Body, Display, Label, Muted, Num, Title } from "@/components/Text";
import { Card, Input, TopBar, Touch } from "@/components/ui";
import { getMe, stripeCheckout, stripePortal, type MeResponse } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { hasApi } from "@/lib/env";
import { pl } from "@/lib/plural";
import { COLORS, PLAY, RADIUS, SPACE, UI, tabular } from "@/lib/theme";

/** Profil: RankCard, 6 statystyk, odznaki, ranga tygodnia, ustawienia (cel, dźwięk, ranking, etap, imię), plan. */
export default function Profile() {
  const app = useApp();
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meErr, setMeErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editStage, setEditStage] = useState(false);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(app.displayName ?? "");
  const [weekly, setWeekly] = useState<{ rank: number; xp: number; total: number } | null>(null);
  const [badge, setBadge] = useState<Achievement | null>(null);

  const loadMe = useCallback(async () => {
    if (!auth.user || !hasApi) return;
    const token = await auth.accessToken();
    if (!token) return;
    try {
      setMe(await getMe(token));
      setMeErr(null);
    } catch (e) {
      setMeErr(e instanceof Error ? e.message : "Nie udało się pobrać planu.");
    }
  }, [auth]);

  useFocusEffect(
    useCallback(() => {
      void loadMe();
      app
        .myWeeklyRank()
        .then(setWeekly)
        .catch(() => {});
    }, [loadMe, app.myWeeklyRank]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const plan = me?.plan ?? app.plan;
  const limits = me?.limits ?? PLANS[plan];
  const stageInfo = STAGES.find((s) => s.id === app.stage);
  const displayName = app.displayName ?? me?.profile?.display_name ?? auth.user?.email?.split("@")[0] ?? "Ty";

  /**
   * TODO(store): przed publikacją w App Store / Google Play zakupy w apce muszą iść przez IAP
   * (StoreKit / Google Play Billing, np. RevenueCat) — otwieranie Stripe Checkout jest OK dla TestFlight/bety
   * i (po DMA w UE) dla zakupów webowych z linkiem, ale Apple odrzuci build, który sprzedaje subskrypcję
   * przez zewnętrzny checkout bez IAP. Patrz README (sekcja „Sklepy”).
   */
  const upgrade = async (interval: "month" | "year") => {
    const token = await auth.accessToken();
    if (!token) return app.showToast("Sesja wygasła — zaloguj się ponownie.");
    setBusy(true);
    try {
      const { url } = await stripeCheckout(token, interval);
      await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
      await loadMe();
      await app.refresh();
    } catch (e) {
      app.showToast(e instanceof Error ? e.message : "Checkout nie wystartował");
    } finally {
      setBusy(false);
    }
  };

  const portal = async () => {
    const token = await auth.accessToken();
    if (!token) return;
    setBusy(true);
    try {
      const { url } = await stripePortal(token);
      await WebBrowser.openBrowserAsync(url);
      await loadMe();
    } catch (e) {
      app.showToast(e instanceof Error ? e.message : "Nie udało się otworzyć portalu");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await app.store?.flush();
    await auth.signOut();
    setMe(null);
    app.showToast("Wylogowano");
  };

  const yearlySave = Math.round((1 - PLANS.pro.priceYearlyPln / (PLANS.pro.priceMonthlyPln * 12)) * 100);
  const st = app.meta.stats;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
      <TopBar title="Profil" subtitle={auth.user?.email ?? undefined} right={<HeartsPill hearts={app.hearts} showTimer />} />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 110 + insets.bottom }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(300)}>
          <RankCard rank={app.rank} totalXp={app.totalXp} name={displayName} sub={stageInfo ? `${stageInfo.emoji} ${stageInfo.label}` : undefined} />
        </Animated.View>

        {/* 6 statystyk */}
        <View style={s.grid}>
          <Stat icon="flame" color={PLAY.orange} value={app.streak} label="seria" delay={60} />
          <Stat icon="trophy" color={PLAY.yellow} value={app.meta.best} label="rekord serii" delay={100} />
          <Stat icon="flash" color={COLORS.xp} value={app.totalXp} label="XP łącznie" delay={140} />
          <Stat icon="diamond" color={PLAY.gem} value={app.gems} label="klejnoty" delay={180} />
          <Stat icon="layers" color={PLAY.blue} value={st.cardsReviewed} label="fiszek" delay={220} />
          <Stat icon="flag" color={PLAY.green} value={st.levelsDone} label="poziomów" delay={260} />
        </View>

        {/* odznaki */}
        <Card style={{ marginTop: SPACE[4], gap: SPACE[3] }}>
          <View style={s.row}>
            <Title size="md">Odznaki</Title>
            <Muted size="xs" weight={700} style={tabular}>
              {app.achievements.size}/16
            </Muted>
          </View>
          <BadgesGrid unlocked={app.achievements} onPress={setBadge} />
        </Card>

        {/* ranga tygodnia */}
        <Card style={{ marginTop: SPACE[3], flexDirection: "row", alignItems: "center", gap: SPACE[3] }}>
          <View style={[s.iconBox, { backgroundColor: PLAY.yellowSoft }]}>
            <Icon name="podium" size={20} color={PLAY.yellow} />
          </View>
          <View style={{ flex: 1 }}>
            <Label>ranking tygodnia</Label>
            <Title size="md">{weekly?.rank ? `#${weekly.rank} z ${weekly.total}` : app.showOnLeaderboard ? "jeszcze bez XP w tym tygodniu" : "ukryty"}</Title>
          </View>
          <Num size="lg" weight={800} color={COLORS.xp}>
            {weekly?.xp ?? 0} XP
          </Num>
        </Card>

        {/* ustawienia */}
        <Card style={{ marginTop: SPACE[3], gap: SPACE[4] }}>
          <Title size="md">Ustawienia</Title>
          <View style={{ gap: SPACE[2] }}>
            <Label>cel dzienny</Label>
            <View style={{ flexDirection: "row", gap: SPACE[2] }}>
              {DAILY_GOALS.map((g) => {
                const on = app.dailyGoal === g;
                return (
                  <Touch key={g} onPress={() => app.setDailyGoal(g as DailyGoal)} style={[s.goal, on && { backgroundColor: PLAY.greenSoft, borderColor: PLAY.green, borderBottomColor: PLAY.greenDeep }]}>
                    <Num size="lg" weight={800} color={on ? PLAY.green : COLORS.text}>
                      {g}
                    </Num>
                    <Muted size="xs" weight={600} color={on ? PLAY.green : COLORS.muted}>
                      {DAILY_GOAL_LABEL[g as DailyGoal]}
                    </Muted>
                  </Touch>
                );
              })}
            </View>
          </View>
          <Setting icon="volume-high" label="Dźwięki" hint="krótkie efekty w lekcji" value={app.soundOn} onChange={app.setSoundOn} />
          <Setting icon="podium" label="Widoczność w rankingu" hint="tylko imię i XP" value={app.showOnLeaderboard} onChange={app.setShowOnLeaderboard} />
          <View style={{ gap: SPACE[2] }}>
            <Label>imię w rankingu</Label>
            {editName ? (
              <View style={{ flexDirection: "row", gap: SPACE[2] }}>
                <Input value={name} onChangeText={setName} placeholder="np. Kasia" style={{ flex: 1 }} maxLength={24} />
                <Button3D
                  label="OK"
                  size="sm"
                  onPress={() => {
                    app.setDisplayName(name);
                    setEditName(false);
                    app.showToast("Zapisane");
                  }}
                  style={{ width: 72, alignSelf: "center" }}
                />
              </View>
            ) : (
              <View style={s.row}>
                <Title size="base">{displayName}</Title>
                <Button3D label="Zmień" size="sm" variant="ghost" onPress={() => setEditName(true)} style={{ width: 90 }} />
              </View>
            )}
          </View>
          <View style={{ gap: SPACE[2] }}>
            <Label>etap edukacji</Label>
            {editStage ? (
              <StagePicker
                value={app.stage}
                onChange={(stg: Stage) => {
                  app.setStage(stg);
                  setEditStage(false);
                  app.showToast("Zapisane");
                }}
              />
            ) : (
              <View style={s.row}>
                <Title size="base">{stageInfo ? `${stageInfo.emoji} ${stageInfo.label}` : "nie ustawiono"}</Title>
                <Button3D label="Zmień" size="sm" variant="ghost" onPress={() => setEditStage(true)} style={{ width: 90 }} />
              </View>
            )}
          </View>
          <View style={{ gap: SPACE[2] }}>
            <Label>zamrożenie serii · masz {app.meta.streakFreezes}</Label>
            <Button3D label={`Kup zamrożenie · ${GEM_COSTS.streakFreeze}`} variant="blue" size="sm" onPress={app.buyStreakFreeze} right={<GemIcon size={14} color="#fff" />} disabled={app.gems < GEM_COSTS.streakFreeze || app.meta.streakFreezes >= 2} />
          </View>
        </Card>

        {/* plan */}
        <Card style={{ marginTop: SPACE[3], gap: SPACE[3], borderColor: plan === "pro" ? PLAY.purple : COLORS.line }}>
          <View style={s.row}>
            <View>
              <Label>plan</Label>
              <Display size="xl" weight={800} color={plan === "pro" ? PLAY.purple : COLORS.text}>
                {plan === "pro" ? "Pro" : "Free"}
              </Display>
            </View>
            <View style={[s.proBadge, { backgroundColor: plan === "pro" ? PLAY.purpleSoft : PLAY.redSoft }]}>
              <Icon name={plan === "pro" ? "infinite" : "heart"} size={16} color={plan === "pro" ? PLAY.purple : PLAY.red} />
              <Muted size="xs" weight={700} color={plan === "pro" ? PLAY.purple : PLAY.red}>
                {plan === "pro" ? "nieskończone serca" : "5 serc"}
              </Muted>
            </View>
          </View>
          {me?.subscription?.current_period_end ? <Muted size="xs">do {new Date(me.subscription.current_period_end).toLocaleDateString("pl-PL")}</Muted> : null}
          <Body color={COLORS.muted} style={tabular}>
            Generacje w tym miesiącu:{" "}
            <Body weight={700} color={COLORS.text}>
              {me?.usage.generations ?? "–"}
            </Body>{" "}
            / {limits.generationsPerMonth}
            {"\n"}Wiadomości do tutora:{" "}
            <Body weight={700} color={COLORS.text}>
              {me?.usage.tutorMessages ?? "–"}
            </Body>
            {plan === "pro" ? " (bez limitu)" : " / 30 dziennie"}
          </Body>
          {meErr ? (
            <Body size="sm" color={COLORS.danger}>
              {meErr}
            </Body>
          ) : null}
          {!hasApi ? (
            <Body size="sm" color={COLORS.danger}>
              Brak EXPO_PUBLIC_API_URL — plan i limity niedostępne.
            </Body>
          ) : null}
          {plan !== "pro" ? (
            <View style={{ gap: SPACE[2] }}>
              <Button3D label={`Pro — ${PLANS.pro.priceMonthlyPln} zł/mies.`} variant="purple" onPress={() => upgrade("month")} disabled={busy || !hasApi} left={<Icon name="infinite" size={18} color="#fff" />} />
              <Button3D label={`Rocznie ${PLANS.pro.priceYearlyPln} zł · taniej o ${yearlySave}%`} variant="ghost" onPress={() => upgrade("year")} disabled={busy || !hasApi} />
              <Muted size="xs">
                Pro: nieskończone serca, {PLANS.pro.generationsPerMonth} tematów/mies., {PLANS.pro.filesPerGeneration} plików na raz do {PLANS.pro.maxFileMb} MB, tutor bez limitu. Płatność BLIK/karta w przeglądarce.
              </Muted>
            </View>
          ) : (
            <Button3D label="Zarządzaj subskrypcją" size="sm" variant="ghost" onPress={portal} disabled={busy} />
          )}
        </Card>

        <Touch onPress={logout} style={{ alignSelf: "center", marginTop: SPACE[6], padding: SPACE[2] }}>
          <Body weight={600} color={COLORS.danger}>
            Wyloguj
          </Body>
        </Touch>
        <Muted size="xs" center style={{ marginTop: SPACE[3] }}>
          Recall v0.1 · {pl(app.subjects.length, "przedmiot", "przedmioty", "przedmiotów")} · {pl(app.topics.length, "temat", "tematy", "tematów")}
          {app.offline ? " · offline (cache)" : ""}
        </Muted>
      </ScrollView>
      {badge ? <AchievementModal achievement={badge} unlocked={app.achievements.has(badge.key)} onClose={() => setBadge(null)} /> : null}
    </View>
  );
}

function Stat({ icon, color, value, label, delay }: { icon: React.ComponentProps<typeof Icon>["name"]; color: string; value: number; label: string; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)} style={[s.stat, { borderBottomColor: color }]}>
      <Icon name={icon} size={18} color={color} />
      <Num size="lg" weight={800} color={COLORS.text} style={tabular}>
        {value}
      </Num>
      <Muted size="xs" weight={600} numberOfLines={1}>
        {label}
      </Muted>
    </Animated.View>
  );
}

function Setting({ icon, label, hint, value, onChange }: { icon: React.ComponentProps<typeof Icon>["name"]; label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.row}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE[3], flex: 1 }}>
        <View style={[s.iconBox, { backgroundColor: COLORS.bg3 }]}>
          <Icon name={icon} size={18} color={value ? PLAY.green : COLORS.muted} />
        </View>
        <View>
          <Body weight={700} color={COLORS.text}>
            {label}
          </Body>
          <Muted size="xs">{hint}</Muted>
        </View>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: PLAY.green, false: COLORS.bg4 }} thumbColor="#fff" />
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: UI.gutter, paddingTop: SPACE[2] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE[2], marginTop: SPACE[3] },
  stat: { width: "31%", flexGrow: 1, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderBottomWidth: 4, borderRadius: RADIUS.md, padding: SPACE[3], gap: 4, alignItems: "flex-start" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE[3] },
  iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  goal: { flex: 1, alignItems: "center", gap: 2, paddingVertical: SPACE[3], borderRadius: RADIUS.md, backgroundColor: COLORS.bg3, borderWidth: 1.5, borderColor: COLORS.line, borderBottomWidth: 4, borderBottomColor: PLAY.surfaceDeep },
  proBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.pill },
});
