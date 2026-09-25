import { ACHIEVEMENTS, dayDiff, levelProgress, todayStr } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Icon } from "@/components/Icon";
import { Bar, Motion } from "@/components/Motion";
import { Body, Display, Eyebrow, Muted, Num } from "@/components/Text";
import { Blob, Card, ListCard, Mono, RoundBtn, Row, Screen, SectionHead, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { dateFromIso, firstName, fmtDate, fmtNum, initials, noEmoji, nowMs, npl } from "@/lib/format";
import { T, TONES, type Tone } from "@/lib/theme";

const BADGE_TONE: Record<string, Tone> = { flame: "amber", trophy: "gold", star: "gold", zap: "pink", bolt: "pink", cards: "cyan", boss: "violet", calendar: "cyan", map: "acid", check: "acid", flag: "acid", layers: "cyan", target: "gold", gift: "gold", moon: "violet", sun: "gold", sparkles: "pink" };

/** Profil (Profile.html): awatar-monogram, ranga, 4 statystyki, aktywność 8 tygodni, odznaki, razem z innymi, XP w przedmiotach. */
export default function Profile() {
  const app = useApp();
  const auth = useAuth();
  const router = useRouter();
  const top = useTop();
  const name = firstName(app.displayName, auth.user?.email);
  const mono = initials(app.displayName, auth.user?.email);
  const since = (() => {
    const created = auth.user?.created_at ? dateFromIso(auth.user.created_at) : null;
    if (!created) return "";
    const days = Math.max(0, Math.round((nowMs() - created.getTime()) / 86400000));
    if (days < 30) return `Uczy się od ${npl(Math.max(1, days), "dnia", "dni", "dni")}`;
    const m = Math.round(days / 30);
    return `Uczy się od ${npl(m, "miesiąca", "miesięcy", "miesięcy")}`;
  })();
  const st = app.meta.stats;
  const answered = st.cardsReviewed + st.levelsDone * 6;
  const weekXp = app.week.reduce((a, d) => a + d.xp, 0);
  const minutes = Object.values(app.store?.activity ?? {}).reduce((a, d) => a + d.minutes, 0);
  const hours = Math.round(minutes / 60);
  const daysActive = Object.values(app.store?.activity ?? {}).filter((d) => d.xp > 0).length;
  const started = app.subjects.filter((s) => app.topicsOf(s.id).some((t) => (app.progress[t.id]?.xp ?? 0) > 0));
  const heat = useMemo(() => heatmap(app.store?.activity ?? {}, app.extra.history), [app.store?.activity, app.extra.history]);
  const unlocked = app.achievements;
  const badges = [...ACHIEVEMENTS].sort((a, b) => (unlocked.has(b.key) ? 1 : 0) - (unlocked.has(a.key) ? 1 : 0)).slice(0, 6);
  const levelsDone = app.topics.reduce((a, t) => a + t.levels.filter((l) => levelProgress(app.progressFor(t.id), l.id).done).length, 0);
  const levelsTotal = app.topics.reduce((a, t) => a + t.levels.length, 0);

  return (
    <Screen scroll pad={false} blob={<Blob tone="violet" size={280} top={-120} right={-90} />} bottom={40}>
      <View style={[s.wrap, { paddingTop: top }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Display size={18} ls={-0.4}>
            Profil
          </Display>
          <RoundBtn icon="settings" onPress={() => router.push("/settings")} label="Ustawienia" />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Motion kind="pop">
            <View style={s.avatar}>
              <Display size={30} color={T.onAcid}>
                {mono}
              </Display>
            </View>
          </Motion>
          <View style={{ flex: 1 }}>
            <Display size={23} ls={-0.7}>
              {name}
            </Display>
            <Muted size={12.5} style={{ marginTop: 3 }}>
              {since || app.rank.name}
            </Muted>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
              <Bar pct={app.rank.pct} color={app.rank.color} height={9} d={2} style={{ flex: 1 }} />
              <Body size={11.5} weight={800} color={T.muted}>
                {app.rank.name}
              </Body>
            </View>
          </View>
        </View>
        <View style={s.grid}>
          <Stat d={1} icon="flame" iconColor={T.flame} beat k="Seria" v={npl(app.streak, "dzień", "dni", "dni")} sub={`rekord ${Math.max(app.meta.best, app.streak)}`} onPress={() => router.push("/streak")} />
          <Stat d={2} icon="bolt" iconColor={T.gold} k="XP łącznie" v={fmtNum(app.totalXp)} sub={`+${weekXp} w tym tygodniu`} />
          <Stat d={3} icon="check" iconColor={T.acid} k="Poziomy" v={String(levelsDone)} sub={`z ${levelsTotal} zaliczone`} />
          <Stat d={4} icon="clock" iconColor={T.cyan} k="Czas nauki" v={hours ? `${hours} h` : `${minutes} min`} sub={daysActive ? `średnio ${Math.round(minutes / daysActive)} min dziennie` : `${answered} odpowiedzi`} />
        </View>
        <SectionHead label="Aktywność — 8 tygodni" link="Twój tydzień" onLink={() => router.push("/weekly")} />
        <Card padding={16}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 6 }} accessibilityLabel="Aktywność w ostatnich 8 tygodniach">
            {heat.map((col, w) => (
              <View key={w} style={{ gap: 6, flex: 1 }}>
                {col.map((c, d) => (
                  <View key={d} style={[s.cell, { backgroundColor: c === 3 ? T.acid : c === 2 ? T.acidDark : c === 1 ? "#3E6B1E" : c === -1 ? "#1C1938" : T.line2 }]} />
                ))}
              </View>
            ))}
          </View>
        </Card>
        <SectionHead label="Odznaki" link="Album pojęć" onLink={() => router.push("/album")} />
        <View style={s.badges}>
          {badges.map((b) => {
            const on = unlocked.has(b.key);
            const tone = TONES[BADGE_TONE[b.icon] ?? "acid"];
            return (
              <View key={b.key} style={[s.badge, on ? { backgroundColor: tone.tint, borderColor: tone.tintLine } : { backgroundColor: T.surface2, borderColor: T.dash, borderStyle: "dashed" }]} accessibilityLabel={b.title + (on ? "" : ": zablokowana")}>
                <Icon name={on ? b.icon : "lock"} size={28} stroke={2.4} color={on ? tone.color : T.muted3} />
                <Body size={11} weight={800} color={on ? tone.txt : T.muted3} center numberOfLines={2} style={{ marginTop: 6 }}>
                  {b.title}
                </Body>
              </View>
            );
          })}
        </View>
        <Eyebrow>Razem z innymi</Eyebrow>
        <Motion kind="up" d={4}>
          <ListCard>
            <Row icon="trophy" iconColor={T.gold} title="Liga tygodniowa" sub="ranking XP z innymi uczącymi się" onPress={() => router.push("/league")} />
            <Row icon="users" iconColor={T.pink} title="Znajomi" sub="kody, zaproszenia, wspólny tydzień · wkrótce" onPress={() => router.push("/friends")} />
          </ListCard>
        </Motion>
        <SectionHead label="XP w przedmiotach" link="Wszystkie" onLink={() => router.push("/settings")} />
        <Motion kind="up" d={5}>
          <ListCard>
            {started.map((sub) => (
              <AccentProvider key={sub.id} color={sub.accent2} seed={sub.name}>
                <Row left={<Mono text={sub.name} size={32} />} title={noEmoji(sub.name)} value={`${fmtNum(app.topicsOf(sub.id).reduce((a, t) => a + (app.progress[t.id]?.xp ?? 0), 0))} xp`} valueColor={T.txt2} onPress={() => router.push({ pathname: "/s/[subjectId]", params: { subjectId: sub.id } })} />
              </AccentProvider>
            ))}
            {!started.length ? <Row title="Jeszcze nic — zacznij od planu na dziś." titleColor={T.muted} /> : null}
          </ListCard>
        </Motion>
        <Muted size={11.5} center>
          {app.plan === "pro" ? "Plan Pro" : "Plan darmowy"} · {auth.user?.email ?? ""}
        </Muted>
      </View>
    </Screen>
  );
}

function Stat({ d, icon, iconColor, k, v, sub, onPress, beat }: { d: number; icon: string; iconColor: string; k: string; v: string; sub: string; onPress?: () => void; beat?: boolean }) {
  return (
    <Motion kind="up" d={d} style={s.statCell}>
      <Card padding={15} onPress={onPress}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          {beat ? (
            <Motion kind="beat">
              <Icon name={icon} size={16} color={iconColor} />
            </Motion>
          ) : (
            <Icon name={icon} size={16} color={iconColor} stroke={2.8} />
          )}
          <Eyebrow size={10.5}>{k}</Eyebrow>
        </View>
        <Num size={30} style={{ marginTop: 8 }} numberOfLines={1} adjustsFontSizeToFit>
          {v}
        </Num>
        <Muted size={11.5} style={{ marginTop: 2 }} numberOfLines={1}>
          {sub}
        </Muted>
      </Card>
    </Motion>
  );
}

/** 8 kolumn (tygodnie) × 7 dni; intensywność z XP dnia (0/1/2/3), -1 = przyszłość. */
function heatmap(activity: Record<string, { xp: number }>, history: Record<string, { levels: number }>): number[][] {
  const t = todayStr();
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const out: number[][] = [];
  for (let w = 0; w < 8; w++) {
    const col: number[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - (7 - w) * 7 + d);
      const ds = todayStr(dt);
      if (dayDiff(ds, t) < 0) col.push(-1);
      else {
        const xp = (activity[ds]?.xp ?? 0) + (history[ds]?.levels ?? 0) * 10;
        col.push(xp >= 100 ? 3 : xp >= 40 ? 2 : xp > 0 ? 1 : 0);
      }
    }
    out.push(col);
  }
  return out;
}

export const _fmtDate = fmtDate;

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 16 },
  avatar: { width: 72, height: 72, borderRadius: 24, backgroundColor: T.acid, alignItems: "center", justifyContent: "center", shadowColor: T.acidDark, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 5 } },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
  statCell: { width: "47%", flexGrow: 1 },
  cell: { height: 12, borderRadius: 4 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
  badge: { width: "30%", flexGrow: 1, borderWidth: 2, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 8, alignItems: "center" },
});
