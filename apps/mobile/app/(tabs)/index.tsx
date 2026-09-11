import { useRouter } from "expo-router";
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccentGradient } from "@/components/Accent";
import { SubjectCard } from "@/components/SubjectCard";
import { H1, Muted, StatPill, TopBar, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { C, FONT, R } from "@/lib/theme";

/** Home „Przedmioty”: streak/XP, karta „Dziś”, siatka przedmiotów, „+ przedmiot”. */
export default function Home() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const d = app.daily;
  const hasSession = d.items.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar
        title={
          <Text style={s.logo}>
            📚 <Text style={{ color: C.pink }}>NAUKA</Text>
          </Text>
        }
        right={
          <>
            <StatPill icon="🔥" value={app.streak} unit="dni" />
            <StatPill icon="⚡" value={app.totalXp} unit="xp" />
          </>
        }
      />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 40 + insets.bottom }]} refreshControl={<RefreshControl refreshing={app.refreshing} onRefresh={app.refresh} tintColor={C.cyan} />} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <H1>Twoje przedmioty</H1>
          <Muted>Do każdego dodajesz tematy — ze zdjęć notatek, PDF-a albo z samego hasła. Potem 10 minut dziennie.</Muted>
        </View>

        <Touch onPress={() => router.push("/(tabs)/today")} style={s.todayWrap}>
          <AccentGradient style={s.today}>
            <View style={{ flex: 1 }}>
              <Text style={s.todayTitle}>⚡ Dziś · ~{d.minutes} min</Text>
              <Text style={s.todaySub}>
                {hasSession
                  ? [d.reviewCount ? `${d.reviewCount} fiszek do powtórki` : null, d.weakCount ? `${d.weakCount} słabych pytań` : null, d.newLevel ? `nowy poziom: ${d.newLevel.title}` : null].filter(Boolean).join(" · ")
                  : "brak zadań — dodaj temat, a ułożę Ci sesję"}
              </Text>
            </View>
            <View style={s.startBtn}>
              <Text style={s.startTxt}>{hasSession ? "Start ›" : "Zobacz ›"}</Text>
            </View>
          </AccentGradient>
        </Touch>

        {app.offline ? <Text style={s.offline}>📴 offline — pokazuję zapisane dane</Text> : null}

        <View style={s.grid}>
          {app.subjects.map((sub) => (
            <SubjectCard key={sub.id} subject={sub} onPress={() => router.push({ pathname: "/s/[subjectId]", params: { subjectId: sub.id } })} />
          ))}
          <Touch onPress={() => router.push("/onboarding-add")} style={s.addcard}>
            <Text style={{ fontSize: 30, color: C.muted }}>＋</Text>
            <Text style={s.addTitle}>przedmiot</Text>
          </Touch>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  logo: { color: C.txt, fontWeight: FONT.black, fontSize: 18, letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 16, paddingTop: 6 },
  hero: { paddingVertical: 12, paddingHorizontal: 4, gap: 6 },
  todayWrap: { marginBottom: 16, borderRadius: R.lg, overflow: "hidden" },
  today: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18, borderRadius: R.lg },
  todayTitle: { color: "#fff", fontSize: 18, fontWeight: FONT.black, letterSpacing: -0.3 },
  todaySub: { color: "rgba(255,255,255,0.88)", fontSize: 13, marginTop: 3, lineHeight: 17, fontWeight: FONT.semi },
  startBtn: { backgroundColor: "rgba(0,0,0,0.28)", borderRadius: R.pill, paddingVertical: 10, paddingHorizontal: 14 },
  startTxt: { color: "#fff", fontWeight: FONT.black, fontSize: 14 },
  offline: { color: C.muted, fontSize: 13, fontWeight: FONT.semi, marginBottom: 12, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  addcard: { flexBasis: "47%", flexGrow: 1, minHeight: 150, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.15)", borderRadius: R.lg, alignItems: "center", justifyContent: "center", gap: 4 },
  addTitle: { color: C.muted, fontWeight: FONT.bold, fontSize: 14 },
});
