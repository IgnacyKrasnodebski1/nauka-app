import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glow, HueProvider } from "@/components/Accent";
import { ExamPlanView } from "@/components/ExamPlanView";
import { examCountdown, subjectStats } from "@/components/SubjectCard";
import { Body, Display, Label, Muted, Title } from "@/components/Text";
import { TopicCard } from "@/components/TopicCard";
import { BackButton, Button, Card, Empty, IconTile, Input, Loading, SectionHead, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { pl } from "@/lib/plural";
import { COLORS, RADIUS, SPACE, UI, hueFrom, tabular } from "@/lib/theme";

/** Strona przedmiotu: nagłówek z poświatą hue, Sprawdzian (plan), tematy (lista hairline), CTA, Fiszki/Egzamin, usuń. */
export default function SubjectScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const subject = app.findSubject(subjectId ?? "");
  const topics = app.topicsOf(subjectId ?? "");
  const [editExam, setEditExam] = useState(false);
  const [date, setDate] = useState(subject?.examDate ?? "");
  const [label, setLabel] = useState(subject?.examLabel ?? "");
  const [busy, setBusy] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  if (!app.ready) return <Loading label="wczytuję…" />;
  if (!subject)
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg0, paddingTop: insets.top, justifyContent: "center" }}>
        <Empty icon="?" title="Nie ma takiego przedmiotu" action={<Button label="Wróć" onPress={back} />} />
      </View>
    );

  const hue = hueFrom(subject.accent2, subject.name);
  const st = subjectStats(topics, app.progressFor);
  const days = examCountdown(subject);

  const saveExam = async (clear = false) => {
    const d = clear ? "" : date.trim();
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return app.showToast("Data w formacie RRRR-MM-DD");
    if (d && Number.isNaN(new Date(d + "T00:00:00").getTime())) return app.showToast("To nie jest poprawna data");
    setBusy(true);
    try {
      await app.updateSubject(subject.id, { examDate: d || null, examLabel: clear ? null : label.trim() || null });
      setEditExam(false);
      app.showToast(d ? "Plan gotowy" : "Sprawdzian usunięty");
    } catch (e) {
      app.showToast(e instanceof Error ? e.message : "Nie zapisało się");
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert("Usunąć przedmiot?", `„${subject.name}” razem z ${pl(topics.length, "tematem", "tematami", "tematami")} i postępami. Tego nie da się cofnąć.`, [
      { text: "Anuluj", style: "cancel" },
      {
        text: "Usuń",
        style: "destructive",
        onPress: async () => {
          try {
            await app.deleteSubject(subject.id);
            app.showToast("Usunięte");
            back();
          } catch (e) {
            app.showToast(e instanceof Error ? e.message : "Nie udało się usunąć");
          }
        },
      },
    ]);

  const newTopic = (mode: "materials" | "prompt") => router.push({ pathname: "/s/[subjectId]/new", params: { subjectId: subject.id, mode } });

  return (
    <HueProvider color={hue.color}>
      <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
        <Glow color={hue.color} size={460} alpha={0.16} style={{ top: -230, alignSelf: "center" }} />
        <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + SPACE[2], paddingBottom: 60 + insets.bottom }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.headRow}>
            <BackButton onPress={back} />
            <Touch onPress={remove} hitSlop={8} style={{ padding: SPACE[2] }}>
              <Muted size="xs" weight={600}>
                Usuń
              </Muted>
            </Touch>
          </View>
          <View style={s.header}>
            <IconTile emoji={subject.emoji} hue={hue} size={64} />
            <Display size="3xl" weight={700} style={{ marginTop: SPACE[3] }}>
              {subject.name}
            </Display>
            <Muted style={tabular}>
              {pl(st.topics, "temat", "tematy", "tematów")} · {st.done}/{st.total} {pl(st.total, "poziom", "poziomy", "poziomów", false)} · {st.pct}%
            </Muted>
          </View>

          <View style={s.ctaRow}>
            <Touch onPress={() => newTopic("materials")} style={s.cta}>
              <View style={s.hl} />
              <Display size="lg" weight={700}>
                📷
              </Display>
              <Title size="base">Z materiałów</Title>
              <Muted size="xs">zdjęcia, PDF, tekst</Muted>
            </Touch>
            <Touch onPress={() => newTopic("prompt")} style={s.cta}>
              <View style={s.hl} />
              <Display size="lg" weight={700}>
                ✎
              </Display>
              <Title size="base">Z hasła</Title>
              <Muted size="xs">np. „fotosynteza”</Muted>
            </Touch>
          </View>

          <Card style={{ marginBottom: SPACE[5] }}>
            <View style={s.secHead}>
              <Label>sprawdzian</Label>
              {subject.examDate && !editExam ? (
                <Touch onPress={() => setEditExam(true)}>
                  <Muted size="xs" weight={600} color={hue.color}>
                    Zmień
                  </Muted>
                </Touch>
              ) : null}
            </View>
            {editExam || !subject.examDate ? (
              editExam ? (
                <View style={{ gap: SPACE[2] }}>
                  <Input value={date} onChangeText={setDate} placeholder="Data: RRRR-MM-DD" keyboardType="numbers-and-punctuation" />
                  <Input value={label} onChangeText={setLabel} placeholder="np. kartkówka z fotosyntezy" />
                  <View style={{ flexDirection: "row", gap: SPACE[2], marginTop: SPACE[1] }}>
                    <Button label="Anuluj" variant="secondary" small onPress={() => setEditExam(false)} style={{ flex: 1 }} />
                    <Button label={busy ? "…" : "Zapisz"} small onPress={() => saveExam()} disabled={busy} style={{ flex: 2 }} />
                  </View>
                  {subject.examDate ? <Button label="Usuń sprawdzian" variant="ghost" small onPress={() => saveExam(true)} /> : null}
                </View>
              ) : (
                <>
                  <Title size="md">Mam sprawdzian</Title>
                  <Body color={COLORS.muted} style={{ marginTop: 4 }}>
                    Podaj datę, a rozpiszę tematy na dni: poziomy, powtórki i symulacja dzień przed.
                  </Body>
                  <Button
                    label="Ustaw datę"
                    variant="secondary"
                    small
                    onPress={() => {
                      setDate(subject.examDate ?? "");
                      setLabel(subject.examLabel ?? "");
                      setEditExam(true);
                    }}
                    style={{ marginTop: SPACE[3], alignSelf: "flex-start", minWidth: 140 }}
                  />
                </>
              )
            ) : (
              <>
                <Title size="md" style={{ marginBottom: SPACE[3] }}>
                  {subject.examLabel || "Sprawdzian"} · {subject.examDate}
                  {days === null ? " · już był" : ""}
                </Title>
                {days !== null ? <ExamPlanView topics={topics} progress={app.progress} examDate={subject.examDate} onLevel={(topicId, levelId) => router.push({ pathname: "/t/[topicId]/l/[levelId]", params: { topicId, levelId } })} /> : null}

              </>
            )}
          </Card>

          <SectionHead
            label={`tematy · ${topics.length}`}
            right={
              topics.length ? (
                <View style={{ flexDirection: "row", gap: SPACE[2] }}>
                  <Touch onPress={() => router.push({ pathname: "/s/[subjectId]/cards", params: { subjectId: subject.id } })} style={s.miniBtn}>
                    <Muted size="xs" weight={600} color={COLORS.text}>
                      Fiszki
                    </Muted>
                  </Touch>
                  <Touch onPress={() => router.push({ pathname: "/s/[subjectId]/exam", params: { subjectId: subject.id } })} style={s.miniBtn}>
                    <Muted size="xs" weight={600} color={COLORS.text}>
                      Egzamin
                    </Muted>
                  </Touch>
                </View>
              ) : null
            }
          />
          {topics.length === 0 ? (
            <Empty icon="＋" title="Jeszcze pusto" text="Sfotografuj notatki albo wpisz hasło — AI zrobi poziomy, fiszki, gry i quiz." />
          ) : (
            <View style={s.list}>
              {topics.map((t, i) => (
                <TopicCard key={t.id} topic={t} last={i === topics.length - 1} onPress={() => router.push({ pathname: "/t/[topicId]", params: { topicId: t.id } })} />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </HueProvider>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: UI.gutter },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  header: { paddingVertical: SPACE[5], paddingBottom: SPACE[6], gap: 4 },
  ctaRow: { flexDirection: "row", gap: SPACE[3], marginBottom: SPACE[5] },
  cta: { flex: 1, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.lg, padding: SPACE[4], gap: 2, overflow: "hidden" },
  hl: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: COLORS.highlight },
  secHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE[3] },
  miniBtn: { backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.pill, paddingVertical: 6, paddingHorizontal: 12 },
  list: { backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.lg, paddingHorizontal: SPACE[4] },
});
