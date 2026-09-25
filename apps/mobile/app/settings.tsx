import { HEARTS_MAX, PLANS, THEMES, formatCountdown } from "@nauka/shared";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, TextInput, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Eyebrow, Muted } from "@/components/Text";
import { Blob, ListCard, Mono, Row, Screen, Toggle, TopBar, Touch, useTop } from "@/components/ui";
import { ApiError, getMe, stripeCheckout, stripePortal, type MeResponse } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { hasApi } from "@/lib/env";
import { noEmoji } from "@/lib/format";
import { T, TONES, body } from "@/lib/theme";
import { GOAL_NAME, LEVELS } from "./onboarding";

const VERSION = "2.0";

/**
 * Ustawienia (Settings.html + legacy renderSettings): Profil (etap i cel, cel dzienny, motyw, imię, ranking), Nauka (dźwięk,
 * animacje, życia), Powiadomienia (godzina, ratunek serii), Przedmioty, Plan (Pro/Stripe), Dane (eksport / import JSON), O aplikacji, Wyloguj.
 */
export default function Settings() {
  const app = useApp();
  const auth = useAuth();
  const router = useRouter();
  const top = useTop();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [name, setName] = useState(app.displayName ?? "");
  const [remAt, setRemAt] = useState(app.extra.reminder?.at ?? "19:30");
  const [busy, setBusy] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const rem = app.extra.reminder ?? { on: false, at: "19:30" };
  const lvl = LEVELS.find((l) => l.id === app.stage)?.t ?? "nie wybrano";
  const goal = app.extra.goal ? GOAL_NAME[app.extra.goal] : "";
  const theme = THEMES.find((t) => t.id === app.extra.themes.active) ?? THEMES[0]!;
  const eta = app.hearts.nextInMs;

  useEffect(() => {
    if (!hasApi) return;
    let alive = true;
    (async () => {
      const token = await auth.accessToken();
      if (!token) return;
      try {
        const r = await getMe(token);
        if (alive) setMe(r);
      } catch {
        /* offline */
      }
    })();
    return () => {
      alive = false;
    };
  }, [auth]);

  const openUrl = async (fn: (t: string) => Promise<{ url: string }>, key: string) => {
    setBusy(key);
    try {
      const token = await auth.accessToken();
      if (!token) throw new Error("Sesja wygasła — zaloguj się ponownie.");
      const { url } = await fn(token);
      await WebBrowser.openBrowserAsync(url);
      void app.refresh();
    } catch (e) {
      app.showToast(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Nie udało się otworzyć", "alert");
    } finally {
      setBusy(null);
    }
  };

  /** Eksport: plik JSON {app:"recall", version, exportedAt, progress, srs, weak, meta, extra} → udostępnij (expo-sharing). */
  const exportData = async () => {
    if (!app.store) return;
    const data = { app: "recall", version: VERSION, exportedAt: new Date().toISOString(), progress: app.progress, srs: app.srs, weak: app.weak, meta: app.meta, extra: app.extra, stage: app.stage };
    const json = JSON.stringify(data, null, 1);
    try {
      if (Platform.OS === "web") {
        const BlobCtor = (globalThis as unknown as { Blob: new (parts: string[], o: { type: string }) => object }).Blob;
        const url = URL.createObjectURL(new BlobCtor([json], { type: "application/json" }) as never);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recall-postepy-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
      } else {
        const f = new File(Paths.cache.uri.replace(/\/?$/, "/") + `recall-postepy-${new Date().toISOString().slice(0, 10)}.json`);
        f.write(json);
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: "application/json", dialogTitle: "Postępy Recall" });
      }
      app.showToast("Plik z postępami gotowy", "download");
    } catch (e) {
      app.showToast(e instanceof Error ? e.message : "Eksport nie wyszedł", "alert");
    }
  };
  /** Import: JSON z eksportu → nadpisuje postępy tematów, powtórki, meta i pola 2.0 (po potwierdzeniu). */
  const importData = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain"], copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    try {
      const text = Platform.OS === "web" && r.assets[0].file ? await r.assets[0].file.text() : await new File(r.assets[0].uri).text();
      const d = JSON.parse(text) as { app?: string; progress?: typeof app.progress; srs?: typeof app.srs; weak?: typeof app.weak; meta?: typeof app.meta; extra?: typeof app.extra };
      if (d.app !== "recall" || !d.progress) throw new Error("format");
      const apply = () => {
        const st = app.store!;
        for (const [tid, p] of Object.entries(d.progress ?? {})) st.setProgress(tid, p);
        for (const [tid, m] of Object.entries(d.srs ?? {})) st.setSrs(tid, m);
        if (d.meta) st.setMeta(d.meta);
        if (d.extra) st.setExtra(d.extra);
        app.showToast("Postępy wczytane", "check");
        void app.refresh();
      };
      if (Platform.OS === "web") {
        if (confirm("Wczytać postępy z pliku? Obecne zostaną zastąpione.")) apply();
      } else Alert.alert("Wczytać postępy?", "Obecne postępy zostaną zastąpione tymi z pliku.", [{ text: "Anuluj", style: "cancel" }, { text: "Wczytaj", style: "destructive", onPress: apply }]);
    } catch {
      app.showToast("To nie jest plik z postępami Recall", "alert");
    }
  };
  const logout = async () => {
    await app.store?.flush().catch(() => {});
    await auth.signOut();
  };

  return (
    <Screen scroll pad={false} blob={<Blob tone="acid" size={250} top={-110} left={-90} />} bottom={40}>
      <View style={[s.wrap, { paddingTop: top }]}>
        <TopBar title="Ustawienia" onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))} />
        <Eyebrow>Profil</Eyebrow>
        <Motion kind="up" d={1}>
          <ListCard>
            <Row icon="cap" title="Etap i cel" sub={`${lvl}${goal ? " · " + goal : ""}`} onPress={() => router.push({ pathname: "/onboarding", params: { from: "settings" } })} />
            <Row icon="bolt" title="Cel dzienny" value={`${app.dailyGoal} XP`} sub="plan dnia, pasek XP i misja XP" onPress={() => router.push("/goal")} />
            <Row icon="palette" title="Motyw" value={theme.name} valueColor={T.violet} sub={`${app.extra.themes.owned.length} z ${THEMES.length} zestawów · kolejne w plecaku`} onPress={() => router.push("/shop")} />
            <View style={s.row}>
              <Icon name="user" size={20} stroke={2.4} color={T.txt} />
              <View style={{ flex: 1 }}>
                <Body>Imię w rankingu</Body>
                <TextInput value={name} onChangeText={setName} onEndEditing={() => app.setDisplayName(name)} onBlur={() => app.setDisplayName(name)} placeholder="np. Ignacy" placeholderTextColor={T.muted2} style={s.input} accessibilityLabel="Imię w rankingu" />
              </View>
            </View>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Body>Pokazuj mnie w lidze</Body>
                <Muted size={11.5}>tygodniowy ranking XP</Muted>
              </View>
              <Toggle value={app.showOnLeaderboard} onChange={app.setShowOnLeaderboard} label="Pokazuj mnie w lidze" />
            </View>
          </ListCard>
        </Motion>
        <Eyebrow>Nauka</Eyebrow>
        <Motion kind="up" d={2}>
          <ListCard>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Body>Dźwięk i wibracje</Body>
              </View>
              <Toggle value={app.soundOn} onChange={app.setSoundOn} label="Dźwięk" />
            </View>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Body>Ogranicz animacje</Body>
                <Muted size={11.5}>idzie za ustawieniem telefonu; tu wymuszasz</Muted>
              </View>
              <Toggle value={app.reduceMotion} onChange={app.setReduceMotion} label="Ogranicz animacje" />
            </View>
            <Row icon="heart" iconColor={T.red} title="Życia" sub={app.hearts.unlimited ? "Pro: bez limitu" : `${app.hearts.hearts} z ${HEARTS_MAX} · jedno wraca co 30 min${eta ? " · następne za " + formatCountdown(eta) : ""}`} onPress={() => app.showToast(eta ? "Kolejne życie za " + formatCountdown(eta) : "Pełne życia", "heart")} chevron={false} />
          </ListCard>
        </Motion>
        <Eyebrow>Powiadomienia</Eyebrow>
        <Motion kind="up" d={3}>
          <ListCard>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Body>Przypomnienie o nauce</Body>
                <Muted size={11.5}>codziennie o wybranej godzinie</Muted>
              </View>
              <TextInput value={remAt} onChangeText={setRemAt} onEndEditing={() => app.setReminder({ on: rem.on, at: /^\d{1,2}:\d{2}$/.test(remAt) ? remAt : "19:30" })} onBlur={() => app.setReminder({ on: rem.on, at: /^\d{1,2}:\d{2}$/.test(remAt) ? remAt : "19:30" })} style={s.time} keyboardType="numbers-and-punctuation" accessibilityLabel="Godzina przypomnienia" />
              <Toggle value={rem.on} onChange={(v) => app.setReminder({ on: v, at: remAt })} label="Przypomnienie o nauce" />
            </View>
            <View style={[s.row, { alignItems: "flex-start" }]}>
              <Icon name="info" size={18} stroke={2.4} color={T.muted} />
              <Muted size={11.5} lh={16} style={{ flex: 1 }}>
                Powiadomienia push dojdą z aplikacją sklepową — na razie zapisujemy tylko godzinę.
              </Muted>
            </View>
          </ListCard>
        </Motion>
        <Eyebrow>Przedmioty</Eyebrow>
        <Motion kind="up" d={4}>
          <ListCard>
            {app.subjects.map((sub) => (
              <AccentProvider key={sub.id} color={sub.accent2} seed={sub.name}>
                <Row left={<Mono text={sub.name} size={32} />} title={noEmoji(sub.name)} onPress={() => router.push({ pathname: "/s/[subjectId]", params: { subjectId: sub.id } })} />
              </AccentProvider>
            ))}
            <Row icon="grid" title="Katalog przedmiotów" sub="gotowe przedmioty według etapu" onPress={() => router.push("/catalog")} />
            <Row icon="plus" iconColor={T.acid} title="Dodaj materiał" titleColor={T.acid} onPress={() => router.push("/quick-add")} chevron={false} />
          </ListCard>
        </Motion>
        <Eyebrow>Plan</Eyebrow>
        <Motion kind="up" d={5}>
          <ListCard tone={app.plan === "pro" ? "acid" : undefined}>
            <Row icon="star" iconColor={T.gold} title={app.plan === "pro" ? "Recall Pro" : "Plan darmowy"} sub={me ? `${me.usage.generations}/${me.limits.generationsPerMonth === Infinity ? "∞" : me.limits.generationsPerMonth} tematów w tym miesiącu · ${me.usage.tutorMessages} wiadomości do tutora` : `${PLANS.free.generationsPerMonth} tematy z AI miesięcznie · ${PLANS.pro.generationsPerMonth} w Pro`} chevron={false} />
            {app.plan === "pro" ? (
              <Row icon="settings" title={busy === "portal" ? "Otwieram…" : "Zarządzaj subskrypcją"} sub="Stripe: faktury, anulowanie" onPress={() => openUrl(stripePortal, "portal")} />
            ) : (
              <>
                <Row icon="bolt" iconColor={T.acid} title={busy === "month" ? "Otwieram…" : "Przejdź na Pro — miesięcznie"} sub="bez limitu serc i tematów" onPress={() => openUrl((t) => stripeCheckout(t, "month"), "month")} />
                <Row icon="trophy" iconColor={T.gold} title={busy === "year" ? "Otwieram…" : "Pro — rocznie"} sub="taniej o dwa miesiące" onPress={() => openUrl((t) => stripeCheckout(t, "year"), "year")} />
              </>
            )}
          </ListCard>
        </Motion>
        <Eyebrow>Dane</Eyebrow>
        <Motion kind="up" d={6}>
          <ListCard>
            <Row icon="download" title="Eksportuj postępy" sub="plik JSON: XP, poziomy, powtórki, plany, ustawienia" onPress={exportData} />
            <Row icon="upload" title="Importuj z pliku" sub="zastąpi obecne postępy tym z pliku" onPress={importData} />
            <Row icon="refresh" iconColor={T.cyan} title="Odśwież dane" sub="pobierz jeszcze raz z serwera" onPress={() => void app.refresh()} />
          </ListCard>
        </Motion>
        <Eyebrow>O aplikacji</Eyebrow>
        <ListCard>
          <Row icon="info" title={`Recall ${VERSION}`} sub={`konto: ${auth.user?.email ?? "—"} · synchronizacja przez Supabase`} chevron={false} />
          <Row icon="list" title="Co nowego" sub="wersja 2.0 designu" onPress={() => setShowLog((v) => !v)} right={<Icon name={showLog ? "chevron-up" : "chevron-down"} size={18} color={T.muted2} />} chevron={false} />
          {showLog ? (
            <View style={{ paddingVertical: 8, gap: 6 }}>
              {[
                ["2.0", "Nowa skóra: płaskie kolory i twarde krawędzie, Dziś z planem dnia, ścieżka ze skrzyniami i bossem, 16 typów zadań, powtórka na interwałach, egzamin z siatką, plan do sprawdzianu, plecak, misje, album, duch, podsumowanie tygodnia, poprawianie pytań, źródła"],
                ["1.x", "Przedmioty i tematy z AI, ścieżka, fiszki, quiz, egzamin, serca, klejnoty, ranking"],
              ].map(([v, t]) => (
                <View key={v} style={{ flexDirection: "row", gap: 10 }}>
                  <Body size={12} weight={800} color={T.acid} style={{ width: 34 }}>
                    {v}
                  </Body>
                  <Muted size={12} lh={16} style={{ flex: 1 }}>
                    {t}
                  </Muted>
                </View>
              ))}
            </View>
          ) : null}
        </ListCard>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingVertical: 4 }}>
          <Muted size={12} color={T.muted3}>
            Recall {VERSION} · mobile
          </Muted>
          <View style={{ flex: 1 }} />
          <Touch onPress={logout} accessibilityRole="button" hitSlop={8}>
            <Body size={12.5} weight={800} color={TONES.red.txt}>
              Wyloguj
            </Body>
          </Touch>
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, minHeight: 48 },
  input: { marginTop: 6, backgroundColor: T.surface2, borderWidth: 2, borderColor: T.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: T.txt, fontFamily: body(700), fontSize: 14 },
  time: { width: 64, backgroundColor: T.surface2, borderWidth: 2, borderColor: T.line, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 8, color: T.txt, fontFamily: body(800), fontSize: 13, textAlign: "center" },
});
