import { dayDiff, todayStr } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Icon } from "@/components/Icon";
import { Body, Display, Eyebrow, Muted } from "@/components/Text";
import { Btn, Chip, Mono, Note, RoundBtn, Sheet, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { addDays, fmtDate, inDays, noEmoji, npl } from "@/lib/format";
import { levelKey, questionsInScope, unfinishedLevels } from "@/lib/tests";
import { T } from "@/lib/theme";
import { topicShort, visibleLevels } from "@/lib/topic-view";

const QUICK: [number, string][] = [
  [3, "za 3 dni"],
  [7, "za tydzień"],
  [14, "za 2 tygodnie"],
];

/** Arkusz „Mam sprawdzian” (QuickAdd → TestPlan): przedmiot, data (min jutro), zakres poziomów → `createTestPlan` → plan. */
export default function TestNew() {
  const { subjectId } = useLocalSearchParams<{ subjectId?: string }>();
  const app = useApp();
  const router = useRouter();
  const today = todayStr();
  const [sel, setSel] = useState(subjectId && app.findSubject(subjectId) ? subjectId : (app.subjects[0]?.id ?? ""));
  const [days, setDays] = useState(7);
  const [levels, setLevels] = useState<string[] | null>(null);
  const subject = app.findSubject(sel);
  const topics = app.topicsOf(sel);
  const all = useMemo(() => topics.flatMap((t) => visibleLevels(t, app.extra.overrides).map((l) => levelKey(t.id, l.id))), [topics, app.extra.overrides]);
  const lv = levels ?? all;
  const date = addDays(today, days);
  const left = unfinishedLevels(topics, app.progress, lv).length;
  const nq = questionsInScope(topics, lv);
  const existing = app.testFor(sel);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  const toggle = (k: string) => {
    const next = lv.includes(k) ? lv.filter((x) => x !== k) : all.filter((x) => x === k || lv.includes(x));
    const n = next.length ? next : [k];
    setLevels(n.length === all.length ? null : n);
  };
  const go = () => {
    if (!subject) return;
    if (!all.length) return app.showToast("Ten przedmiot nie ma jeszcze poziomów", "alert");
    app.createTestPlan(subject.id, date, lv);
    app.showToast("Plan gotowy", "calendar");
    router.replace({ pathname: "/test-plan", params: { subjectId: subject.id } });
  };
  return (
    <Sheet open onClose={close} bg={T.surface2} tone="red" top={90}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Display size={22} ls={-0.6}>
          Mam sprawdzian
        </Display>
        <RoundBtn icon="close" onPress={close} label="Zamknij" />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
        <Eyebrow>Przedmiot</Eyebrow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {app.subjects.map((sub) => {
            const on = sub.id === sel;
            return (
              <AccentProvider key={sub.id} color={sub.accent2} seed={sub.name}>
                <Touch onPress={() => { setSel(sub.id); setLevels(null); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.subChip, on && { borderColor: sub.accent2, backgroundColor: T.surface }]}>
                  <Mono text={sub.name} size={24} radius={8} />
                  <Body size={12.5} weight={800} color={on ? T.txt : T.muted}>
                    {noEmoji(sub.name)}
                  </Body>
                </Touch>
              </AccentProvider>
            );
          })}
        </View>
        <Eyebrow>Kiedy</Eyebrow>
        <View style={s.dateRow}>
          <RoundBtn icon="chevron-down" onPress={() => setDays((d) => Math.max(1, d - 1))} label="Dzień wcześniej" size={36} />
          <View style={{ flex: 1, alignItems: "center" }}>
            <Body size={15} weight={800}>
              {fmtDate(date)}
            </Body>
            <Muted size={11.5} weight={700}>
              {inDays(days)}
            </Muted>
          </View>
          <RoundBtn icon="chevron-up" onPress={() => setDays((d) => Math.min(120, d + 1))} label="Dzień później" size={36} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {QUICK.map(([n, l]) => (
            <Chip key={n} label={l} active={days === n} tone="red" onPress={() => setDays(n)} />
          ))}
        </View>
        <Eyebrow>Zakres</Eyebrow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          <Chip label="wszystkie" active={lv.length === all.length} tone="red" onPress={() => setLevels(null)} />
          {topics.map((t) =>
            visibleLevels(t, app.extra.overrides).map((l) => {
              const k = levelKey(t.id, l.id);
              return <Chip key={k} label={topics.length > 1 ? `${topicShort(t)} · ${noEmoji(l.title)}` : noEmoji(l.title)} active={lv.includes(k)} tone="red" onPress={() => toggle(k)} />;
            }),
          )}
          {!all.length ? <Muted>Ten przedmiot nie ma jeszcze poziomów — dodaj materiał.</Muted> : null}
        </View>
        <Note icon="bulb" tone="gold" text={`${npl(dayDiff(today, date), "dzień", "dni", "dni")} · ${left ? `${npl(left, "poziom", "poziomy", "poziomów")} do nauki` : "wszystko zaliczone, zostają powtórki"} · ${npl(nq, "pytanie", "pytania", "pytań")} na próbny${existing ? " · zastąpi obecny plan" : ""}`} />
        <Btn label="Ułóż plan" glow onPress={go} disabled={!subject || !all.length} right={<Icon name="calendar" size={18} stroke={2.6} color={T.onAcid} />} />
      </ScrollView>
    </Sheet>
  );
}

const s = StyleSheet.create({
  subChip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 999, paddingVertical: 6, paddingLeft: 6, paddingRight: 14 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12 },
});
