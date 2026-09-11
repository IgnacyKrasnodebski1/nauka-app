import { PLANS, STAGES, type Stage } from "@nauka/shared";
import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StagePicker } from "@/components/Onboarding";
import { Body, Display, Label, Muted, Title } from "@/components/Text";
import { Button, Card, MiniPill, TopBar, Touch } from "@/components/ui";
import { getMe, stripeCheckout, stripePortal, type MeResponse } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { pl } from "@/lib/plural";
import { useAuth } from "@/lib/auth";
import { hasApi } from "@/lib/env";
import { COLORS, SPACE, UI, tabular } from "@/lib/theme";

export default function Profile() {
  const app = useApp();
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meErr, setMeErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editStage, setEditStage] = useState(false);

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
    }, [loadMe]),
  );

  const plan = me?.plan ?? "free";
  const limits = me?.limits ?? PLANS[plan];
  const stageInfo = STAGES.find((s) => s.id === app.stage);

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

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
      <TopBar title="Profil" />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 110 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Display size="2xl" weight={700}>
            {me?.profile?.display_name ?? auth.user?.email?.split("@")[0] ?? "Ty"}
          </Display>
          <Muted>{auth.user?.email}</Muted>
        </View>

        <View style={s.specs}>
          <MiniPill icon="🔥" value={app.streak} label="seria" color={COLORS.streak} />
          <MiniPill icon="🏆" value={app.meta.best} label="rekord" />
          <MiniPill icon="⚡" value={app.totalXp} label="xp" color={COLORS.xp} />
        </View>

        <Card style={{ marginTop: SPACE[4] }}>
          <Label style={{ marginBottom: SPACE[3] }}>etap edukacji</Label>
          {editStage ? (
            <StagePicker
              value={app.stage}
              onChange={(st: Stage) => {
                app.setStage(st);
                setEditStage(false);
                app.showToast("Zapisane");
              }}
            />
          ) : (
            <View style={s.row}>
              <Title size="md">{stageInfo ? `${stageInfo.emoji} ${stageInfo.label}` : "nie ustawiono"}</Title>
              <Button label="Zmień" small variant="secondary" onPress={() => setEditStage(true)} />
            </View>
          )}
        </Card>

        <Card style={{ marginTop: SPACE[3] }}>
          <Label style={{ marginBottom: SPACE[3] }}>plan</Label>
          <View style={s.row}>
            <Display size="lg" weight={700} color={plan === "pro" ? COLORS.accent : COLORS.text}>
              {plan === "pro" ? "Pro" : "Free"}
            </Display>
            {me?.subscription?.current_period_end ? <Muted size="xs">do {new Date(me.subscription.current_period_end).toLocaleDateString("pl-PL")}</Muted> : null}
          </View>
          <Body color={COLORS.muted} style={[{ marginTop: SPACE[2] }, tabular]}>
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
            <Body size="sm" color={COLORS.danger} style={{ marginTop: SPACE[2] }}>
              {meErr}
            </Body>
          ) : null}
          {!hasApi ? (
            <Body size="sm" color={COLORS.danger} style={{ marginTop: SPACE[2] }}>
              Brak EXPO_PUBLIC_API_URL — plan i limity niedostępne.
            </Body>
          ) : null}
          {plan !== "pro" ? (
            <View style={{ gap: SPACE[2], marginTop: SPACE[4] }}>
              <Button label={`Przejdź na Pro — ${PLANS.pro.priceMonthlyPln} zł/mies.`} onPress={() => upgrade("month")} disabled={busy || !hasApi} />
              <Button label={`Rocznie ${PLANS.pro.priceYearlyPln} zł · taniej o ${yearlySave}%`} variant="secondary" onPress={() => upgrade("year")} disabled={busy || !hasApi} />
              <Muted size="xs">
                Pro: {PLANS.pro.generationsPerMonth} tematów/mies., {PLANS.pro.filesPerGeneration} plików na raz do {PLANS.pro.maxFileMb} MB, tutor bez limitu. Płatność BLIK/karta w przeglądarce.
              </Muted>
            </View>
          ) : (
            <Button label="Zarządzaj subskrypcją" small variant="secondary" onPress={portal} disabled={busy} style={{ marginTop: SPACE[4] }} />
          )}
        </Card>

        <Touch onPress={logout} style={{ alignSelf: "center", marginTop: SPACE[6], padding: SPACE[2] }}>
          <Body weight={600} color={COLORS.danger}>
            Wyloguj
          </Body>
        </Touch>
        <Muted size="xs" center style={{ marginTop: SPACE[4] }}>
          NAUKA v0.1 · {pl(app.subjects.length, "przedmiot", "przedmioty", "przedmiotów")} · {pl(app.topics.length, "temat", "tematy", "tematów")}{app.offline ? " · offline (cache)" : ""}
        </Muted>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: UI.gutter, paddingTop: SPACE[2] },
  hero: { paddingVertical: SPACE[3], paddingBottom: SPACE[4], gap: 4 },
  specs: { flexDirection: "row", gap: SPACE[2], flexWrap: "wrap" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE[3] },
});
