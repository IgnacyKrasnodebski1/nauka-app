import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Bar, Motion } from "@/components/Motion";
import { Body, Display, Eyebrow, Muted, Num } from "@/components/Text";
import { Blob, Btn, Card, IconTile, Screen, useTop } from "@/components/ui";
import { comebackDays, useApp } from "@/lib/app-state";
import { noEmoji, npl } from "@/lib/format";
import { dueEntries } from "@/lib/srs-view";
import { T, TONES } from "@/lib/theme";

/** Powrót po przerwie (ComeBack.html): ile dni, seria od nowa, co czeka na powtórkę per przedmiot, rozgrzewka 5 minut. */
export default function ComeBack() {
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const d = Math.max(3, comebackDays(app.meta));
  const old = app.meta.streak;
  const { due } = useMemo(() => dueEntries(app), [app]);
  const bySub = app.subjects
    .map((s) => {
      const tids = new Set(app.topicsOf(s.id).map((t) => t.id));
      return { s, n: due.filter((e) => tids.has(e.topicId)).length };
    })
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  const max = bySub[0]?.n ?? 1;
  const first = app.planItems.find((p) => !p.task.done);
  const home = () => router.replace("/(tabs)");
  const start = () => {
    if (due.length) return router.replace({ pathname: "/review-run", params: { limit: "15" } });
    home();
  };
  return (
    <Screen scroll pad={false} bottom={26} blob={<Blob tone="pink" size={300} top={80} center />}>
      <View style={[s.wrap, { paddingTop: top + 12 }]}>
        <View style={{ alignItems: "center" }}>
          <Motion kind="sway">
            <View style={s.art}>
              <Icon name="clock" size={50} stroke={2} color={T.txt} />
            </View>
          </Motion>
        </View>
        <Motion kind="up" d={1} style={{ alignItems: "center" }}>
          <Display size={30} ls={-1.1} center lh={33}>
            Nie było cię {npl(d, "dzień", "dni", "dni")}
          </Display>
          <Muted size={14} center lh={21} style={{ marginTop: 9 }}>
            Bez dramatu — wracamy od małego kroku. Pięć minut dziś znaczy więcej niż godzina kiedyś.
          </Muted>
        </Motion>
        {old > 0 ? (
          <Motion kind="up" d={2}>
            <View style={s.streak}>
              <Icon name="flame" size={42} fill color={T.flame} />
              <View style={{ flex: 1 }}>
                <Body size={14.5} weight={800} color={TONES.amber.txt}>
                  Seria zaczyna się od nowa
                </Body>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 9, marginTop: 4 }}>
                  <Num size={22} color={T.muted2} style={{ textDecorationLine: "line-through" }}>
                    {old}
                  </Num>
                  <Icon name="chevron-right" size={16} stroke={2.8} color={T.muted2} />
                  <Motion kind="pop" d={3}>
                    <Num size={22} color={T.amber}>
                      0
                    </Num>
                  </Motion>
                </View>
              </View>
            </View>
          </Motion>
        ) : null}
        <Motion kind="up" d={3}>
          <Card padding={17} radius={24} drop={5}>
            {bySub.length ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Eyebrow>Czeka na powtórkę</Eyebrow>
                  <Body size={12} weight={800} color="#FF8FA3">
                    {npl(due.length, "pojęcie", "pojęcia", "pojęć")}
                  </Body>
                </View>
                <View style={{ gap: 10, marginTop: 13 }}>
                  {bySub.map((x, i) => (
                    <View key={x.s.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Body size={12.5} color={T.txt2} style={{ width: 74 }} numberOfLines={1}>
                        {noEmoji(x.s.name)}
                      </Body>
                      <Bar pct={(x.n / max) * 100} color={i === 0 ? T.red : i === 1 ? T.gold : T.acid} height={12} d={i + 2} style={{ flex: 1 }} />
                      <Body size={12} weight={800} color={i === 0 ? "#FF8FA3" : i === 1 ? "#FFD98A" : "#C6F58A"} style={{ width: 34, textAlign: "right" }}>
                        {x.n}
                      </Body>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Eyebrow>Nic nie przepadło</Eyebrow>
                <Muted size={13} lh={19} style={{ marginTop: 8 }}>
                  Pojęcia wrócą do powtórki we właściwym dniu. Zacznij od planu na dziś.
                </Muted>
              </>
            )}
          </Card>
        </Motion>
        <Motion kind="up" d={4}>
          <Card tone="acid" padding={16} radius={24} drop={5}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
              <IconTile icon="bolt" size={46} tone="acid" kind="pulse" />
              <View style={{ flex: 1 }}>
                <Body size={15} weight={800} color={TONES.acid.txt}>
                  Zacznij od 5 minut
                </Body>
                <Muted size={12.5} color={TONES.acid.sub} lh={17} style={{ marginTop: 3 }}>
                  {due.length ? `${npl(Math.min(15, due.length), "pojęcie", "pojęcia", "pojęć")} z powtórki — bez nowych rzeczy` : first ? first.title : "jedno zadanie z planu dnia"}
                </Muted>
              </View>
            </View>
          </Card>
        </Motion>
        <View style={{ flex: 1 }} />
        <View style={{ gap: 10 }}>
          <Btn label="Zacznij od 5 minut" glow onPress={start} />
          <Btn label="Normalny plan dnia" variant="text" onPress={home} />
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 22, gap: 18 },
  art: { width: 104, height: 104, borderRadius: 34, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, alignItems: "center", justifyContent: "center" },
  streak: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: TONES.amber.tint, borderWidth: 2, borderColor: TONES.amber.tintLine, borderRadius: 24, padding: 16 },
});
