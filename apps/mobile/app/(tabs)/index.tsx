import { albumCount, dayDiff, levelProgress, questsSummary, todayStr } from "@nauka/shared";
import { useRouter } from "expo-router";
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccentProvider, useAccent } from "@/components/Accent";
import { Icon } from "@/components/Icon";
import { Bar, Motion } from "@/components/Motion";
import { Body, Display, Eyebrow, Muted } from "@/components/Text";
import { Blob, Card, Mono, Pill, Press, Screen, Sep, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { dateHeader, fmtNum, inDays, noEmoji } from "@/lib/format";
import type { PlanInfo } from "@/lib/plan";
import { splitKey, tpSub, tpTitle, TP_ICON } from "@/lib/tests";
import { T, TONES, accentOf } from "@/lib/theme";

const THEME_BLOB: Record<string, "violet" | "cyan" | "pink" | "gold" | "amber"> = { violet: "violet", cyan: "cyan", pink: "pink", gold: "gold", amber: "amber" };

/** „Dziś” (Main.html): logo + pigułki, plan na dziś (pasek + cel), mini-kafle, karta planu, kafle przedmiotów, [+] w nawigacji. */
export default function Main() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = todayStr();
  const testRows = app.tests
    .map((t) => {
      const s = app.findSubject(t.subjectId);
      if (!s) return null;
      const N = dayDiff(today, t.date);
      if (N < 0) return null;
      const r = t.plan.find((x) => x.date === today);
      const topics = app.topicsOf(s.id);
      if (N === 0) return { id: "test:" + t.id, done: false, icon: "calendar", title: "Sprawdzian dziś — powodzenia", sub: `${s.name} · plan zrobiony, teraz spokojnie`, reward: 0, go: () => router.push({ pathname: "/test-plan", params: { subjectId: s.id } }) };
      if (!r) return null;
      return {
        id: "test:" + t.id,
        done: !!r.done,
        icon: TP_ICON[r.kind],
        title: "Do sprawdzianu — " + tpTitle(r, topics),
        sub: `${s.name} · ${inDays(N)} · ${tpSub(r)}`,
        reward: 0,
        go: () => {
          if (r.done) return router.push({ pathname: "/test-plan", params: { subjectId: s.id } });
          if (r.kind === "rest") return app.showToast("Dziś wolne. Odpoczynek też się liczy", "check");
          if (r.kind === "learn") {
            const k = r.lv?.[0];
            if (k) {
              const { topicId, levelId } = splitKey(k);
              return router.push({ pathname: "/t/[topicId]/l/[levelId]", params: { topicId, levelId } });
            }
          }
          if (r.kind === "review" && r.short) return router.push({ pathname: "/cram", params: { subjectId: s.id } });
          if (r.kind === "review") return router.push({ pathname: "/review-run", params: { subjectId: s.id } });
          if (r.kind === "weak") return router.push({ pathname: "/review-run", params: { subjectId: s.id, deck: "1" } });
          return router.push({ pathname: "/s/[subjectId]/exam", params: { subjectId: s.id } });
        },
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const planRows = [
    ...testRows,
    ...app.planItems.map((p) => ({ id: p.task.id, done: p.task.done, icon: p.icon, title: p.title, sub: p.sub, reward: p.reward, go: () => goPlan(p), subjectId: p.subjectId })),
  ];
  const done = planRows.filter((r) => r.done).length,
    total = planRows.length;
  function goPlan(p: PlanInfo) {
    switch (p.kind) {
      case "lesson":
        return router.push({ pathname: "/t/[topicId]/l/[levelId]", params: { topicId: p.topicId!, levelId: p.levelId! } });
      case "review":
        return router.push({ pathname: "/review-run", params: { subjectId: p.subjectId } });
      case "quiz":
        return router.push({ pathname: "/t/[topicId]", params: { topicId: p.topicId!, tab: "quiz", levelId: p.levelId! } });
      case "exam":
        return router.push({ pathname: "/s/[subjectId]/exam", params: { subjectId: p.subjectId } });
      case "weak":
        return router.push({ pathname: "/review-run", params: { subjectId: p.subjectId, deck: "1" } });
    }
  }
  const qs = questsSummary(app.quests);
  const alb = albumCount(app.album, app.topics);
  const withP = app.subjects.filter((s) => app.topicsOf(s.id).some((t) => (app.progress[t.id]?.xp ?? 0) > 0));
  const rest = app.subjects.filter((s) => !withP.includes(s));
  const shown = [...withP, ...rest].slice(0, 5);
  let cur = false;

  return (
    <Screen pad={false} blob={<Blob tone={THEME_BLOB[app.extra.themes.active] ?? "violet"} size={300} top={-130} right={-100} />}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: Math.max(insets.top, 14) + 12, paddingBottom: 40 }]} refreshControl={<RefreshControl refreshing={app.refreshing} onRefresh={app.refresh} tintColor={T.acid} />} showsVerticalScrollIndicator={false}>
        <View style={s.head}>
          <Display size={21} ls={-0.8}>
            RECALL
            <Display size={21} color={T.acid}>
              .
            </Display>
          </Display>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pill kind="streak" value={app.streak} beat onPress={() => router.push("/streak")} />
            <Pill kind="gems" value={fmtNum(app.gems)} onPress={() => router.push("/shop")} />
          </View>
        </View>
        <View>
          <Eyebrow size={12}>{dateHeader()}</Eyebrow>
          <Display size={30} ls={-1} lh={32} style={{ marginTop: 6 }}>
            Plan na dziś
          </Display>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Bar pct={total ? (done / total) * 100 : 0} color={T.acid} style={{ flex: 1 }} />
          <Body size={12} weight={800} color={T.muted}>
            {done} z {total}
          </Body>
        </View>
        <Motion kind="up" d={1}>
          <Touch onPress={() => router.push("/goal")} accessibilityRole="button" accessibilityLabel={`Cel dzienny: ${app.todayXp} z ${app.dailyGoal} XP`} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon name="bolt" size={15} color={T.gold} />
            <Bar pct={app.goalPct} color={T.gold} height={8} d={2} style={{ flex: 1 }} />
            <Body size={12} weight={800} color={T.muted}>
              {app.todayXp} / {app.dailyGoal} XP
            </Body>
          </Touch>
        </Motion>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Mini tone="gold" icon="star" label={`Misje ${qs.done}/${qs.total}`} d={1} onPress={() => router.push("/missions")} />
          <Mini tone="amber" icon="flame" label={`Seria ${app.streak}`} d={2} onPress={() => router.push("/streak")} />
          <Mini tone="cyan" icon="cards" label={`Album ${alb.n}`} d={3} onPress={() => router.push("/album")} />
        </View>
        <Motion kind="up" d={2}>
          <Card padding={8} radius={24} drop={5}>
            {!planRows.length ? (
              <View style={s.prow}>
                <View style={[s.ptile, { backgroundColor: T.line2 }]}>
                  <Icon name="bulb" size={18} color={T.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Body color={T.txt2}>Brak zadań na dziś</Body>
                  <Muted style={{ marginTop: 2 }}>dodaj materiał, a plan ułoży się sam</Muted>
                </View>
              </View>
            ) : (
              planRows.map((r, i) => {
                let state: "done" | "cur" | "later" = "later";
                if (r.done) state = "done";
                else if (!cur) {
                  cur = true;
                  state = "cur";
                }
                const subj = "subjectId" in r ? app.findSubject((r as { subjectId: string }).subjectId) : app.findSubject(r.id.split(":")[0]!);
                const acc = accentOf(subj?.accent2, subj?.name);
                const row = (
                  <View style={[s.prow, state === "cur" && { backgroundColor: acc.tint, borderWidth: 2, borderColor: acc.tintLine, borderRadius: 18, marginVertical: 4, paddingVertical: 12 }]}>
                    <Motion kind={state === "cur" ? "pulse" : "none"}>
                      <View style={[s.ptile, { backgroundColor: state === "done" ? T.acid : state === "cur" ? acc.color : T.line2 }]}>
                        {state === "done" ? <Icon name="check" size={19} stroke={3.4} color={T.onAcid} /> : <Icon name={r.icon} size={19} stroke={state === "cur" ? 3 : 2.6} color={state === "cur" ? acc.on : T.muted} />}
                      </View>
                    </Motion>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Body size={state === "cur" ? 14.5 : 14} weight={state === "cur" ? 800 : 700} color={state === "done" ? "#7A74AA" : state === "cur" ? T.txt : T.txt2} style={state === "done" && { textDecorationLine: "line-through" }} numberOfLines={2}>
                        {r.title}
                      </Body>
                      {state !== "done" ? (
                        <Muted size={12} color={state === "cur" ? acc.sub : T.muted2} style={{ marginTop: 2 }} numberOfLines={1}>
                          {r.sub}
                        </Muted>
                      ) : null}
                    </View>
                    {state === "done" ? (
                      r.reward ? (
                        <Body size={12} weight={800} color={T.muted3}>
                          +{r.reward}
                        </Body>
                      ) : null
                    ) : (
                      <Icon name="chevron-right" size={20} color={state === "cur" ? acc.sub : T.muted2} />
                    )}
                  </View>
                );
                return (
                  <React.Fragment key={r.id}>
                    {i ? <Sep style={{ marginHorizontal: 10 }} /> : null}
                    <Touch onPress={r.go} accessibilityRole="button" accessibilityLabel={(state === "done" ? "Zrobione: " : "") + r.title}>
                      {row}
                    </Touch>
                  </React.Fragment>
                );
              })
            )}
          </Card>
        </Motion>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Eyebrow size={12}>Przedmioty</Eyebrow>
          <Touch onPress={() => router.push("/settings")} hitSlop={8} accessibilityRole="button">
            <Body size={12.5} weight={800} color={T.acid}>
              Zarządzaj
            </Body>
          </Touch>
        </View>
        <View style={s.grid}>
          {shown.map((sub, i) => {
            const topics = app.topicsOf(sub.id);
            const total = topics.reduce((a, t) => a + t.levels.length, 0);
            const done = topics.reduce((a, t) => a + t.levels.filter((l) => levelProgress(app.progressFor(t.id), l.id).done).length, 0);
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <AccentProvider key={sub.id} color={sub.accent2} seed={sub.name}>
                <SubjectTile name={sub.name} pct={pct} label={topics.length ? `${done} z ${total}` : "pusty"} d={i + 2} onPress={() => router.push({ pathname: "/s/[subjectId]", params: { subjectId: sub.id } })} />
              </AccentProvider>
            );
          })}
          <Touch onPress={() => router.push("/quick-add")} accessibilityRole="button" accessibilityLabel="Dodaj materiał" style={s.addTile}>
            <View style={[s.mono, { backgroundColor: T.line2 }]}>
              <Motion kind="bob">
                <Icon name="plus" size={22} stroke={3} color={T.acid} />
              </Motion>
            </View>
            <Body size={13} weight={800} color={T.acid} center lh={16}>
              Dodaj{"\n"}materiał
            </Body>
          </Touch>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Mini({ tone, icon, label, d, onPress }: { tone: "gold" | "amber" | "cyan"; icon: "star" | "flame" | "cards"; label: string; d: number; onPress: () => void }) {
  const set = TONES[tone];
  return (
    <Motion kind="up" d={d} style={{ flex: 1 }}>
      <Touch onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[s.mini, { backgroundColor: set.tint, borderColor: set.tintLine }]}>
        <Icon name={icon} size={17} stroke={2.6} fill={icon === "flame"} color={icon === "flame" ? T.flame : set.color} />
        <Body size={12.5} weight={800} color={set.txt} numberOfLines={1}>
          {label}
        </Body>
      </Touch>
    </Motion>
  );
}

function SubjectTile({ name, pct, label, d, onPress }: { name: string; pct: number; label: string; d: number; onPress: () => void }) {
  const acc = useAccent();
  return (
    <Press onPress={onPress} drop={4} edge={acc.tintShadow} radius={22} style={s.cell} faceStyle={[s.tile, { backgroundColor: acc.tint, borderColor: acc.tintLine }]} accessibilityLabel={`${name}, ${label}`}>
      <Mono text={name} size={44} />
      <Body size={13} weight={800} numberOfLines={1}>
        {noEmoji(name)}
      </Body>
      <Bar pct={pct} color={acc.color} track={acc.tintShadow} height={7} d={d} style={{ alignSelf: "stretch" }} />
      <Muted size={11} weight={700} color={acc.sub}>
        {label}
      </Muted>
    </Press>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 13 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  mini: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 2, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, minHeight: 44 },
  prow: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 11, paddingHorizontal: 10 },
  ptile: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { width: (390 - 40 - 20) / 3, flexGrow: 1, maxWidth: "32%" },
  tile: { paddingVertical: 14, paddingHorizontal: 10, alignItems: "center", gap: 9, borderWidth: 2, minHeight: 132 },
  addTile: { width: (390 - 40 - 20) / 3, flexGrow: 1, maxWidth: "32%", backgroundColor: T.surface2, borderWidth: 2, borderStyle: "dashed", borderColor: T.dash, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", gap: 9, minHeight: 136 },
  mono: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});
