import type { LeaderboardRow } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Display, Eyebrow, Muted } from "@/components/Text";
import { Blob, Btn, Loading, Note, RoundBtn, Screen, TopBar, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { fmtNum, initials, npl } from "@/lib/format";
import { T, TONES } from "@/lib/theme";

const AV = [T.pink, T.cyan, T.amber, T.violet, T.gold, T.red];

/** Liga tygodniowa (League.html): ranking XP z `weekly_leaderboard` (RPC), top 3 = awans, ty podświetlony; koniec w niedzielę. */
export default function League() {
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    app
      .fetchLeaderboard(50)
      .then((r) => alive && setRows(r))
      .catch((e: unknown) => alive && setErr(e instanceof Error ? e.message : "Nie udało się pobrać ligi"));
    return () => {
      alive = false;
    };
  }, [app]);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"));
  const now = new Date();
  const toSunday = 7 - ((now.getDay() + 6) % 7);
  const hours = 24 - now.getHours();
  const me = rows?.find((r) => r.isMe);
  const above = me && rows ? rows.find((r) => r.rank === me.rank - 1) : null;
  return (
    <Screen scroll pad={false} bottom={40} blob={<Blob tone="cyan2" size={300} top={40} center />}>
      <View style={[s.wrap, { paddingTop: top }]}>
        <TopBar title="Liga tygodniowa" onBack={back} right={<RoundBtn icon="users" onPress={() => router.push("/friends")} label="Znajomi" />} />
        <View style={{ alignItems: "center", gap: 8, paddingTop: 6 }}>
          <Motion kind="sway">
            <Icon name="trophy" size={72} stroke={1.8} color={T.cyan} />
          </Motion>
          <Display size={26} ls={-0.8} color="#7EE8FA">
            Dywizja {app.rank.name}
          </Display>
          <Motion kind="blink">
            <Muted size={12.5} weight={700}>
              kończy się za {npl(toSunday - 1, "dzień", "dni", "dni")} {npl(hours, "godzinę", "godziny", "godzin")}
            </Muted>
          </Motion>
        </View>
        {!app.showOnLeaderboard ? <Note tone="gold" icon="eye" text="Nie pokazujesz się w lidze. Włącz to w Ustawieniach, żeby konkurować z innymi." /> : null}
        {err ? <Note tone="red" icon="alert" text={`Liga niedostępna: ${err}`} /> : null}
        {!rows && !err ? <Loading label="pobieram ranking…" /> : null}
        {rows && !rows.length ? (
          <View style={{ alignItems: "center", gap: 8, padding: 24 }}>
            <Icon name="trophy" size={26} stroke={2.2} color={T.muted} />
            <Body size={15} weight={800}>
              Jeszcze pusto
            </Body>
            <Muted center>Zdobądź XP w tym tygodniu, a pojawisz się tutaj.</Muted>
          </View>
        ) : null}
        {rows?.length ? (
          <View style={{ gap: 7 }}>
            <Eyebrow size={10.5} color="#7FA352">
              Awans
            </Eyebrow>
            {rows.map((r, i) => {
              const promo = r.rank <= 3;
              const isMe = r.isMe;
              const color = isMe ? T.acid : AV[i % AV.length]!;
              return (
                <Motion key={`${r.rank}-${r.displayName}`} kind={isMe ? "pop" : "up"} d={Math.min(6, i + 1)}>
                  {r.rank === 4 ? <View style={{ height: 6 }} /> : null}
                  <View style={[s.row, promo && !isMe && { backgroundColor: TONES.acid.tint, borderColor: TONES.acid.tintLine }, isMe && s.me]}>
                    <Body size={isMe ? 16 : 14} weight={800} color={isMe ? "#D6B4F5" : promo ? T.acid : T.muted} style={{ width: 24 }}>
                      {r.rank}
                    </Body>
                    <View style={[s.av, { backgroundColor: color, width: isMe ? 38 : 34, height: isMe ? 38 : 34 }]}>
                      <Body size={13} weight={800} color={T.bg}>
                        {initials(r.displayName)}
                      </Body>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Body size={isMe ? 14.5 : 13.5} weight={isMe ? 800 : 700} color={isMe ? T.txt : promo ? TONES.acid.txt : T.txt2} numberOfLines={1}>
                        {isMe ? "Ty" : r.displayName}
                      </Body>
                      {isMe && above ? (
                        <Muted size={11.5} weight={700} color="#C0A8D8" style={{ marginTop: 2 }}>
                          {fmtNum(Math.max(0, above.xp - r.xp + 1))} XP do awansu
                        </Muted>
                      ) : null}
                    </View>
                    <Body size={isMe ? 15 : 13} weight={800} color={isMe ? T.txt : promo ? "#A8C98A" : T.muted}>
                      {fmtNum(r.xp)}
                    </Body>
                  </View>
                </Motion>
              );
            })}
          </View>
        ) : null}
        <Btn label="Wracam do nauki" variant="ghost" onPress={back} style={{ marginTop: 6 }} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 13 },
  me: { backgroundColor: TONES.violet.tint, borderColor: T.violet, borderRadius: 18, padding: 13, shadowColor: "#12081C", shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 5 } },
  av: { borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
