import { DEFAULT_GRADING, dayDiff, todayStr, type Grading } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { HtmlText } from "@/components/HtmlText";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Eyebrow, Muted } from "@/components/Text";
import { Blob, Btn, Card, Chip, Empty, IconTile, Press, Screen, TopBar, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { htmlToBoxes, type Box } from "@/lib/html";
import { inDays, noEmoji, npl } from "@/lib/format";
import { T, TONES, type Tone } from "@/lib/theme";
import { topicShort } from "@/lib/topic-view";

const INFO_ICON: [RegExp, string, Tone][] = [
  [/cheat|najwa|priorytet|klucz|motyw/i, "bolt", "pink"],
  [/ocen|zalicz|punkt/i, "target", "pink"],
  [/zakres|unit|materia/i, "book", "cyan"],
  [/egzamin|test|kolokw|termin|deadline|homework|zadanie/i, "calendar", "gold"],
  [/regulac|prawo|kontekst/i, "file", "violet"],
  [/powt/i, "refresh", "cyan"],
  [/gramat|słow|slow/i, "edit", "gold"],
];
const gradeParts = (g: string) => {
  const m = String(g).split(/\s*[—–/]\s*/);
  return [m[0] ?? g, m.slice(1).join(" ")] as const;
};
function scaleRows(grading: Grading): { min: number; max: number; lab: string }[] {
  const sc = [...grading.scale].sort((a, b) => b[0] - a[0]);
  const out: { min: number; max: number; lab: string }[] = [];
  for (let i = sc.length - 1; i >= 0; i--) out.push({ min: sc[i]![0], max: i > 0 ? sc[i - 1]![0] - 1 : 100, lab: gradeParts(sc[i]![1])[0] });
  return out;
}
const boxTitle = (b: Box) => (b.blocks[0]?.kind === "h3" ? b.blocks[0].runs.map((r) => r.text).join("") : "");

/**
 * Zasady zaliczenia (SubjectInfo.html): bloki `info` tematu jako kafle z ikoną wg nagłówka, siatka ocen z `grading.scale`
 * (podświetlony wiersz ostatniego wyniku), egzamin próbny, „Mam sprawdzian”, udostępnianie. Chipy przełączają temat.
 */
export default function SubjectInfo() {
  const { subjectId, topicId } = useLocalSearchParams<{ subjectId: string; topicId?: string }>();
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const subject = app.findSubject(subjectId ?? "");
  const topics = app.topicsOf(subjectId ?? "");
  const [tid, setTid] = useState(topicId && topics.some((t) => t.id === topicId) ? topicId : (topics[0]?.id ?? ""));
  const topic = topics.find((t) => t.id === tid);
  const rec = app.examRec(subjectId ?? "");
  const last = rec.last;
  const test = app.testFor(subjectId ?? "");
  const grading: Grading = topic?.grading ?? DEFAULT_GRADING;
  const boxes = topic?.info ? htmlToBoxes(topic.info).filter((b) => b.blocks.length) : [];
  const rows = scaleRows(grading);
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/s/[subjectId]", params: { subjectId: subjectId ?? "" } }));
  if (!subject)
    return (
      <Screen>
        <Empty icon="alert" title="Nie ma takiego przedmiotu" action={<Btn label="Wróć" onPress={back} />} />
      </Screen>
    );
  const nq = topic ? Math.min(20, topic.levels.reduce((a, l) => a + l.quiz.length, 0)) : 0;
  const N = test ? dayDiff(todayStr(), test.date) : null;
  return (
    <AccentProvider color={subject.accent2} seed={subject.name}>
      <Screen scroll pad={false} bottom={40} blob={<Blob tone="violet" size={260} top={-110} right={-80} />}>
        <View style={[s.wrap, { paddingTop: top }]}>
          <TopBar title="Zasady zaliczenia" sub={`${noEmoji(subject.name)}${topic ? ` · ${topicShort(topic)}` : ""}`} onBack={back} />
          {topics.length > 1 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              {topics.map((t) => (
                <Chip key={t.id} label={topicShort(t)} active={t.id === tid} onPress={() => setTid(t.id)} />
              ))}
            </View>
          ) : null}
          {topic?.tagline ? (
            <Muted size={13.5} lh={20}>
              {topic.tagline}
            </Muted>
          ) : null}
          {boxes.length ? (
            boxes.map((b, i) => {
              const title = boxTitle(b);
              const m = INFO_ICON.find(([re]) => re.test(title));
              const tone: Tone | null = m ? m[2] : null;
              const set = tone ? TONES[tone] : null;
              return (
                <Motion key={i} kind="up" d={Math.min(6, i + 1)}>
                  <View style={[s.tile, set ? { backgroundColor: set.tint, borderColor: i === 0 ? set.color : set.tintLine } : null]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {i === 0 ? (
                        <Motion kind="pulse">
                          <Icon name={m?.[1] ?? "info"} size={18} stroke={2.6} color={set?.color ?? T.muted} />
                        </Motion>
                      ) : (
                        <Icon name={m?.[1] ?? "info"} size={18} stroke={2.6} color={set?.color ?? T.muted} />
                      )}
                      <Eyebrow color={set?.color ?? T.muted2}>{title || "Informacje"}</Eyebrow>
                    </View>
                    <View style={{ marginTop: 9 }}>
                      {b.blocks
                        .filter((bl) => bl.kind !== "h3")
                        .map((bl, j) => (
                          <HtmlText key={j} html={bl.runs.map((r) => (r.bold ? `<b>${r.text}</b>` : r.text)).join("")} inline textStyle={{ fontSize: 14.5, lineHeight: 22, color: set ? set.txt : T.txt2 }} boldColor={T.txt} style={bl.kind === "li" ? { paddingLeft: 12 } : undefined} />
                        ))}
                    </View>
                  </View>
                </Motion>
              );
            })
          ) : topic ? (
            <Motion kind="up" d={1}>
              <Card>{topic.info ? <HtmlText html={topic.info} /> : <Muted>Brak dodatkowych informacji o zaliczeniu.</Muted>}</Card>
            </Motion>
          ) : (
            <Card>
              <Muted>Dodaj pierwszy temat, a pojawią się tu zasady zaliczenia.</Muted>
            </Card>
          )}
          <Motion kind="up" d={Math.min(6, boxes.length + 1)}>
            <Card padding={17}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Eyebrow>Siatka ocen</Eyebrow>
                <Body size={11.5} weight={800} color={last ? T.acid : T.muted}>
                  {last ? `twój wynik: ${last.pct}%` : "jeszcze bez podejścia"}
                </Body>
              </View>
              <View style={{ gap: 6, marginTop: 12 }}>
                <ScaleRow label={`pod ${grading.pass}%`} grade={gradeParts(grading.failLabel)[0]} on={!!last && last.pct < grading.pass} fail />
                {rows.map((r) => (
                  <ScaleRow key={r.min} label={`${r.min}–${r.max}%`} grade={r.lab} on={!!last && last.pct >= r.min && last.pct <= r.max} top={r.max === 100} />
                ))}
              </View>
            </Card>
          </Motion>
          <Motion kind="up" d={5}>
            <Press onPress={() => router.push({ pathname: "/s/[subjectId]/exam", params: { subjectId: subject.id, topicId: tid } })} drop={4} edge={T.shadow} radius={22} faceStyle={s.link} accessibilityLabel="Egzamin próbny">
              <IconTile icon="target" size={44} color={T.line2} on={T.txt} />
              <View style={{ flex: 1 }}>
                <Body size={14} weight={800}>
                  Egzamin próbny
                </Body>
                <Muted size={12} style={{ marginTop: 2 }}>
                  {npl(nq, "pytanie", "pytania", "pytań")} · {grading.examMin} min · próg {grading.pass}%{rec.best ? ` · najlepiej ${rec.best.pct}%` : ""}
                </Muted>
              </View>
              <Icon name="chevron-right" size={18} color={T.muted2} />
            </Press>
          </Motion>
          <Motion kind="up" d={6}>
            <Press onPress={() => (test ? router.push({ pathname: "/test-plan", params: { subjectId: subject.id } }) : router.push({ pathname: "/test-new", params: { subjectId: subject.id } }))} drop={4} edge={T.shadow} radius={22} faceStyle={s.link} accessibilityLabel="Mam sprawdzian">
              <IconTile icon="calendar" size={44} tone="red" />
              <View style={{ flex: 1 }}>
                <Body size={14} weight={800}>
                  {test && N != null ? `Sprawdzian ${inDays(N)}` : "Mam sprawdzian"}
                </Body>
                <Muted size={12} style={{ marginTop: 2 }}>
                  {test ? "plan dzień po dniu jest gotowy" : "ułożę plan dzień po dniu do daty"}
                </Muted>
              </View>
              <Icon name="chevron-right" size={18} color={T.muted2} />
            </Press>
          </Motion>
          <Motion kind="up" d={6}>
            <Press onPress={() => router.push({ pathname: "/share", params: { subjectId: subject.id } })} drop={4} edge={T.shadow} radius={22} faceStyle={s.link} accessibilityLabel="Udostępnij klasie">
              <IconTile icon="share" size={44} tone="cyan" />
              <View style={{ flex: 1 }}>
                <Body size={14} weight={800}>
                  Udostępnij klasie
                </Body>
                <Muted size={12} style={{ marginTop: 2 }}>
                  kod dla klasy · wkrótce
                </Muted>
              </View>
              <Icon name="chevron-right" size={18} color={T.muted2} />
            </Press>
          </Motion>
          <Btn label="Wróć do nauki" glow onPress={back} style={{ marginTop: 4 }} />
        </View>
      </Screen>
    </AccentProvider>
  );
}

function ScaleRow({ label, grade, on, fail, top }: { label: string; grade: string; on: boolean; fail?: boolean; top?: boolean }) {
  const set = fail ? TONES.red : TONES.acid;
  const inner = (
    <View style={[s.srow, on && { backgroundColor: set.tint, borderWidth: 2, borderColor: set.tintLine, paddingVertical: 9, borderRadius: 13 }]}>
      <Body size={on ? 13.5 : 13} weight={on ? 800 : 700} color={on ? set.txt : fail ? "#7A74AA" : top ? TONES.gold.txt : T.txt2} style={{ flex: 1 }}>
        {label}
      </Body>
      {on ? (
        <Eyebrow size={10.5} color={set.sub}>
          tu jesteś
        </Eyebrow>
      ) : null}
      <Body size={on ? 14 : 13} weight={800} color={on ? set.color : fail ? "#7A74AA" : top ? TONES.gold.txt : T.txt2}>
        {grade}
      </Body>
    </View>
  );
  return on ? <Motion kind="glow">{inner}</Motion> : inner;
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 13 },
  tile: { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 24, padding: 17 },
  srow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 7, paddingHorizontal: 11 },
  link: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, paddingVertical: 14, paddingHorizontal: 16 },
});
