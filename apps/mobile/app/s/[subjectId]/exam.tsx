import { DEFAULT_GRADING, dayDiff, todayStr, type Grading } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Eyebrow, Muted, Num } from "@/components/Text";
import { Blob, Btn, Card, Chip, Empty, IconTile, Press, Screen, Sep, TopBar, Touch, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { fmtDate, inDays, noEmoji, npl, pl } from "@/lib/format";
import { levelKey } from "@/lib/tests";
import { T, TONES } from "@/lib/theme";
import { quizPool, topicShort, visibleLevels } from "@/lib/topic-view";

const gradeMain = (g: string) => String(g).split(/\s*[—–/]\s*/)[0] ?? g;

/**
 * Symulacja egzaminu — start (ExamStart.html): zakres (poziomy wszystkich tematów przedmiotu), liczba pytań, limit z `grading.examMin`,
 * próg i siatka ocen, „Warunki jak na prawdziwym”, ostatnie podejście, „Mam sprawdzian”, tryb nocny. Przypięta stopka ZACZYNAM.
 */
export default function ExamStart() {
  const { subjectId, topicId, n: nParam, levels: lvParam } = useLocalSearchParams<{ subjectId: string; topicId?: string; n?: string; levels?: string }>();
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const subject = app.findSubject(subjectId ?? "");
  const topics = app.topicsOf(subjectId ?? "");
  const allKeys = useMemo(() => topics.flatMap((t) => visibleLevels(t, app.extra.overrides).map((l) => levelKey(t.id, l.id))), [topics, app.extra.overrides]);
  const [levels, setLevels] = useState<string[]>(() => {
    if (lvParam) return lvParam.split(",").filter((k) => allKeys.includes(k));
    if (topicId) return allKeys.filter((k) => k.startsWith(topicId + ":"));
    return allKeys;
  });
  const [n, setN] = useState<number | "all">(nParam === "all" ? "all" : nParam ? Math.max(1, +nParam) : 20);
  const grading: Grading = (topicId ? topics.find((t) => t.id === topicId)?.grading : undefined) ?? topics[0]?.grading ?? DEFAULT_GRADING;
  const lim0 = grading.examMin || 20;
  const [lim, setLim] = useState(lim0);
  const pool = useMemo(() => topics.flatMap((t) => quizPool(t, app.extra.overrides, levels.filter((k) => k.startsWith(t.id + ":")).map((k) => k.split(":")[1]!))), [topics, levels, app.extra.overrides]);
  const ALL = pool.length;
  const TOTAL = useMemo(() => topics.reduce((a, t) => a + quizPool(t, app.extra.overrides).length, 0), [topics, app.extra.overrides]);
  const N = n === "all" ? ALL : Math.min(n, ALL);
  const rec = app.examRec(subjectId ?? "");
  const test = app.testFor(subjectId ?? "");
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/s/[subjectId]", params: { subjectId: subjectId ?? "" } }));
  if (!subject)
    return (
      <Screen>
        <Empty icon="alert" title="Nie ma takiego przedmiotu" action={<Btn label="Wróć" onPress={back} />} />
      </Screen>
    );
  const allOn = levels.length === allKeys.length;
  const nOpts: [number | "all", string][] = ([10, 20] as number[]).filter((v) => v < ALL).map((v) => [v, String(v)] as [number, string]);
  nOpts.push(["all", `wszystkie · ${ALL}`]);
  const lims = [...new Set([Math.max(5, Math.round(lim0 / 2)), lim0, lim0 * 2])].sort((a, b) => a - b);
  const toggle = (k: string) => setLevels((cur) => (cur.includes(k) ? (cur.length > 1 ? cur.filter((x) => x !== k) : cur) : allKeys.filter((x) => x === k || cur.includes(x))));
  const start = () => {
    if (!N) return app.showToast("Brak pytań w tym zakresie", "alert");
    router.push({ pathname: "/exam-run", params: { subjectId: subject.id, levels: levels.join(","), n: String(n), lim: String(lim) } });
  };
  const scale = [...grading.scale].sort((a, b) => b[0] - a[0]);
  const Nt = test ? dayDiff(todayStr(), test.date) : null;
  return (
    <AccentProvider color={subject.accent2} seed={subject.name}>
      <Screen pad={false} blob={<Blob tone="pink" size={300} top={60} center />}>
        <View style={[s.head, { paddingTop: top }]}>
          <TopBar title="Symulacja egzaminu" sub={noEmoji(subject.name)} onBack={back} />
        </View>
        <Screen scroll pad={false} bottom={140} style={{ backgroundColor: "transparent" }}>
          <View style={s.wrap}>
            <Motion kind="up" style={{ flexDirection: "row", gap: 11 }}>
              {(
                [
                  [String(N), pl(N, "pytanie", "pytania", "pytań"), T.txt, 1],
                  [lim ? String(lim) : "∞", lim ? pl(lim, "minuta", "minuty", "minut") : "bez limitu", T.txt, 2],
                  [`${grading.pass}%`, "próg", T.acid, 3],
                ] as [string, string, string, number][]
              ).map(([v, k, c, d]) => (
                <Motion key={k} kind="pop" d={d} style={{ flex: 1 }}>
                  <Card padding={0} radius={22} drop={4}>
                    <View style={{ paddingVertical: 15, paddingHorizontal: 10, alignItems: "center" }}>
                      <Num size={27} color={c}>
                        {v}
                      </Num>
                      <Muted size={11} weight={700} style={{ marginTop: 3 }}>
                        {k}
                      </Muted>
                    </View>
                  </Card>
                </Motion>
              ))}
            </Motion>
            <Motion kind="up" d={2}>
              <Card padding={0} radius={24} drop={5}>
                <View style={{ paddingHorizontal: 15, paddingVertical: 8 }}>
                  <Eyebrow style={{ paddingTop: 2, paddingBottom: 6 }}>Zakres</Eyebrow>
                  <ScopeRow on={allOn} label="Wszystkie poziomy" n={TOTAL} onPress={() => setLevels(allOn ? [allKeys[0]!] : allKeys)} />
                  {topics.map((t) =>
                    visibleLevels(t, app.extra.overrides).map((l) => {
                      const k = levelKey(t.id, l.id);
                      return (
                        <React.Fragment key={k}>
                          <Sep />
                          <ScopeRow on={levels.includes(k)} label={topics.length > 1 ? `${topicShort(t)} · ${noEmoji(l.title)}` : noEmoji(l.title)} n={l.quiz.length} onPress={() => toggle(k)} />
                        </React.Fragment>
                      );
                    }),
                  )}
                </View>
              </Card>
            </Motion>
            <Motion kind="up" d={3}>
              <Card padding={15} radius={24} drop={5}>
                <Eyebrow>Liczba pytań</Eyebrow>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 9 }}>
                  {nOpts.map(([v, l]) => (
                    <Chip key={String(v)} label={l} active={String(n) === String(v)} tone="acid" onPress={() => setN(v)} />
                  ))}
                </View>
                <Eyebrow style={{ marginTop: 14 }}>Limit czasu</Eyebrow>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 9 }}>
                  {lims.map((m) => (
                    <Chip key={m} label={`${m} min`} active={lim === m} tone="acid" onPress={() => setLim(m)} />
                  ))}
                  <Chip label="bez limitu" active={lim === 0} tone="acid" onPress={() => setLim(0)} />
                </View>
                <Eyebrow style={{ marginTop: 14 }}>Siatka ocen</Eyebrow>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 9 }}>
                  {scale.map(([min, lab]) => (
                    <View key={min} style={s.gchip}>
                      <Body size={12.5} weight={800}>
                        {gradeMain(lab)}
                      </Body>
                      <Muted size={11.5}>od {min}%</Muted>
                    </View>
                  ))}
                  <View style={s.gchip}>
                    <Body size={12.5} weight={800} color={T.red}>
                      {gradeMain(grading.failLabel)}
                    </Body>
                    <Muted size={11.5}>pod {grading.pass}%</Muted>
                  </View>
                </View>
              </Card>
            </Motion>
            <Motion kind="up" d={4}>
              <Card tone="red" padding={16} radius={24} drop={5}>
                <Eyebrow color={TONES.red.txt}>Warunki jak na prawdziwym</Eyebrow>
                <View style={{ gap: 9, marginTop: 11 }}>
                  {(
                    [
                      ["close", "Brak żyć i podpowiedzi"],
                      ["close", "Wyjaśnienia dopiero na końcu"],
                      ["check", "Możesz oznaczać pytania i do nich wracać"],
                    ] as [string, string][]
                  ).map(([ic, t]) => (
                    <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                      <Icon name={ic} size={16} stroke={ic === "check" ? 3.4 : 3} color={ic === "check" ? T.acid : TONES.red.txt} />
                      <Body size={13} color={TONES.red.txt}>
                        {t}
                      </Body>
                    </View>
                  ))}
                </View>
              </Card>
            </Motion>
            <Motion kind="up" d={5}>
              <Card padding={0} radius={22} drop={4}>
                <View style={s.last}>
                  <IconTile icon={rec.best ? "trophy" : "chart"} size={44} color={rec.best ? T.gold : T.line2} on={rec.best ? T.onGold : T.txt} stroke={2.4} />
                  <View style={{ flex: 1 }}>
                    <Body size={13.5} weight={800}>
                      {rec.last ? "Ostatnie podejście" : "Jeszcze bez podejścia"}
                    </Body>
                    <Muted size={12} style={{ marginTop: 2 }}>
                      {rec.last ? `${fmtDate(rec.last.date)} · ${rec.last.pct}% · ocena ${gradeMain(rec.last.grade)}${rec.best && rec.best.pct > rec.last.pct ? ` · najlepiej ${rec.best.pct}%` : ""}` : "Pierwsze zawsze jest próbne. Wynik zapisuje się tutaj."}
                    </Muted>
                  </View>
                </View>
              </Card>
            </Motion>
            <Motion kind="up" d={6}>
              <Press onPress={() => (test ? router.push({ pathname: "/test-plan", params: { subjectId: subject.id } }) : router.push({ pathname: "/test-new", params: { subjectId: subject.id } }))} drop={4} edge={T.shadow} radius={22} faceStyle={[s.last, s.face]} accessibilityLabel="Mam sprawdzian">
                <IconTile icon="calendar" size={44} color={T.line2} on={T.txt} stroke={2.4} />
                <View style={{ flex: 1 }}>
                  <Body size={13.5} weight={800}>
                    {test && Nt != null ? `Sprawdzian ${inDays(Nt)}` : "Mam sprawdzian"}
                  </Body>
                  <Muted size={12} style={{ marginTop: 2 }}>
                    {test ? "plan dzień po dniu jest gotowy" : "ułożę plan dzień po dniu do daty sprawdzianu"}
                  </Muted>
                </View>
                <Icon name="chevron-right" size={20} color={T.muted2} />
              </Press>
            </Motion>
            <Motion kind="up" d={6}>
              <Press onPress={() => router.push({ pathname: "/cram", params: { subjectId: subject.id } })} drop={4} edge={TONES.violet.tintShadow} radius={22} faceStyle={[s.last, s.face, { backgroundColor: TONES.violet.tint, borderColor: TONES.violet.tintLine }]} accessibilityLabel="Egzamin jutro? Tryb nocny">
                <IconTile icon="moon" size={44} tone="violet" />
                <View style={{ flex: 1 }}>
                  <Body size={13.5} weight={800}>
                    Egzamin jutro?
                  </Body>
                  <Muted size={12} color={TONES.violet.sub} style={{ marginTop: 2 }}>
                    Noc przed egzaminem — 4 bloki po 5 minut, potem spać
                  </Muted>
                </View>
                <Icon name="chevron-right" size={20} color={TONES.violet.sub} />
              </Press>
            </Motion>
          </View>
        </Screen>
        <View style={s.foot}>
          <Btn label={`Zaczynam · ${npl(N, "pytanie", "pytania", "pytań")}`} glow onPress={start} disabled={!N} />
          <Touch onPress={() => router.push({ pathname: "/cram", params: { subjectId: subject.id } })} accessibilityRole="button" style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Icon name="moon" size={16} color={TONES.violet.txt} />
            <Body size={13} weight={800} color={TONES.violet.txt}>
              Egzamin jutro? Tryb nocny
            </Body>
          </Touch>
        </View>
      </Screen>
    </AccentProvider>
  );
}

function ScopeRow({ on, label, n, onPress }: { on: boolean; label: string; n: number; onPress: () => void }) {
  return (
    <Touch onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 }}>
      <View style={[s.box, on && { backgroundColor: T.acid, borderColor: T.acid }]}>{on ? <Icon name="check" size={14} stroke={4} color={T.onAcid} /> : null}</View>
      <Body size={13.5} color={on ? T.txt : "#7A74AA"} style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Body>
      <Body size={12} weight={800} color={on ? T.muted : "#4E4778"}>
        {n}
      </Body>
    </Touch>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: 18, paddingBottom: 4 },
  wrap: { paddingHorizontal: 18, paddingTop: 14, gap: 14 },
  gchip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.line2, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11 },
  last: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 14, paddingHorizontal: 16 },
  face: { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line },
  box: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: T.dash, alignItems: "center", justifyContent: "center" },
  foot: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20, gap: 4, backgroundColor: T.bg },
});
