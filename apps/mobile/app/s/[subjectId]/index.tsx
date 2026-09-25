import { dayDiff, levelProgress, todayStr } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AccentProvider, useAccent } from "@/components/Accent";
import { Icon } from "@/components/Icon";
import { Bar, Motion } from "@/components/Motion";
import { Body, Display, Eyebrow, Muted } from "@/components/Text";
import { Blob, Btn, Card, Empty, IconTile, Mono, Pill, Press, RoundBtn, Screen, Sheet, Touch, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { fmtDate, inDays, noEmoji, npl } from "@/lib/format";
import { tpTitle } from "@/lib/tests";
import { T, TONES } from "@/lib/theme";
import { topicShort, visibleLevels } from "@/lib/topic-view";

/**
 * Przedmiot (kontener): pas w kolorze przedmiotu (SubjectReady/Path.html), chip „Sprawdzian za N dni”, tematy jako rozdziały
 * (każdy = własna ścieżka), skróty do fiszek i egzaminu, dodanie materiału, usunięcie przedmiotu (arkusz potwierdzenia).
 */
export default function SubjectScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const app = useApp();
  const router = useRouter();
  const subject = app.findSubject(subjectId ?? "");
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  if (!subject)
    return (
      <Screen>
        <Empty icon="alert" title="Nie ma takiego przedmiotu" action={<Btn label="Wróć" onPress={back} />} />
      </Screen>
    );
  return (
    <AccentProvider color={subject.accent2} seed={subject.name}>
      <SubjectBody subjectId={subject.id} onBack={back} />
    </AccentProvider>
  );
}

function SubjectBody({ subjectId, onBack }: { subjectId: string; onBack: () => void }) {
  const app = useApp();
  const router = useRouter();
  const acc = useAccent();
  const top = useTop();
  const subject = app.findSubject(subjectId)!;
  const topics = app.topicsOf(subjectId);
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const total = topics.reduce((a, t) => a + visibleLevels(t, app.extra.overrides).length, 0);
  const done = topics.reduce((a, t) => a + visibleLevels(t, app.extra.overrides).filter((l) => levelProgress(app.progressFor(t.id), l.id).done).length, 0);
  const xp = topics.reduce((a, t) => a + (app.progress[t.id]?.xp ?? 0), 0);
  const cards = topics.reduce((a, t) => a + t.levels.reduce((b, l) => b + l.flashcards.length, 0), 0);
  const qs = topics.reduce((a, t) => a + t.levels.reduce((b, l) => b + l.quiz.length, 0), 0);
  const due = app.dueCount(subjectId);
  const test = app.testFor(subjectId);
  const today = todayStr();
  const N = test ? dayDiff(today, test.date) : subject.examDate ? dayDiff(today, subject.examDate) : null;
  const row = test?.plan.find((r) => r.date === today);
  const remove = async () => {
    setBusy(true);
    try {
      await app.deleteSubject(subjectId);
      app.showToast("Przedmiot usunięty", "trash");
      router.replace("/(tabs)");
    } catch (e) {
      app.showToast(e instanceof Error ? e.message : "Nie udało się usunąć", "alert");
      setBusy(false);
    }
  };
  return (
    <Screen scroll pad={false} bottom={40} blob={<Blob tone="mid" size={300} top={210} center />}>
      <View style={[s.band, { paddingTop: top }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <RoundBtn icon="back" onPress={onBack} label="Wróć do planu dnia" size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Mono text={subject.name} size={26} radius={8} />
              <Display size={19} ls={-0.4} numberOfLines={1} style={{ flex: 1 }}>
                {noEmoji(subject.name)}
              </Display>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 7 }}>
              <Bar pct={total ? (done / total) * 100 : 0} color={acc.color} style={{ flex: 1 }} />
              <Body size={11.5} weight={800} color={acc.sub}>
                {done}/{total} · {xp} xp
              </Body>
            </View>
          </View>
          <RoundBtn icon="info" onPress={() => router.push({ pathname: "/s/[subjectId]/info", params: { subjectId } })} label="Zasady zaliczenia" />
          <Pill kind="gems" value={app.gems} onPress={() => router.push("/shop")} />
        </View>
        {N != null && N >= 0 ? (
          <Touch onPress={() => (test ? router.push({ pathname: "/test-plan", params: { subjectId } }) : router.push({ pathname: "/test-new", params: { subjectId } }))} accessibilityRole="button" style={s.testChip}>
            <Icon name="calendar" size={15} stroke={2.6} color={TONES.red.txt} />
            <Body size={12.5} weight={800} color={TONES.red.txt}>
              Sprawdzian {inDays(N)}
            </Body>
            <Muted size={11.5} color={TONES.red.sub} style={{ flex: 1 }} numberOfLines={1}>
              {N > 0 && row ? `· dziś: ${tpTitle(row, topics).toLowerCase()}${row.done ? " (zrobione)" : ""}` : test ? "" : "· ułóż plan dzień po dniu"}
            </Muted>
            <Icon name="chevron-right" size={16} color={TONES.red.sub} />
          </Touch>
        ) : null}
      </View>
      <View style={s.wrap}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {(
            [
              ["cards", "Fiszki", cards ? `${cards}${due ? ` · ${due} dziś` : ""}` : "brak", () => router.push({ pathname: "/s/[subjectId]/cards", params: { subjectId } }), !cards],
              ["target", "Egzamin", qs ? npl(Math.min(20, qs), "pytanie", "pytania", "pytań") : "brak", () => router.push({ pathname: "/s/[subjectId]/exam", params: { subjectId } }), qs < 5],
              ["refresh", "Powtórka", due ? `${due} na dziś` : "nic na dziś", () => router.push({ pathname: "/review-run", params: { subjectId } }), !due],
            ] as [string, string, string, () => void, boolean][]
          ).map(([ic, t, sub, go, off], i) => (
            <Motion key={t} kind="up" d={i + 1} style={{ flex: 1 }}>
              <Press onPress={off ? () => app.showToast("Najpierw dodaj materiał", "info") : go} drop={4} edge={T.shadow} radius={20} faceStyle={[s.quick, off && { opacity: 0.55 }]} accessibilityLabel={`${t}: ${sub}`}>
                <Icon name={ic} size={20} stroke={2.4} color={acc.color} />
                <Body size={13} weight={800}>
                  {t}
                </Body>
                <Muted size={11} numberOfLines={1}>
                  {sub}
                </Muted>
              </Press>
            </Motion>
          ))}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Eyebrow>
            Tematy · {topics.length}
          </Eyebrow>
          <Touch onPress={() => router.push({ pathname: "/add", params: { subjectId } })} accessibilityRole="button" hitSlop={8}>
            <Body size={12.5} weight={800} color={T.acid}>
              Dodaj materiał
            </Body>
          </Touch>
        </View>
        {!topics.length ? (
          <Motion kind="up" d={2}>
            <Card padding={20}>
              <View style={{ alignItems: "center", gap: 10 }}>
                <IconTile icon="upload" size={52} kind="bob" />
                <Display size={20} center>
                  Jeszcze pusto
                </Display>
                <Muted center lh={18}>
                  Zrób zdjęcie strony, wrzuć PDF albo wpisz samo hasło. Za minutę masz z tego ścieżkę, fiszki i pytania.
                </Muted>
                <Btn label="Dodaj pierwszy temat" glow onPress={() => router.push({ pathname: "/add", params: { subjectId } })} style={{ alignSelf: "stretch", marginTop: 4 }} />
              </View>
            </Card>
          </Motion>
        ) : null}
        <View style={{ gap: 10 }}>
          {topics.map((t, i) => {
            const lv = visibleLevels(t, app.extra.overrides);
            const p = app.progressFor(t.id);
            const dn = lv.filter((l) => levelProgress(p, l.id).done).length;
            const all = lv.length > 0 && dn === lv.length;
            const boss = p.boss?.done;
            const next = lv.find((l) => !levelProgress(p, l.id).done);
            return (
              <Motion key={t.id} kind="up" d={Math.min(6, i + 2)}>
                <Press onPress={() => router.push({ pathname: "/t/[topicId]", params: { topicId: t.id } })} drop={4} edge={T.shadow} radius={22} faceStyle={s.topic} accessibilityLabel={`${topicShort(t)}: ${dn} z ${lv.length} poziomów`}>
                  <View style={[s.num, all && { backgroundColor: acc.color }]}>
                    {all ? <Icon name={boss ? "trophy" : "check"} size={20} stroke={3.4} color={acc.on} /> : <Display size={17} color={acc.color}>{i + 1}</Display>}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Body size={14.5} weight={800} numberOfLines={1}>
                      {topicShort(t)}
                    </Body>
                    <Muted size={12} style={{ marginTop: 2 }} numberOfLines={1}>
                      {all ? (boss ? "wszystko zaliczone · boss pokonany" : "wszystko zaliczone · boss czeka") : next ? `dalej: ${noEmoji(next.title)}` : "brak poziomów"}
                    </Muted>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <Bar pct={lv.length ? (dn / lv.length) * 100 : 0} color={acc.color} height={8} d={Math.min(6, i + 2)} style={{ flex: 1 }} />
                      <Muted size={11} weight={800}>
                        {dn}/{lv.length}
                      </Muted>
                    </View>
                  </View>
                  <Icon name="chevron-right" size={18} color={T.muted2} />
                </Press>
              </Motion>
            );
          })}
        </View>
        {subject.examDate && !test ? (
          <Muted size={11.5} center>
            Sprawdzian: {fmtDate(subject.examDate)}
            {subject.examLabel ? ` · ${subject.examLabel}` : ""}
          </Muted>
        ) : null}
        <Btn label="Usuń przedmiot" variant="text" onPress={() => setDel(true)} />
      </View>
      <Sheet open={del} onClose={() => setDel(false)} tone="red" bg={T.surface2}>
        <Display size={22} ls={-0.6}>
          Usunąć „{noEmoji(subject.name)}”?
        </Display>
        <Muted size={13} lh={19}>
          Znikną {npl(topics.length, "temat", "tematy", "tematów")}, postępy, fiszki i powtórki z tego przedmiotu. Tego nie da się cofnąć.
        </Muted>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
          <Btn label="Zostaw" variant="ghost" onPress={() => setDel(false)} style={{ flex: 1 }} />
          <Btn label={busy ? "Usuwam…" : "Usuń"} variant="danger" onPress={remove} disabled={busy} style={{ flex: 1 }} />
        </View>
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  band: { paddingHorizontal: 18, paddingBottom: 12, backgroundColor: T.surface2, borderBottomWidth: 2, borderBottomColor: T.line, gap: 12 },
  testChip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: TONES.red.tint, borderWidth: 2, borderColor: TONES.red.tintLine, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 },
  wrap: { paddingHorizontal: 18, paddingTop: 16, gap: 14 },
  quick: { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, padding: 12, gap: 5, minHeight: 84 },
  topic: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, paddingVertical: 13, paddingHorizontal: 14 },
  num: { width: 40, height: 40, borderRadius: 14, backgroundColor: T.line2, alignItems: "center", justifyContent: "center" },
});
