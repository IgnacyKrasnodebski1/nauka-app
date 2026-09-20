import { levelProgress, subjectCompletion, unlockedIndex, type Topic } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HueProvider } from "@/components/Accent";
import { Button3D, Tile3D } from "@/components/Button3D";
import { ExamPlanView } from "@/components/ExamPlanView";
import { Icon } from "@/components/Icon";
import { Mascot, MascotBubble } from "@/components/Mascot";
import { GemsPill, HeartsPill, StreakPill } from "@/components/Pills";
import { Ring } from "@/components/Ring";
import { examCountdown, subjectStats } from "@/components/SubjectCard";
import { Body, Display, Label, Muted, Num, Title } from "@/components/Text";
import { BackButton, Button, Card, Empty, Input, Loading, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { pl } from "@/lib/plural";
import { COLORS, PLAY, RADIUS, SPACE, UI, hueFrom, tabular } from "@/lib/theme";

type Tab = "topics" | "exam";

/** Strona przedmiotu: baner jednostki w hue z ringiem, zakładki, sprawdzian z odliczaniem i maskotką, jednostki, kafle CTA 3D. */
export default function SubjectScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const subject = app.findSubject(subjectId ?? "");
  const topics = app.topicsOf(subjectId ?? "");
  const [tab, setTab] = useState<Tab>("topics");
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
  const stars = topics.reduce((a, t) => a + t.levels.reduce((b, l) => b + levelProgress(app.progressFor(t.id), l.id).stars, 0), 0);
  const nextTopic = topics.find((t) => subjectCompletion(t, app.progressFor(t.id)).done < t.levels.length) ?? topics[0];

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
  const openTopic = (t: Topic) => router.push({ pathname: "/t/[topicId]", params: { topicId: t.id } });
  const continueTopic = (t: Topic) => {
    const p = app.progressFor(t.id);
    const lv = t.levels[unlockedIndex(t, p)];
    if (lv) router.push({ pathname: "/t/[topicId]/l/[levelId]", params: { topicId: t.id, levelId: lv.id } });
    else openTopic(t);
  };

  return (
    <HueProvider color={hue.color}>
      <View style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
        <View style={[s.headRow, { paddingTop: insets.top + SPACE[2] }]}>
          <BackButton onPress={back} />
          <View style={{ flexDirection: "row", gap: 6 }}>
            <StreakPill streak={app.streak} compact />
            <GemsPill gems={app.gems} compact />
            <HeartsPill hearts={app.hearts} compact />
          </View>
        </View>
        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 60 + insets.bottom }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* baner */}
          <Animated.View entering={FadeInDown.duration(300)} style={[s.banner, { backgroundColor: hue.color, borderBottomColor: hue.deep }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE[4] }}>
              <View style={s.emojiBox}>
                <Display size="3xl" weight={700} style={{ lineHeight: 46 }}>
                  {subject.emoji}
                </Display>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Label color="rgba(255,255,255,0.8)">{nextTopic ? `jednostka ${topics.indexOf(nextTopic) + 1} z ${topics.length}` : "przedmiot"}</Label>
                <Display size="2xl" weight={800} color="#fff" numberOfLines={2}>
                  {subject.name}
                </Display>
                <Body size="sm" color="rgba(255,255,255,0.9)" style={tabular}>
                  {pl(st.topics, "temat", "tematy", "tematów")} · {st.done}/{st.total} {pl(st.total, "poziom", "poziomy", "poziomów", false)}
                </Body>
              </View>
              <Ring pct={st.pct} size={68} stroke={8} color="#fff" track="rgba(0,0,0,0.25)">
                <Num size="sm" weight={800} color="#fff" style={[tabular, { fontSize: 15 }]}>
                  {st.pct}%
                </Num>
              </Ring>
            </View>
            <View style={s.bannerStats}>
              <BannerStat icon="star" value={`${stars}/${st.total * 3}`} label="gwiazdek" />
              <BannerStat icon="flash" value={String(topics.reduce((a, t) => a + app.progressFor(t.id).xp, 0))} label="XP" />
              <BannerStat icon="alarm" value={days === null ? "—" : days === 0 ? "dziś" : `${days} dni`} label="sprawdzian" />
            </View>
            {nextTopic ? <Button3D label={st.done === 0 ? "Zacznij naukę" : "Kontynuuj"} color="#fff" deep="#C9CCDA" textColor={hue.deep} onPress={() => continueTopic(nextTopic)} style={{ marginTop: SPACE[3] }} right={<Icon name="play" size={16} color={hue.deep} />} /> : null}
          </Animated.View>

          {/* CTA 3D */}
          <View style={s.ctaRow}>
            <Tile3D color={PLAY.purple} deep={PLAY.purpleDeep} onPress={() => newTopic("materials")} style={{ flex: 1 }} faceStyle={s.cta}>
              <Icon name="camera" size={26} color="#fff" />
              <Title size="base" color="#fff">
                Z materiałów
              </Title>
              <Muted size="xs" color="rgba(255,255,255,0.85)">
                zdjęcia, PDF, tekst
              </Muted>
            </Tile3D>
            <Tile3D color={PLAY.blue} deep={PLAY.blueDeep} onPress={() => newTopic("prompt")} style={{ flex: 1 }} faceStyle={s.cta}>
              <Icon name="sparkles" size={26} color="#fff" />
              <Title size="base" color="#fff">
                Z hasła
              </Title>
              <Muted size="xs" color="rgba(255,255,255,0.85)">
                np. „fotosynteza”
              </Muted>
            </Tile3D>
          </View>

          {/* zakładki */}
          <View style={s.seg}>
            {(
              [
                ["topics", "Jednostki", "list"],
                ["exam", "Sprawdzian", "calendar"],
              ] as [Tab, string, React.ComponentProps<typeof Icon>["name"]][]
            ).map(([id, l, icon]) => (
              <Touch key={id} onPress={() => setTab(id)} style={[s.segItem, tab === id && { backgroundColor: hue.color, borderBottomColor: hue.deep }]}>
                <Icon name={icon} size={15} color={tab === id ? "#fff" : COLORS.muted} />
                <Muted size="sm" weight={700} color={tab === id ? "#fff" : COLORS.muted}>
                  {l}
                </Muted>
              </Touch>
            ))}
          </View>

          {tab === "exam" ? (
            <Card style={{ marginBottom: SPACE[5] }}>
              {editExam || !subject.examDate ? (
                editExam ? (
                  <View style={{ gap: SPACE[2] }}>
                    <Label>sprawdzian</Label>
                    <Input value={date} onChangeText={setDate} placeholder="Data: RRRR-MM-DD" keyboardType="numbers-and-punctuation" />
                    <Input value={label} onChangeText={setLabel} placeholder="np. kartkówka z fotosyntezy" />
                    <View style={{ flexDirection: "row", gap: SPACE[2], marginTop: SPACE[1] }}>
                      <Button3D label="Anuluj" variant="ghost" size="sm" onPress={() => setEditExam(false)} style={{ flex: 1 }} />
                      <Button3D label={busy ? "…" : "Zapisz"} size="sm" onPress={() => saveExam()} disabled={busy} style={{ flex: 2 }} />
                    </View>
                    {subject.examDate ? <Button3D label="Usuń sprawdzian" variant="red" size="sm" onPress={() => saveExam(true)} /> : null}
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE[3] }}>
                    <Mascot state="think" size={84} streak={app.streak} />
                    <View style={{ flex: 1, gap: SPACE[2] }}>
                      <Title size="md">Masz sprawdzian?</Title>
                      <Body size="sm" color={COLORS.muted}>
                        Podaj datę, a rozpiszę tematy na dni: poziomy, powtórki i symulacja dzień przed.
                      </Body>
                      <Button3D
                        label="Ustaw datę"
                        variant="blue"
                        size="sm"
                        onPress={() => {
                          setDate(subject.examDate ?? "");
                          setLabel(subject.examLabel ?? "");
                          setEditExam(true);
                        }}
                      />
                    </View>
                  </View>
                )
              ) : (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE[3], marginBottom: SPACE[3] }}>
                    <Mascot state={days !== null && days <= 2 ? "sad" : "think"} size={72} streak={app.streak} />
                    <View style={{ flex: 1 }}>
                      <MascotBubble text={days === null ? "Ten sprawdzian już był." : days === 0 ? "To dziś! Szybka powtórka?" : days <= 2 ? "Blisko. Skup się na słabych pytaniach." : "Mamy czas. Trzymajmy się planu."} tail="left" />
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE[3] }}>
                    <Title size="md" style={{ flex: 1 }} numberOfLines={2}>
                      {subject.examLabel || "Sprawdzian"} · {subject.examDate}
                    </Title>
                    <Touch onPress={() => setEditExam(true)}>
                      <Muted size="xs" weight={700} color={hue.color}>
                        Zmień
                      </Muted>
                    </Touch>
                  </View>
                  {days !== null ? <ExamPlanView topics={topics} progress={app.progress} examDate={subject.examDate} onLevel={(topicId, levelId) => router.push({ pathname: "/t/[topicId]/l/[levelId]", params: { topicId, levelId } })} /> : null}
                </>
              )}
            </Card>
          ) : (
            <>
              {topics.length === 0 ? (
                <Card style={{ alignItems: "center", gap: SPACE[3] }}>
                  <Mascot state="think" size={110} streak={app.streak} />
                  <Display size="lg" weight={700} center>
                    Jeszcze pusto
                  </Display>
                  <Body center color={COLORS.muted}>
                    Sfotografuj notatki albo wpisz hasło — AI zrobi poziomy, fiszki, gry i quiz.
                  </Body>
                </Card>
              ) : (
                <View style={{ gap: SPACE[3] }}>
                  {topics.map((t, i) => (
                    <Animated.View key={t.id} entering={FadeInDown.delay(80 + i * 60).duration(300)}>
                      <UnitCard topic={t} index={i} onOpen={() => openTopic(t)} onContinue={() => continueTopic(t)} />
                    </Animated.View>
                  ))}
                </View>
              )}
              {topics.length ? (
                <View style={[s.ctaRow, { marginTop: SPACE[4] }]}>
                  <Button3D label="Fiszki" variant="ghost" onPress={() => router.push({ pathname: "/s/[subjectId]/cards", params: { subjectId: subject.id } })} style={{ flex: 1 }} left={<Icon name="layers" size={16} color={COLORS.textSoft} />} />
                  <Button3D label="Egzamin" variant="ghost" onPress={() => router.push({ pathname: "/s/[subjectId]/exam", params: { subjectId: subject.id } })} style={{ flex: 1 }} left={<Icon name="school" size={16} color={COLORS.textSoft} />} />
                </View>
              ) : null}
            </>
          )}

          <Touch onPress={remove} hitSlop={8} style={{ alignSelf: "center", padding: SPACE[3], marginTop: SPACE[4] }}>
            <Muted size="xs" weight={600} color={COLORS.faint}>
              Usuń przedmiot
            </Muted>
          </Touch>
        </ScrollView>
      </View>
    </HueProvider>
  );
}

function BannerStat({ icon, value, label }: { icon: React.ComponentProps<typeof Icon>["name"]; value: string; label: string }) {
  return (
    <View style={s.bstat}>
      <Icon name={icon} size={14} color="rgba(255,255,255,0.9)" />
      <Num size="base" weight={800} color="#fff" style={{ fontSize: 15 }}>
        {value}
      </Num>
      <Muted size="xs" color="rgba(255,255,255,0.8)" style={{ fontSize: 10 }}>
        {label}
      </Muted>
    </View>
  );
}

/** Karta „Jednostka N”: emoji, nazwa, pasek postępu, gwiazdki, przycisk Kontynuuj/Powtórz 3D. */
function UnitCard({ topic, index, onOpen, onContinue }: { topic: Topic; index: number; onOpen: () => void; onContinue: () => void }) {
  const app = useApp();
  const hue = hueFrom(app.findSubject(topic.subjectId)?.accent2, topic.name);
  const p = app.progressFor(topic.id);
  const { done, total, pct } = subjectCompletion(topic, p);
  const stars = topic.levels.reduce((a, l) => a + levelProgress(p, l.id).stars, 0);
  const finished = done === total && total > 0;
  return (
    <Card style={{ padding: SPACE[4], gap: SPACE[3] }}>
      <Touch onPress={onOpen} style={{ flexDirection: "row", alignItems: "center", gap: SPACE[3] }}>
        <View style={[s.unitEmoji, { backgroundColor: hue.soft, borderColor: hue.ring }]}>
          <Display size="xl" weight={700} style={{ lineHeight: 30 }}>
            {topic.emoji}
          </Display>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label color={hue.color}>jednostka {index + 1}</Label>
          <Title size="md" numberOfLines={2}>
            {topic.name}
          </Title>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <Icon name="star" size={12} color={PLAY.yellow} />
            <Muted size="xs" weight={600} style={tabular}>
              {stars}/{total * 3} · {done}/{total} poziomów · {topic.source === "prompt" ? "z hasła" : "z materiałów"}
            </Muted>
          </View>
        </View>
        <Icon name="chevron-forward" size={20} color={COLORS.faint} />
      </Touch>
      <View style={s.bar}>
        <View style={[s.barFill, { width: `${pct}%`, backgroundColor: hue.color }]} />
      </View>
      <View style={{ flexDirection: "row", gap: SPACE[2] }}>
        <Button3D label={finished ? "Powtórz" : done === 0 ? "Start" : "Kontynuuj"} variant={finished ? "blue" : "green"} size="sm" onPress={onContinue} style={{ flex: 1 }} right={<Icon name="play" size={14} color="#fff" />} />
        <Button3D label="Ścieżka" variant="ghost" size="sm" onPress={onOpen} style={{ flex: 1 }} left={<Icon name="map" size={14} color={COLORS.textSoft} />} />
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: UI.gutter, paddingTop: SPACE[2] },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: UI.gutter, paddingBottom: SPACE[2] },
  banner: { borderRadius: RADIUS.xl, padding: SPACE[5], borderBottomWidth: 6, marginBottom: SPACE[4] },
  emojiBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  bannerStats: { flexDirection: "row", gap: SPACE[2], marginTop: SPACE[4] },
  bstat: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: RADIUS.sm, paddingVertical: 8, paddingHorizontal: 10 },
  ctaRow: { flexDirection: "row", gap: SPACE[3], marginBottom: SPACE[4] },
  cta: { padding: SPACE[4], gap: 4, minHeight: 104 },
  seg: { flexDirection: "row", gap: 4, marginBottom: SPACE[4], padding: 4, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.md },
  segItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: RADIUS.sm, borderBottomWidth: 3, borderBottomColor: "transparent" },
  unitEmoji: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  bar: { height: 8, backgroundColor: COLORS.bg3, borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999 },
});
