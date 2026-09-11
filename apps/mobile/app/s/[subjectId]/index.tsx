import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccentGradient, AccentProvider } from "@/components/Accent";
import { ExamPlanView } from "@/components/ExamPlanView";
import { examBadge, examCountdown, subjectStats } from "@/components/SubjectCard";
import { TopicCard } from "@/components/TopicCard";
import { BackButton, Card, Empty, Loading, PillButton, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { C, FONT, R } from "@/lib/theme";

/** Strona przedmiotu: nagłówek w kolorze, sekcja Sprawdzian (plan), tematy, CTA nowego tematu, Fiszki/Egzamin z całości, usuń. */
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
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
        <Empty emoji="🫥" title="Nie ma takiego przedmiotu" action={<PillButton label="wróć" onPress={back} />} />
      </View>
    );

  const st = subjectStats(topics, app.progressFor);
  const days = examCountdown(subject);

  const saveExam = async () => {
    const d = date.trim();
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return app.showToast("Data w formacie RRRR-MM-DD");
    if (d && Number.isNaN(new Date(d + "T00:00:00").getTime())) return app.showToast("To nie jest poprawna data");
    setBusy(true);
    try {
      await app.updateSubject(subject.id, { examDate: d || null, examLabel: label.trim() || null });
      setEditExam(false);
      app.showToast(d ? "Plan gotowy 📅" : "Sprawdzian usunięty");
    } catch (e) {
      app.showToast(e instanceof Error ? e.message : "Nie zapisało się");
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert("Usunąć przedmiot?", `„${subject.name}” razem z ${topics.length} tematami i postępami. Tego nie da się cofnąć.`, [
      { text: "anuluj", style: "cancel" },
      {
        text: "usuń",
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
    <AccentProvider accent={subject.accent} accent2={subject.accent2}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <AccentGradient style={[s.header, { paddingTop: insets.top + 10 }]}>
          <View style={s.headRow}>
            <BackButton onPress={back} />
            <Touch onPress={remove} hitSlop={8} style={s.trash}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: FONT.bold }}>🗑 usuń</Text>
            </Touch>
          </View>
          <Text style={s.emoji}>{subject.emoji}</Text>
          <Text style={s.name}>{subject.name}</Text>
          <Text style={s.stats}>
            {st.topics} {st.topics === 1 ? "temat" : st.topics < 5 ? "tematy" : "tematów"} · {st.done}/{st.total} poziomów · {st.pct}%
          </Text>
        </AccentGradient>

        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 60 + insets.bottom }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.ctaRow}>
            <Touch onPress={() => newTopic("materials")} style={s.cta}>
              <Text style={s.ctaEmoji}>📸</Text>
              <Text style={s.ctaTxt}>Z materiałów</Text>
              <Text style={s.ctaSub}>zdjęcia, PDF, tekst</Text>
            </Touch>
            <Touch onPress={() => newTopic("prompt")} style={s.cta}>
              <Text style={s.ctaEmoji}>✍️</Text>
              <Text style={s.ctaTxt}>Z hasła</Text>
              <Text style={s.ctaSub}>np. „fotosynteza”</Text>
            </Touch>
          </View>

          <Card style={{ marginBottom: 14 }}>
            <View style={s.secHead}>
              <Text style={s.secTitle}>🎯 Sprawdzian</Text>
              {subject.examDate && !editExam ? (
                <Touch onPress={() => setEditExam(true)}>
                  <Text style={s.link}>zmień</Text>
                </Touch>
              ) : null}
            </View>
            {editExam || !subject.examDate ? (
              editExam ? (
                <View style={{ gap: 8 }}>
                  <TextInput value={date} onChangeText={setDate} placeholder="data: RRRR-MM-DD" placeholderTextColor={C.muted} keyboardType="numbers-and-punctuation" style={s.input} />
                  <TextInput value={label} onChangeText={setLabel} placeholder="np. kartkówka z fotosyntezy" placeholderTextColor={C.muted} style={s.input} />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <PillButton label="anuluj" ghost small onPress={() => setEditExam(false)} style={{ flex: 1 }} />
                    <PillButton label={busy ? "…" : "zapisz 📅"} small onPress={saveExam} disabled={busy} style={{ flex: 2 }} />
                  </View>
                  {subject.examDate ? <PillButton label="usuń sprawdzian" ghost small danger onPress={() => { setDate(""); void saveExam(); }} /> : null}
                </View>
              ) : (
                <>
                  <Text style={s.p}>Podaj datę, a rozpiszę Ci tematy na dni: poziomy, powtórki i symulacja dzień przed.</Text>
                  <PillButton label="Mam sprawdzian 📅" small onPress={() => { setDate(subject.examDate ?? ""); setLabel(subject.examLabel ?? ""); setEditExam(true); }} style={{ marginTop: 10 }} />
                </>
              )
            ) : (
              <>
                <Text style={s.examLbl}>
                  {subject.examLabel || "sprawdzian"} · {subject.examDate}
                  {days !== null ? ` · ${examBadge(days)}` : " · już był"}
                </Text>
                {days !== null ? <ExamPlanView topics={topics} progress={app.progress} examDate={subject.examDate} onLevel={(topicId, levelId) => router.push({ pathname: "/t/[topicId]/l/[levelId]", params: { topicId, levelId } })} /> : null}
              </>
            )}
          </Card>

          <View style={s.secHead}>
            <Text style={s.secTitle}>📚 Tematy</Text>
            {topics.length ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Touch onPress={() => router.push({ pathname: "/s/[subjectId]/cards", params: { subjectId: subject.id } })} style={s.miniBtn}>
                  <Text style={s.miniTxt}>🎴 Fiszki</Text>
                </Touch>
                <Touch onPress={() => router.push({ pathname: "/s/[subjectId]/exam", params: { subjectId: subject.id } })} style={s.miniBtn}>
                  <Text style={s.miniTxt}>🎯 Egzamin</Text>
                </Touch>
              </View>
            ) : null}
          </View>
          {topics.length === 0 ? (
            <Empty emoji="🫙" title="Jeszcze pusto" text="Dodaj pierwszy temat: sfotografuj notatki albo wpisz hasło — AI zrobi poziomy, fiszki, gry i quiz." />
          ) : (
            topics.map((t) => <TopicCard key={t.id} topic={t} onPress={() => router.push({ pathname: "/t/[topicId]", params: { topicId: t.id } })} />)
          )}
        </ScrollView>
      </View>
    </AccentProvider>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 18, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  trash: { backgroundColor: "rgba(0,0,0,0.25)", borderRadius: R.pill, paddingVertical: 7, paddingHorizontal: 12 },
  emoji: { fontSize: 44 },
  name: { color: "#fff", fontSize: 26, fontWeight: FONT.black, letterSpacing: -0.6, marginTop: 4 },
  stats: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: FONT.bold, marginTop: 4 },
  scroll: { paddingHorizontal: 16, paddingTop: 14 },
  ctaRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  cta: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, borderRadius: R.lg, padding: 14, alignItems: "center", gap: 2 },
  ctaEmoji: { fontSize: 30 },
  ctaTxt: { color: C.txt, fontWeight: FONT.black, fontSize: 15 },
  ctaSub: { color: C.muted, fontSize: 11.5, fontWeight: FONT.semi },
  secHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  secTitle: { color: C.txt, fontSize: 16, fontWeight: FONT.black },
  link: { color: C.cyan, fontWeight: FONT.bold, fontSize: 13 },
  p: { color: C.muted, fontSize: 14, lineHeight: 20 },
  input: { backgroundColor: "#0e0e1a", borderWidth: 2, borderColor: C.border2, borderRadius: R.sm, color: C.txt, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  examLbl: { color: C.txt, fontWeight: FONT.bold, fontSize: 14, marginBottom: 10 },
  miniBtn: { backgroundColor: C.faint2, borderWidth: 1, borderColor: C.border2, borderRadius: R.pill, paddingVertical: 7, paddingHorizontal: 11 },
  miniTxt: { color: C.txt, fontWeight: FONT.bold, fontSize: 12.5 },
});
