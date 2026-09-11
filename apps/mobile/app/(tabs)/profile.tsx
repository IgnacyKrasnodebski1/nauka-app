import { PLANS, STAGES, type Stage } from "@nauka/shared";
import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StagePicker } from "@/components/Onboarding";
import { Card, H1, Muted, PillButton, Spec, TopBar } from "@/components/ui";
import { getMe, stripeCheckout, stripePortal, type MeResponse } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { hasApi } from "@/lib/env";
import { C, FONT } from "@/lib/theme";

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
    app.showToast("Wylogowano 👋");
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title="👤 Profil" />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <H1>{me?.profile?.display_name ?? auth.user?.email?.split("@")[0] ?? "Ty"}</H1>
          <Muted>{auth.user?.email}</Muted>
        </View>

        <View style={s.specs}>
          <Spec value={`🔥 ${app.streak}`} label="seria" />
          <Spec value={`🏆 ${app.meta.best}`} label="rekord" />
          <Spec value={`⚡ ${app.totalXp}`} label="xp" />
        </View>

        <Card style={{ marginTop: 14 }}>
          <Text style={s.cardTitle}>Etap edukacji</Text>
          {editStage ? (
            <View style={{ gap: 12 }}>
              <StagePicker
                value={app.stage}
                onChange={(st: Stage) => {
                  app.setStage(st);
                  setEditStage(false);
                  app.showToast("Zapisane ✅");
                }}
              />
            </View>
          ) : (
            <View style={s.row}>
              <Text style={s.big}>
                {stageInfo ? `${stageInfo.emoji} ${stageInfo.label}` : "nie ustawiono"}
              </Text>
              <PillButton label="zmień" ghost small onPress={() => setEditStage(true)} style={{ width: 90 }} />
            </View>
          )}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Text style={s.cardTitle}>Plan</Text>
          <View style={s.row}>
            <Text style={s.big}>{plan === "pro" ? "💜 Pro" : "🆓 Free"}</Text>
            {me?.subscription?.current_period_end ? <Muted style={{ fontSize: 12.5 }}>do {new Date(me.subscription.current_period_end).toLocaleDateString("pl-PL")}</Muted> : null}
          </View>
          <>
              <Text style={s.usage}>
                Generacje w tym miesiącu: <Text style={{ color: C.txt, fontWeight: FONT.black }}>{me?.usage.generations ?? "–"}</Text> / {limits.generationsPerMonth}
                {"\n"}Wiadomości do tutora: <Text style={{ color: C.txt, fontWeight: FONT.black }}>{me?.usage.tutorMessages ?? "–"}</Text>
                {plan === "pro" ? " (bez limitu)" : " / 30 dziennie"}
              </Text>
              {meErr ? <Text style={s.err}>{meErr}</Text> : null}
              {!hasApi ? <Text style={s.err}>Brak EXPO_PUBLIC_API_URL — plan/limity niedostępne.</Text> : null}
              {plan !== "pro" ? (
                <View style={{ gap: 8, marginTop: 12 }}>
                  <PillButton label={`Przejdź na Pro — ${PLANS.pro.priceMonthlyPln} zł/mies.`} onPress={() => upgrade("month")} disabled={busy || !hasApi} />
                  <PillButton label={`Rocznie ${PLANS.pro.priceYearlyPln} zł (taniej o ${Math.round((1 - PLANS.pro.priceYearlyPln / (PLANS.pro.priceMonthlyPln * 12)) * 100)}%)`} ghost onPress={() => upgrade("year")} disabled={busy || !hasApi} />
                  <Muted style={{ fontSize: 12.5 }}>Pro: {PLANS.pro.generationsPerMonth} generacji/mies., {PLANS.pro.filesPerGeneration} plików na raz do {PLANS.pro.maxFileMb} MB, tutor bez limitu. Płatność kartą w przeglądarce.</Muted>
                </View>
              ) : (
                <PillButton label="zarządzaj subskrypcją" ghost small onPress={portal} disabled={busy} style={{ marginTop: 12 }} />
              )}
          </>
        </Card>

        <PillButton label="wyloguj 👋" ghost danger onPress={logout} style={{ marginTop: 16 }} />

        <Muted style={{ fontSize: 12, textAlign: "center", marginTop: 24 }}>NAUKA v0.1 · {app.subjects.length} przedmiotów · {app.topics.length} tematów · postępy w chmurze ☁️{app.offline ? " (offline: cache)" : ""}</Muted>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 6 },
  hero: { paddingVertical: 14, paddingHorizontal: 4, gap: 6 },
  specs: { flexDirection: "row", gap: 10, justifyContent: "center", flexWrap: "wrap" },
  cardTitle: { color: C.muted, fontSize: 12, fontWeight: FONT.bold, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  big: { color: C.txt, fontSize: 18, fontWeight: FONT.black, flexShrink: 1 },
  usage: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  err: { color: "#ff8aa3", fontSize: 13, marginTop: 8, fontWeight: FONT.semi },
});
