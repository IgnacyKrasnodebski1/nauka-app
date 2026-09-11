import { useRouter } from "expo-router";
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccentGradient } from "@/components/Accent";
import { OnboardingModal } from "@/components/Onboarding";
import { SubjectCard } from "@/components/SubjectCard";
import { H1, Muted, StatPill, TopBar, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { C, FONT, R } from "@/lib/theme";

export default function Home() {
  const app = useApp();
  const auth = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const own = app.ownSubjects;
  const lib = app.homeSubjects.filter((s) => !own.includes(s));

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
          <H1>{auth.user ? "Siema, lecimy z nauką 👇" : "Wybierz przedmiot 👇"}</H1>
          <Muted>Poziomy jak w Duolingo, fiszki, mini-gry, quizy i symulacja egzaminu. Z Twoich notatek, slajdów i zdjęć.</Muted>
        </View>

        <Touch onPress={() => router.push("/new")} style={s.ctaWrap}>
          <AccentGradient style={s.cta}>
            <Text style={s.ctaEmoji}>📸</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.ctaTitle}>Dodaj materiały</Text>
              <Text style={s.ctaSub}>zdjęcia notatek, slajdy, PDF albo tekst → AI robi z tego lekcje</Text>
            </View>
            <Text style={s.ctaChev}>›</Text>
          </AccentGradient>
        </Touch>

        {app.offline ? <Text style={s.offline}>📴 offline — pokazuję zapisane przedmioty</Text> : null}

        {own.length ? (
          <>
            <Text style={s.section}>Twoje przedmioty</Text>
            {own.map((sub) => (
              <SubjectCard key={sub.id} subject={sub} onPress={() => router.push({ pathname: "/s/[id]", params: { id: sub.id } })} />
            ))}
          </>
        ) : null}

        <Text style={s.section}>{own.length ? "Z biblioteki" : "Przedmioty"}</Text>
        {lib.length ? (
          lib.map((sub) => <SubjectCard key={sub.id} subject={sub} onPress={() => router.push({ pathname: "/s/[id]", params: { id: sub.slug ?? sub.id } })} />)
        ) : (
          <Touch onPress={() => router.push("/(tabs)/library")} style={s.addcard}>
            <View style={s.addEmoji}>
              <Text style={{ fontSize: 28, color: C.muted }}>＋</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.addTitle}>Pusto tu. Dodaj coś z biblioteki</Text>
              <Text style={s.addSub}>Gotowe przedmioty (makro, krypto, języki, psychologia…) — jeden tap i są na Twojej liście.</Text>
            </View>
          </Touch>
        )}

        {!auth.user && auth.enabled ? (
          <Touch onPress={() => router.push("/(auth)/login")} style={s.loginHint}>
            <Text style={s.loginTxt}>👻 Uczysz się jako gość. Zaloguj się, żeby mieć postępy w chmurze i generować własne przedmioty →</Text>
          </Touch>
        ) : null}
      </ScrollView>

      <OnboardingModal
        open={app.ready && !app.onboarded}
        initial={app.stage}
        onDone={(st) => {
          app.setStage(st);
          app.setOnboarded();
          app.showToast("Git, dopasowane 🎯");
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  logo: { color: C.txt, fontWeight: FONT.black, fontSize: 18, letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 16, paddingTop: 6 },
  hero: { paddingVertical: 14, paddingHorizontal: 4, gap: 6 },
  ctaWrap: { marginBottom: 18, borderRadius: R.lg, overflow: "hidden" },
  cta: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: R.lg },
  ctaEmoji: { fontSize: 36 },
  ctaTitle: { color: "#fff", fontSize: 19, fontWeight: FONT.black, letterSpacing: -0.3 },
  ctaSub: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 2, lineHeight: 17, fontWeight: FONT.semi },
  ctaChev: { color: "#fff", fontSize: 26, fontWeight: FONT.bold },
  offline: { color: C.muted, fontSize: 13, fontWeight: FONT.semi, marginBottom: 12, textAlign: "center" },
  section: { color: C.muted, fontSize: 12, fontWeight: FONT.bold, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, marginTop: 6, paddingHorizontal: 4 },
  addcard: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.15)", borderRadius: R.lg, padding: 16 },
  addEmoji: { width: 54, height: 54, borderRadius: 16, backgroundColor: C.faint, alignItems: "center", justifyContent: "center" },
  addTitle: { color: C.txt, fontWeight: FONT.bold, fontSize: 15 },
  addSub: { color: C.muted, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  loginHint: { marginTop: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 14 },
  loginTxt: { color: C.muted, fontSize: 13.5, lineHeight: 19, fontWeight: FONT.semi },
});
