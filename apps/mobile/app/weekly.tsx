import { todayStr } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Share, StyleSheet, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Bar, Motion } from "@/components/Motion";
import { Body, Display, Muted, Num } from "@/components/Text";
import { Press, RoundBtn, Screen, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { DAYS, DAYS_S, fmtNum, npl } from "@/lib/format";
import { T } from "@/lib/theme";

const BG = "#A855F7",
  INK = "#1A0A2A",
  INK2 = "#2A0F48",
  INK3 = "#3A1560",
  BAR = "#6B2AA8",
  SEG = "#7E3BD0";

const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function weekRange(offset: number): string[] {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + offset * 7);
  return Array.from({ length: 7 }, (_, i) => dstr(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i)));
}

/**
 * Twój tydzień (WeeklyStory.html): XP z `activity` (dzienny log) + dziennik `history` (poziomy, powtórki, karty, combo, misje).
 * `mode=last` (poniedziałek, raz) = zeszły tydzień vs poprzedni; z Profilu = bieżący vs zeszły.
 */
export default function Weekly() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const last = mode === "last";
  const activity = app.store?.activity ?? {};
  const H = app.extra.history;
  const stats = (days: string[]) => {
    const st = { xp: 0, levels: 0, cards: 0, reviews: 0, combo: 0, missions: 0, days: 0, perDay: [] as number[] };
    for (const d of days) {
      const x = activity[d]?.xp ?? 0;
      const h = H[d];
      st.xp += x;
      st.levels += h?.levels ?? 0;
      st.cards += h?.cards ?? 0;
      st.reviews += h?.reviews ?? 0;
      st.missions += h?.missions ?? 0;
      st.combo = Math.max(st.combo, h?.combo ?? 0);
      if (x > 0 || (h?.levels ?? 0) > 0 || (h?.reviews ?? 0) > 0) st.days++;
      st.perDay.push(x);
    }
    return st;
  };
  const days = useMemo(() => weekRange(last ? -1 : 0), [last]);
  const cur = stats(days);
  const prev = stats(weekRange(last ? -2 : -1));
  const diff = prev.xp > 0 ? Math.round(((cur.xp - prev.xp) / prev.xp) * 100) : null;
  const trend = diff == null ? (cur.xp ? "pierwszy tydzień z historią" : "jeszcze bez XP w tym tygodniu") : diff >= 0 ? `o ${diff}% więcej niż tydzień temu` : `o ${-diff}% mniej niż tydzień temu`;
  const t = todayStr();
  const max = Math.max(1, ...cur.perDay);
  const bi = cur.perDay.indexOf(Math.max(...cur.perDay));
  const close = () => (router.canGoBack() ? router.back() : router.replace(last ? "/(tabs)" : "/(tabs)/profile"));
  const share = () =>
    Share.share({ message: `${fmtNum(cur.xp)} XP, ${npl(cur.days, "dzień", "dni", "dni")} nauki, ${npl(cur.levels, "poziom", "poziomy", "poziomów")} — Recall` }).catch(() => {});
  return (
    <Screen pad={false} style={{ backgroundColor: BG }}>
      <View style={[s.blobA]} pointerEvents="none" />
      <View style={[s.blobB]} pointerEvents="none" />
      <View style={{ paddingHorizontal: 16, paddingTop: top - 4, flexDirection: "row", gap: 5 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[s.seg, { backgroundColor: i < 2 ? INK : SEG }]}>{i === 2 ? <Bar pct={60} color={INK} height={4} radius={2} /> : null}</View>
        ))}
      </View>
      <View style={{ paddingHorizontal: 18, paddingTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Body size={13} weight={800} color={INK}>
          {last ? "Twój tydzień" : "Ten tydzień"}
        </Body>
        <RoundBtn icon="close" onPress={close} label="Zamknij podsumowanie" style={{ backgroundColor: "transparent", borderColor: "transparent" }} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 22, paddingTop: 30, gap: 10 }}>
        <Motion kind="up">
          <Body size={16} weight={800} color={INK2}>
            {last ? "W zeszłym tygodniu zdobyte" : "W tym tygodniu zdobyte"}
          </Body>
        </Motion>
        <Motion kind="pop" d={1}>
          <Num size={cur.xp >= 10000 ? 60 : 76} color={INK} ls={-3} lh={cur.xp >= 10000 ? 62 : 76}>
            {fmtNum(cur.xp)} XP
          </Num>
        </Motion>
        <Motion kind="up" d={2} style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: INK, marginTop: 6 }}>
          <Icon name="trend" size={16} color={diff != null && diff < 0 ? "#FF8FA3" : T.acid} />
          <Body size={13} weight={800} color={diff != null && diff < 0 ? "#FF8FA3" : T.acid}>
            {trend}
          </Body>
        </Motion>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 34 }}>
          {days.map((d, i) => {
            const best = i === bi && cur.perDay[i]! > 0;
            const h = Math.max(6, Math.round((cur.perDay[i]! / max) * 100));
            return (
              <View key={d} style={{ flex: 1, alignItems: "center", gap: 7 }}>
                <View style={{ width: "100%", height: 110, justifyContent: "flex-end" }}>
                  <Motion kind="up" d={Math.min(6, i + 1)} style={{ width: "100%", height: `${h}%`, borderRadius: 9, backgroundColor: best ? INK : BAR, opacity: d > t ? 0.35 : 1 }} />
                </View>
                <Body size={11.5} weight={800} color={d === t ? INK : INK3}>
                  {DAYS_S[(i + 1) % 7]}
                </Body>
              </View>
            );
          })}
        </View>
        <Motion kind="up" d={6}>
          <Body size={15} weight={800} color={INK2} style={{ marginTop: 16 }}>
            {cur.xp ? `Najmocniejszy dzień: ${DAYS[(bi + 1) % 7]!.toLowerCase()} — ${cur.perDay[bi]} XP.` : "Zacznij od jednego zadania z planu dnia."}
          </Body>
        </Motion>
        <Motion kind="up" d={4} style={s.grid}>
          {(
            [
              ["flame", cur.days, npl(cur.days, "dzień nauki", "dni nauki", "dni nauki")],
              ["check", cur.levels, npl(cur.levels, "poziom zaliczony", "poziomy zaliczone", "poziomów zaliczonych")],
              ["refresh", cur.reviews, npl(cur.reviews, "pojęcie powtórzone", "pojęcia powtórzone", "pojęć powtórzonych")],
              ["cards", cur.cards, npl(cur.cards, "karta w albumie", "karty w albumie", "kart w albumie")],
              ["bolt", `×${cur.combo}`, "najlepsze combo"],
              ["star", cur.missions, npl(cur.missions, "misja odebrana", "misje odebrane", "misji odebranych")],
            ] as [string, number | string, string][]
          ).map(([ic, v, lab]) => (
            <View key={lab} style={s.stat}>
              <Icon name={ic} size={18} stroke={2.6} color={INK} />
              <Display size={18} color={INK}>
                {typeof v === "number" ? v : v}
              </Display>
              <Muted size={10.5} weight={700} color={INK3} numberOfLines={2}>
                {lab.replace(/^\d+ /, "")}
              </Muted>
            </View>
          ))}
        </Motion>
      </View>
      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 22, paddingBottom: 30, paddingTop: 12 }}>
        <Press onPress={close} drop={5} edge="#0A0414" radius={18} style={{ flex: 1 }} faceStyle={s.dark} accessibilityLabel={last ? "Wracam do nauki" : "Wróć do profilu"}>
          <Body size={14.5} weight={800} color={T.txt} ls={1}>
            {last ? "WRACAM DO NAUKI" : "WRÓĆ DO PROFILU"}
          </Body>
        </Press>
        <Press onPress={share} drop={5} edge="#0A0414" radius={18} faceStyle={[s.dark, { paddingHorizontal: 18 }]} accessibilityLabel="Udostępnij">
          <Icon name="upload" size={17} color={T.txt} />
        </Press>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  blobA: { position: "absolute", top: -80, right: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: "#B97BFF" },
  blobB: { position: "absolute", bottom: 60, left: -120, width: 280, height: 280, borderRadius: 140, backgroundColor: "#9442EC" },
  seg: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  stat: { width: "31%", flexGrow: 1, backgroundColor: "#B97BFF", borderRadius: 16, padding: 10, gap: 3 },
  dark: { height: 56, backgroundColor: INK, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
});
