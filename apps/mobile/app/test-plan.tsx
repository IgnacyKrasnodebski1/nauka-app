import { dayDiff, isLevelUnlocked, levelProgress, todayStr } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Display, Eyebrow, Muted, Num } from "@/components/Text";
import { Btn, Card, Empty, Ring, Screen, Sheet, TopBar, Touch, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { DAYS, DAYS_S, MONTHS_S, dateOf, fmtDate, inDays, noEmoji } from "@/lib/format";
import { TP_ICON, hasWeakDeck, splitKey, tpSub, tpTitle, type PlanRow } from "@/lib/tests";
import { T, TONES } from "@/lib/theme";
import { topicShort } from "@/lib/topic-view";

/** Plan do sprawdzianu (TestPlan.html): gotowość, dni planu (dziś podświetlone, pominięte przeliczone), sprawdzian, usuń plan. */
export default function TestPlanScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const [del, setDel] = useState(false);
  const subject = app.findSubject(subjectId ?? "");
  const test = app.testFor(subjectId ?? "");
  const topics = app.topicsOf(subjectId ?? "");
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  if (!subject || !test)
    return (
      <Screen>
        <Empty icon="calendar" title="Brak planu" text="Ułóż plan do sprawdzianu z arkusza „Mam sprawdzian”." action={<Btn label="Wróć" onPress={back} />} />
      </Screen>
    );
  const today = todayStr();
  const N = dayDiff(today, test.date);
  const total = test.levels.length;
  const done = test.levels.filter((k) => {
    const { topicId, levelId } = splitKey(k);
    return levelProgress(app.progressFor(topicId), levelId).done;
  }).length;
  const rec = app.examRec(subject.id);
  const ready = Math.round(((total ? done / total : 0) * 0.6 + ((rec.best?.pct ?? 0) / 100) * 0.4) * 100);
  const d = dateOf(test.date);
  const allKeys = topics.flatMap((t) => t.levels.map((l) => `${t.id}:${l.id}`));
  const scope = total === allKeys.length ? "cały przedmiot" : test.levels.map((k) => { const { topicId, levelId } = splitKey(k); const t = topics.find((x) => x.id === topicId); const l = t?.levels.find((x) => x.id === levelId); return l ? noEmoji(l.title) : ""; }).filter(Boolean).join(", ");
  const todayRow = test.plan.find((r) => r.date === today);
  const action = (r: PlanRow) => {
    if (r.kind === "rest") return app.showToast("Dziś wolne. Odpoczynek też się liczy", "check");
    if (r.kind === "learn") {
      const key = (r.lv ?? []).find((k) => { const { topicId, levelId } = splitKey(k); return !levelProgress(app.progressFor(topicId), levelId).done; }) ?? r.lv?.[0];
      if (!key) return;
      const { topicId, levelId } = splitKey(key);
      const t = topics.find((x) => x.id === topicId);
      if (!t) return;
      if (!isLevelUnlocked(t, app.progressFor(topicId), levelId)) {
        app.showToast("Najpierw zalicz poprzedni poziom", "lock");
        return router.push({ pathname: "/t/[topicId]", params: { topicId } });
      }
      return router.push({ pathname: "/t/[topicId]/l/[levelId]", params: { topicId, levelId } });
    }
    if (r.kind === "review" && r.short) return router.push({ pathname: "/cram", params: { subjectId: subject.id } });
    if (r.kind === "review") return router.push({ pathname: "/review-run", params: { subjectId: subject.id } });
    if (r.kind === "weak" && hasWeakDeck(app.weak, topics)) return router.push({ pathname: "/review-run", params: { subjectId: subject.id, deck: "1" } });
    return router.push({ pathname: "/s/[subjectId]/exam", params: { subjectId: subject.id, levels: test.levels.join(","), n: String(r.n ?? 20) } });
  };
  return (
    <AccentProvider color={subject.accent2} seed={subject.name}>
      <Screen scroll pad={false} bottom={26}>
        <View style={[s.wrap, { paddingTop: top }]}>
          <TopBar title="Plan do sprawdzianu" onBack={back} />
          <Motion kind="up">
            <Card padding={16} radius={24} drop={5}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <Motion kind="pop">
                  <Ring pct={ready} size={84} stroke={8} color={T.gold}>
                    <Num size={22} color={T.gold}>
                      {ready}%
                    </Num>
                    <Eyebrow size={9.5} color={T.muted} style={{ marginTop: 2 }}>
                      gotowość
                    </Eyebrow>
                  </Ring>
                </Motion>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Body size={12} weight={800} color={T.muted} numberOfLines={1}>
                    {noEmoji(subject.name)} · {scope}
                  </Body>
                  <Display size={22} ls={-0.6} style={{ marginTop: 4 }}>
                    {DAYS[d.getDay()]!.toLowerCase()}, {d.getDate()} {MONTHS_S[d.getMonth()]}
                  </Display>
                  <Motion kind="blink">
                    <Body size={13} weight={800} color="#FF8FA3" style={{ marginTop: 3 }}>
                      {inDays(N)}
                    </Body>
                  </Motion>
                </View>
              </View>
            </Card>
          </Motion>
          <View style={{ gap: 8 }}>
            {test.plan.map((r, i) => {
              const dd = dateOf(r.date);
              const past = r.date < today,
                now = r.date === today;
              const rest = r.kind === "rest";
              const face = now ? { backgroundColor: TONES.acid.tint, borderColor: T.acid, shadowColor: T.acidDark } : rest ? { backgroundColor: T.surface2, borderColor: T.line, borderStyle: "dashed" as const } : past && !r.done ? { opacity: 0.55 } : null;
              const tc = now ? TONES.acid.txt : rest || past ? "#7A74AA" : T.txt;
              const sc = now ? TONES.acid.sub : rest || past ? "#4E4778" : T.muted;
              return (
                <Motion key={r.date} kind={now ? "pop" : "up"} d={now ? 0 : Math.min(6, i + 1)}>
                  <Touch onPress={() => (past ? app.showToast(r.done ? "Zrobione" : "Ten dzień minął — plan przeliczony", "calendar") : action(r))} accessibilityRole="button" accessibilityLabel={`${fmtDate(r.date)}: ${tpTitle(r, topics)}`} style={[s.row, face, now && s.rowNow]}>
                    <View style={{ width: 40, alignItems: "center" }}>
                      <Eyebrow size={11} color={now ? T.acid : sc}>
                        {DAYS_S[dd.getDay()]}
                      </Eyebrow>
                      <Display size={18} color={tc}>
                        {dd.getDate()}
                      </Display>
                    </View>
                    <View style={[s.ico, now && { backgroundColor: T.acid }]}>
                      <Icon name={r.done ? "check" : TP_ICON[r.kind]} size={18} stroke={r.done ? 3.4 : 2.4} color={now ? T.onAcid : tc} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Body size={13.5} weight={800} color={tc}>
                        {tpTitle(r, topics)}
                      </Body>
                      <Muted size={11.5} color={sc} style={{ marginTop: 2 }}>
                        {past && !r.done ? "pominięte — plan przeliczony" : tpSub(r)}
                      </Muted>
                    </View>
                    {now ? (
                      <Motion kind={r.done ? "none" : "blink"}>
                        <View style={s.badge}>
                          <Body size={10} weight={800} color={T.onAcid} ls={1}>
                            {r.done ? "ZROBIONE" : "DZIŚ"}
                          </Body>
                        </View>
                      </Motion>
                    ) : null}
                  </Touch>
                </Motion>
              );
            })}
            <Motion kind="up" d={6}>
              <View style={[s.row, { borderColor: TONES.red.tintLine, backgroundColor: TONES.red.tint }]}>
                <View style={{ width: 40, alignItems: "center" }}>
                  <Eyebrow size={11} color={TONES.red.sub}>
                    {DAYS_S[d.getDay()]}
                  </Eyebrow>
                  <Display size={18} color={TONES.red.txt}>
                    {d.getDate()}
                  </Display>
                </View>
                <View style={[s.ico, { backgroundColor: T.red }]}>
                  <Icon name="flag" size={18} color={T.onRed} />
                </View>
                <View style={{ flex: 1 }}>
                  <Body size={13.5} weight={800} color={TONES.red.txt}>
                    Sprawdzian
                  </Body>
                  <Muted size={11.5} color={TONES.red.sub} style={{ marginTop: 2 }}>
                    powodzenia
                  </Muted>
                </View>
                {N === 0 ? (
                  <View style={[s.badge, { backgroundColor: T.red }]}>
                    <Body size={10} weight={800} color={T.onRed} ls={1}>
                      DZIŚ
                    </Body>
                  </View>
                ) : null}
              </View>
            </Motion>
          </View>
          <Muted size={12} center lh={17}>
            Opuścisz dzień? Plan sam się przeliczy. Nauka i powtórki z planu liczą się też do planu dnia.
          </Muted>
          <View style={{ gap: 10, marginTop: 4 }}>
            {todayRow && !todayRow.done && todayRow.kind !== "rest" ? <Btn label="Zacznij dzisiejsze" glow onPress={() => action(todayRow)} /> : <Btn label={N === 0 ? "Powodzenia" : "Na dziś wszystko"} variant="ghost" onPress={back} />}
            <Btn label="Usuń plan" variant="text" onPress={() => setDel(true)} />
          </View>
        </View>
        <Sheet open={del} onClose={() => setDel(false)} tone="red" bg={T.surface2}>
          <Display size={22} ls={-0.6}>
            Usunąć plan do sprawdzianu?
          </Display>
          <Muted size={13} lh={19}>
            {topicShort({ name: subject.name, short: "" })} · {fmtDate(test.date)}. Data sprawdzianu zniknie z przedmiotu.
          </Muted>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <Btn label="Zostaw" variant="ghost" onPress={() => setDel(false)} style={{ flex: 1 }} />
            <Btn label="Usuń" variant="danger" onPress={() => { app.removeTestPlan(test.id); setDel(false); app.showToast("Plan usunięty", "close"); router.replace("/(tabs)"); }} style={{ flex: 1 }} />
          </View>
        </Sheet>
      </Screen>
    </AccentProvider>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 18, paddingVertical: 11, paddingHorizontal: 13 },
  rowNow: { shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 } },
  ico: { width: 36, height: 36, borderRadius: 12, backgroundColor: T.line2, alignItems: "center", justifyContent: "center" },
  badge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: T.acid },
});
