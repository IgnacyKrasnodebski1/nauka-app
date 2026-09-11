import { XP, newCard, review, type SessionItem, type SrsGrade } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Flashcard } from "@/components/Flashcard";
import { QuizCard } from "@/components/QuizCard";
import { ResultView } from "@/components/ResultView";
import { Empty, PillButton, ProgressBar, Spec, StatPill, TopBar, Touch } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { minutesSince } from "@/lib/games";
import { C, FONT, R } from "@/lib/theme";

type Phase = "intro" | "run" | "done";

/**
 * „Dziś” — dzienna sesja z shared `buildDailySession`: fiszki do powtórki (ocena 0–3 → `review()` → srs_cards),
 * słabe pytania (odpowiedź → `progress.weak`), na końcu nowy poziom (link do lekcji). Ekran końcowy z XP.
 */
export default function Today() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("intro");
  const [items, setItems] = useState<SessionItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [xp, setXp] = useState(0);
  const [stats, setStats] = useState({ reviewed: 0, weakOk: 0, weakBad: 0 });
  const startedAt = useRef(0);
  const d = app.daily;

  const start = () => {
    setItems(d.items);
    setIdx(0);
    setXp(0);
    setStats({ reviewed: 0, weakOk: 0, weakBad: 0 });
    setFlipped(false);
    setPicked(null);
    startedAt.current = Date.now();
    setPhase(d.items.length ? "run" : "intro");
  };

  const item = items[idx];
  const topic = useMemo(() => (item ? app.findTopic(item.topicId) : undefined), [item, app]);

  const advance = () => {
    setFlipped(false);
    setPicked(null);
    if (idx + 1 < items.length) setIdx(idx + 1);
    else finish();
  };

  const finish = () => {
    app.logActivity(xp, minutesSince(startedAt.current));
    haptic.heavy();
    setPhase("done");
  };

  const gradeCard = (g: SrsGrade) => {
    if (!item?.card) return;
    const srs = app.srsFor(item.topicId);
    app.setSrsFor(item.topicId, { ...srs, [item.card.key]: review(srs[item.card.key] ?? newCard(), g) });
    if (g >= 2) {
      app.addXp(item.topicId, XP.flashcardKnown);
      setXp((x) => x + XP.flashcardKnown);
      haptic.ok();
    } else haptic.tap();
    setStats((s) => ({ ...s, reviewed: s.reviewed + 1 }));
    advance();
  };

  const answerWeak = (i: number) => {
    if (!item?.question || picked !== null) return;
    setPicked(i);
    const q = item.question;
    const lvl = topic?.levels.find((l) => l.id === q.levelId);
    const qi = lvl?.quiz.findIndex((x) => x.q === q.q) ?? -1;
    const ok = i === q.c;
    if (qi >= 0) app.setWeak(item.topicId, q.levelId, ok ? [] : [qi], ok ? [qi] : []);
    if (ok) {
      app.addXp(item.topicId, XP.quizCorrect);
      setXp((x) => x + XP.quizCorrect);
      haptic.ok();
      setStats((s) => ({ ...s, weakOk: s.weakOk + 1 }));
    } else {
      haptic.bad();
      setStats((s) => ({ ...s, weakBad: s.weakBad + 1 }));
    }
  };

  const openLevel = () => {
    if (!item?.levelId) return;
    finish();
    router.push({ pathname: "/t/[topicId]/l/[levelId]", params: { topicId: item.topicId, levelId: item.levelId } });
  };

  const head = (
    <TopBar
      title="⚡ Dziś"
      right={
        <>
          <StatPill icon="🔥" value={app.streak} unit="dni" />
          <StatPill icon="⚡" value={app.totalXp} unit="xp" />
        </>
      }
    />
  );

  if (phase === "run" && item) {
    const pct = (idx / items.length) * 100;
    const kindLabel = item.kind === "review" ? "🔁 powtórka" : item.kind === "weak" ? "🎯 słabe pytanie" : "🆕 nowy poziom";
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[s.runHead, { paddingTop: insets.top + 10 }]}>
          <Touch onPress={() => setPhase("intro")} hitSlop={10}>
            <Text style={s.x}>✕</Text>
          </Touch>
          <View style={{ flex: 1, gap: 4 }}>
            <ProgressBar pct={pct} />
            <Text style={s.phase}>
              {kindLabel} · {idx + 1}/{items.length} · {topic?.name ?? ""}
            </Text>
          </View>
          <Text style={s.xpLive}>+{xp}</Text>
        </View>
        <View style={s.body}>
          {item.kind === "review" && item.card ? (
            <Animated.View key={`r${idx}`} entering={FadeInRight.duration(200)} style={{ flex: 1 }}>
              <Flashcard term={item.card.t} def={item.card.d} tag={topic?.name} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
              {flipped ? (
                <View style={s.btns}>
                  {(
                    [
                      [0, "nie 😵", "#33222e", "#ff7a99"],
                      [1, "trudne 😬", "#33291f", "#ffc46b"],
                      [2, "umiem 💪", "#16331f", "#7dffa6"],
                      [3, "łatwe 😎", "#0f2f33", "#8ff0ff"],
                    ] as [SrsGrade, string, string, string][]
                  ).map(([g, l, bg, fg]) => (
                    <Touch key={g} onPress={() => gradeCard(g)} style={[s.btn, { backgroundColor: bg }]}>
                      <Text style={[s.btnTxt, { color: fg }]}>{l}</Text>
                    </Touch>
                  ))}
                </View>
              ) : (
                <View style={s.btns}>
                  <Touch onPress={() => setFlipped(true)} style={[s.btn, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
                    <Text style={s.btnTxt}>pokaż odpowiedź 👀</Text>
                  </Touch>
                </View>
              )}
            </Animated.View>
          ) : null}
          {item.kind === "weak" && item.question ? (
            <ScrollView key={`w${idx}`} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
              <Animated.View entering={FadeInRight.duration(200)}>
                <QuizCard q={item.question} picked={picked} reveal={picked !== null} onPick={answerWeak} tag={`ostatnio nie poszło · ${topic?.name ?? ""}`}>
                  {picked !== null ? <PillButton label="dalej →" onPress={advance} style={{ marginTop: 14 }} /> : null}
                </QuizCard>
              </Animated.View>
            </ScrollView>
          ) : null}
          {item.kind === "new" && item.levelId ? (
            <Animated.View key={`n${idx}`} entering={FadeInRight.duration(200)} style={s.newCard}>
              <Text style={{ fontSize: 52 }}>🆕</Text>
              <Text style={s.newTitle}>Nowy poziom</Text>
              <Text style={s.newSub}>
                {topic?.emoji} {topic?.name} → {topic?.levels.find((l) => l.id === item.levelId)?.title}
              </Text>
              <PillButton label="otwórz lekcję 🚀" onPress={openLevel} style={{ marginTop: 8 }} />
              <PillButton label="dziś pomijam" ghost onPress={advance} />
            </Animated.View>
          ) : null}
        </View>
      </View>
    );
  }

  if (phase === "done") {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {head}
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 16, paddingBottom: 40 + insets.bottom }}>
          <ResultView emoji="🏁" title="Sesja zrobiona!" verdict={`Powtórki: ${stats.reviewed} · słabe pytania: ${stats.weakOk} ✅ / ${stats.weakBad} ❌. Wpadaj jutro — seria się liczy.`}>
            <Text style={s.xpBig}>⚡ +{xp} xp</Text>
            <PillButton label="do przedmiotów 📚" onPress={() => router.push("/(tabs)")} style={{ marginTop: 8 }} />
            <PillButton label="jeszcze raz?" ghost onPress={() => setPhase("intro")} />
          </ResultView>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {head}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom, gap: 12 }} showsVerticalScrollIndicator={false}>
        {app.topics.length === 0 ? (
          <Empty emoji="🧘" title="Nic na dziś" text="Dodaj pierwszy temat w przedmiocie (zdjęcia, PDF albo hasło), a ułożę Ci codzienną sesję." action={<PillButton label="do przedmiotów 📚" onPress={() => router.push("/(tabs)")} />} />
        ) : (
          <>
            <Text style={s.h}>Twoja sesja na dziś</Text>
            <Text style={s.sub}>~{d.minutes} min · powtórki + słabe pytania + jeden nowy poziom</Text>
            <View style={s.specs}>
              <Spec value={d.reviewCount} label="fiszek" />
              <Spec value={d.weakCount} label="słabych" />
              <Spec value={d.newLevel ? 1 : 0} label="nowy poziom" />
            </View>
            {d.newLevel ? (
              <View style={s.next}>
                <Text style={s.nextLbl}>NOWY POZIOM</Text>
                <Text style={s.nextTxt}>
                  {app.findTopic(d.newLevel.topicId)?.emoji} {app.findTopic(d.newLevel.topicId)?.name} → {d.newLevel.title}
                </Text>
              </View>
            ) : null}
            {d.items.length ? <PillButton label="Start ⚡" onPress={start} /> : <Empty emoji="✅" title="Na dziś czysto" text="Wszystkie poziomy zrobione, żadnych powtórek. Dodaj nowy temat albo wróć jutro." />}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  h: { color: C.txt, fontSize: 24, fontWeight: FONT.black, letterSpacing: -0.5 },
  sub: { color: C.muted, fontSize: 14, fontWeight: FONT.semi },
  specs: { flexDirection: "row", gap: 10, justifyContent: "center", flexWrap: "wrap", marginVertical: 6 },
  next: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 14, gap: 4 },
  nextLbl: { color: C.cyan, fontSize: 11, fontWeight: FONT.bold, letterSpacing: 0.7 },
  nextTxt: { color: C.txt, fontSize: 15.5, fontWeight: FONT.bold },
  runHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  x: { color: C.txt, fontSize: 20, fontWeight: FONT.bold, width: 30 },
  phase: { color: C.muted, fontSize: 11.5, fontWeight: FONT.bold },
  xpLive: { color: C.lime, fontWeight: FONT.black, fontSize: 15 },
  body: { flex: 1, paddingHorizontal: 16, paddingBottom: 12 },
  btns: { flexDirection: "row", gap: 8, marginTop: 14 },
  btn: { flex: 1, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  btnTxt: { fontSize: 13.5, fontWeight: FONT.bold, color: "#fff" },
  newCard: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 24, padding: 24 },
  newTitle: { color: C.txt, fontSize: 24, fontWeight: FONT.black },
  newSub: { color: C.muted, fontSize: 15, fontWeight: FONT.semi, textAlign: "center", lineHeight: 21 },
  xpBig: { color: C.lime, fontSize: 28, fontWeight: FONT.black },
});
