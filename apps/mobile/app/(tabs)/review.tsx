import { dayDiff, srsBox } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Icon } from "@/components/Icon";
import { Bar, Motion } from "@/components/Motion";
import { Body, Eyebrow, Muted, Num } from "@/components/Text";
import { Blob, Btn, Card, Mono, Press, Screen, TopBar, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { noEmoji, npl, todayIso } from "@/lib/format";
import { dueEntries } from "@/lib/srs-view";
import { T, TONES } from "@/lib/theme";

/** Powtórka (Review.html): licznik na dziś, „Z czego” per przedmiot, stan pamięci (świeże / w trakcie / utrwalone), start. */
export default function Review() {
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const { due, all } = useMemo(() => dueEntries(app), [app]);
  const n = due.length,
    tot = all.length;
  const st = useMemo(() => {
    const o = { fresh: 0, mid: 0, firm: 0 };
    for (const e of all) {
      const b = srsBox(e.card);
      if (b === 0) o.fresh++;
      else if (b <= 2) o.mid++;
      else o.firm++;
    }
    return o;
  }, [all]);
  const bySubj = app.subjects
    .map((s) => {
      const tids = new Set(app.topicsOf(s.id).map((t) => t.id));
      const mine = due.filter((d) => tids.has(d.topicId));
      return { s, mine };
    })
    .filter((x) => x.mine.length)
    .sort((a, b) => b.mine.length - a.mine.length);
  const fut = all.map((e) => e.card.due).filter((d) => d > todayIso()).sort();
  const nextDue = fut.length ? Math.max(1, dayDiff(todayIso(), fut[0]!)) : 0;
  const ndText = nextDue === 1 ? "jutro" : nextDue ? `za ${npl(nextDue, "dzień", "dni", "dni")}` : "";

  return (
    <Screen scroll pad={false} blob={<Blob tone="cyan" size={270} top={-100} left={-90} />} bottom={40}>
      <View style={[s.wrap, { paddingTop: top }]}>
        <TopBar title="Powtórka" onBack={() => router.navigate("/(tabs)")} />
        <Card tone="cyan" padding={20} radius={26} drop={6}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
            <View style={{ flex: 1 }}>
              <Motion kind="pop">
                <Num size={44} color={T.cyan} ls={-1.6}>
                  {n}
                </Num>
              </Motion>
              <Body size={14} weight={800} color={TONES.cyan.txt} style={{ marginTop: 6 }}>
                {n ? npl(n, "pojęcie na dziś", "pojęcia na dziś", "pojęć na dziś").replace(/^\d+ /, "") : "nic na dziś"}
              </Body>
              <Muted size={12.5} color={TONES.cyan.sub} lh={17} style={{ marginTop: 4 }}>
                {n ? "Zaplanowane tak, żeby wróciły tuż przed zapomnieniem." : tot ? `Wszystko na dziś przejrzane.${ndText ? ` Najbliższa powtórka ${ndText}.` : ""}` : "Ucz się z fiszek i lekcji — pojęcia wrócą tu we właściwym dniu."}
              </Muted>
            </View>
            <Motion kind={n ? "spin" : "none"}>
              <Icon name="refresh" size={58} stroke={1.8} color={T.cyan} />
            </Motion>
          </View>
        </Card>
        {n ? (
          <>
            <Eyebrow>Z czego</Eyebrow>
            <View style={{ gap: 10 }}>
              {bySubj.map(({ s: sub, mine }, i) => {
                const lv = [...new Set(mine.map((m) => m.lvl))];
                return (
                  <AccentProvider key={sub.id} color={sub.accent2} seed={sub.name}>
                    <Motion kind="up" d={Math.min(6, i + 1)}>
                      <Press onPress={() => router.push({ pathname: "/review-run", params: { subjectId: sub.id } })} drop={4} edge={T.shadow} radius={20} faceStyle={s.rvrow} accessibilityLabel={`${sub.name}: ${mine.length} do powtórki`}>
                        <Mono text={sub.name} size={40} />
                        <View style={{ flex: 1 }}>
                          <Body size={14} weight={800}>
                            {noEmoji(sub.name)}
                          </Body>
                          <Muted style={{ marginTop: 2 }} numberOfLines={1}>
                            {lv.slice(0, 2).join(" · ")}
                            {lv.length > 2 ? ` · +${lv.length - 2}` : ""}
                          </Muted>
                        </View>
                        <Body size={16} weight={800} color={T.txt}>
                          {mine.length}
                        </Body>
                      </Press>
                    </Motion>
                  </AccentProvider>
                );
              })}
            </View>
          </>
        ) : null}
        <Eyebrow>Stan pamięci</Eyebrow>
        <Motion kind="up" d={3}>
          <Card padding={16}>
            <View style={{ gap: 12 }}>
              {(
                [
                  ["Świeże", TONES.red.txt, T.red, st.fresh, 1],
                  ["W trakcie", TONES.gold.txt, T.gold, st.mid, 2],
                  ["Utrwalone", "#C6F58A", T.acid, st.firm, 3],
                ] as [string, string, string, number, number][]
              ).map(([lab, lc, bc, v, d]) => (
                <View key={lab} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Body size={12.5} color={lc} style={{ width: 78 }}>
                    {lab}
                  </Body>
                  <Bar pct={tot ? (v / tot) * 100 : 0} color={bc} height={12} d={d} style={{ flex: 1 }} />
                  <Body size={12} weight={800} color={T.muted} style={{ width: 26, textAlign: "right" }}>
                    {v}
                  </Body>
                </View>
              ))}
              {!tot ? <Muted lh={17}>Jeszcze nic w powtórce. Każda fiszka i każde pytanie, na które odpowiesz, trafia tutaj.</Muted> : null}
            </View>
          </Card>
        </Motion>
        <View style={{ marginTop: 4 }}>{n ? <Btn label="Zacznij powtórkę" tone="cyan" glow onPress={() => router.push("/review-run")} /> : <Btn label="Przejrzyj fiszki" variant="ghost" onPress={() => router.navigate("/(tabs)/cards")} />}</View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 16 },
  rvrow: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, paddingVertical: 13, paddingHorizontal: 15 },
});
