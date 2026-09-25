import { FREEZE_MAX } from "@nauka/shared";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Display, Eyebrow, Muted, Num } from "@/components/Text";
import { Blob, Btn, Card, IconTile, Press, RoundBtn, Screen, Touch, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { npl } from "@/lib/format";
import { T, TONES } from "@/lib/theme";

/** Seria (Streak.html): płomień, liczba dni, rekord, tydzień w kółkach (`weekStrip`), zamrażarka serii → plecak. */
export default function Streak() {
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const n = app.streak;
  const best = Math.max(app.meta.best, n);
  const fz = app.meta.streakFreezes;
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  const txt = n === 0 ? "Zacznij dziś — jedna lekcja albo powtórka i seria rusza." : best > n ? `Rekord to ${best}. Jeszcze ${npl(best - n + 1, "dzień", "dni", "dni")} i bijesz swój wynik.` : n >= 7 ? "To twój rekord. Każdy dzień go wydłuża." : "Twój najlepszy wynik. Tak trzymaj.";
  return (
    <Screen scroll pad={false} bottom={26}>
      <View style={s.topBg} />
      <Blob tone="amber" size={280} top={60} center />
      <View style={[{ paddingHorizontal: 18, paddingTop: top, alignItems: "flex-end" }]}>
        <RoundBtn icon="close" onPress={back} label="Zamknij" style={{ backgroundColor: "#3D2612", borderColor: "#3D2612" }} />
      </View>
      <View style={s.hero}>
        <Motion kind="beat">
          <Icon name="flame" size={118} fill color={T.flame} />
        </Motion>
        <Motion kind="pop">
          <Num size={76} color={T.amber} ls={-3} lh={72}>
            {n}
          </Num>
        </Motion>
        <Display size={25} ls={-0.6} color={TONES.amber.txt}>
          {npl(n, "dzień", "dni", "dni").replace(/^\d+ /, "")} z rzędu
        </Display>
        <Muted size={14} color={TONES.amber.sub} center lh={20} style={{ maxWidth: 280 }}>
          {txt}
        </Muted>
        <Touch onPress={() => router.push({ pathname: "/weekly", params: { mode: "this" } })} accessibilityRole="button" hitSlop={8}>
          <Body size={12.5} weight={800} color={T.amber}>
            Historia serii
          </Body>
        </Touch>
      </View>
      <View style={{ marginHorizontal: 18, marginTop: 26 }}>
        <Card padding={0} radius={26} drop={5}>
          <View style={{ paddingVertical: 18, paddingHorizontal: 16 }}>
            <Eyebrow size={10.5}>Ten tydzień</Eyebrow>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
              {app.week.map((d, i) => {
                const on = d.active;
                const dot = on ? (
                  <View style={[s.day, { backgroundColor: T.flame }]}>
                    <Icon name="flame" size={19} fill color={T.onAmber} />
                  </View>
                ) : d.isToday ? (
                  <Motion kind="pulse">
                    <View style={[s.day, { backgroundColor: T.amber, borderWidth: 3, borderColor: TONES.amber.txt }]}>
                      <Icon name="flame" size={18} color={T.onAmber} />
                    </View>
                  </Motion>
                ) : (
                  <View style={[s.day, { backgroundColor: T.line2, borderWidth: 2, borderStyle: "dashed", borderColor: T.dash }]} />
                );
                return (
                  <View key={d.day} style={{ alignItems: "center", gap: 8 }}>
                    {on ? (
                      <Motion kind="up" d={Math.min(6, i + 1)}>
                        {dot}
                      </Motion>
                    ) : (
                      dot
                    )}
                    <Body size={11.5} weight={800} color={d.isToday ? TONES.amber.txt : d.future ? T.disabledTxt : T.muted}>
                      {d.label}
                    </Body>
                  </View>
                );
              })}
            </View>
          </View>
        </Card>
      </View>
      <View style={{ marginHorizontal: 18, marginTop: 14 }}>
        <Press onPress={() => router.push("/shop")} drop={4} edge={TONES.cyan.tintShadow} radius={22} faceStyle={s.freeze} accessibilityLabel={`Zamrożenia serii: ${fz}. Otwórz plecak`}>
          <IconTile icon="snow" size={44} tone="cyan" />
          <View style={{ flex: 1 }}>
            <Body size={14.5} weight={800}>
              Zamrażarka serii
            </Body>
            <Muted size={12.5} color={TONES.cyan.sub} style={{ marginTop: 2 }}>
              {fz ? `Masz ${fz} z ${FREEZE_MAX} — ratuje serię w wolny dzień` : "Nie masz żadnego — 100 gemów w plecaku"}
            </Muted>
          </View>
          <Icon name="chevron-right" size={20} color={TONES.cyan.sub} />
        </Press>
      </View>
      <View style={{ flex: 1, minHeight: 30 }} />
      <View style={{ paddingHorizontal: 18 }}>
        <Btn label="Wracam do nauki" tone="amber" glow onPress={back} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  topBg: { position: "absolute", top: 0, left: 0, right: 0, height: 420, backgroundColor: TONES.amber.tint },
  hero: { paddingHorizontal: 22, paddingTop: 8, alignItems: "center", gap: 14 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  freeze: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: TONES.cyan.tint, borderWidth: 2, borderColor: TONES.cyan.tintLine, paddingVertical: 14, paddingHorizontal: 16 },
});
