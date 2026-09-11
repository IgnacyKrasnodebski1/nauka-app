import { STAGES } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SubjectCard } from "@/components/SubjectCard";
import { Chips, Empty, H1, Muted, TopBar, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { C, FONT, R } from "@/lib/theme";

export default function Library() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState("all");
  const list = useMemo(() => app.publicSubjects.filter((s) => stage === "all" || s.stage === stage), [app.publicSubjects, stage]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title="📚 Biblioteka" />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 40 + insets.bottom }]} refreshControl={<RefreshControl refreshing={app.refreshing} onRefresh={app.refresh} tintColor={C.cyan} />} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <H1>Gotowe przedmioty</H1>
          <Muted>Publiczne zestawy zrobione z prezek z zajęć. Dodaj do swoich i ucz się od razu — działa offline.</Muted>
        </View>
        <Chips items={[{ id: "all", label: "Wszystko 🌀" }, ...STAGES.map((st) => ({ id: st.id, label: `${st.emoji} ${st.label}` }))]} value={stage} onChange={setStage} />
        {list.length === 0 ? (
          <Empty emoji="🕳️" title="Nic tu nie ma" text="Na tym etapie nie ma jeszcze publicznych przedmiotów." />
        ) : (
          list.map((sub) => {
            const has = app.inLibrary(sub);
            return (
              <SubjectCard
                key={sub.id}
                subject={sub}
                onPress={() => router.push({ pathname: "/s/[id]", params: { id: sub.slug ?? sub.id } })}
                right={
                  <Touch
                    onPress={() => {
                      void app.toggleLibrary(sub);
                      app.showToast(has ? "Usunięte z Twoich" : "Dodane do Twoich ✅");
                    }}
                    hitSlop={8}
                    style={[s.add, has && s.added]}
                  >
                    <Text style={[s.addTxt, has && { color: C.lime }]}>{has ? "✓ masz" : "+ dodaj"}</Text>
                  </Touch>
                }
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 6 },
  hero: { paddingVertical: 14, paddingHorizontal: 4, gap: 6 },
  add: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: R.pill, backgroundColor: C.faint2, borderWidth: 1, borderColor: C.border2 },
  added: { backgroundColor: "#16331f", borderColor: "rgba(30,215,96,.3)" },
  addTxt: { color: C.txt, fontWeight: FONT.bold, fontSize: 12 },
});
