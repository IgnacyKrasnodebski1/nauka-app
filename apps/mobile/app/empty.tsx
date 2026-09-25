import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Display, Muted } from "@/components/Text";
import { Blob, Btn, Screen, useTop } from "@/components/ui";
import { T } from "@/lib/theme";

const STEPS = [
  ["Robisz zdjęcie strony z książki", "albo wrzucasz PDF, notatki, samo hasło"],
  ["Powstają poziomy, fiszki i pytania", "możesz wszystko poprawić przed startem"],
  ["Uczysz się po 10 minut dziennie", "materiał wraca tuż przed zapomnieniem"],
];

/** Pusty stan (EmptyState.html): pierwsze uruchomienie bez przedmiotów — 3 kroki, „Zaczynamy” → Dodaj materiał, katalog. */
export default function EmptyState() {
  const router = useRouter();
  const top = useTop(22);
  return (
    <Screen pad={false} blob={<><Blob tone="acid" size={280} top={60} right={-90} /><Blob tone="pink" size={240} bottom={120} left={-100} d={3} /></>}>
      <View style={[s.wrap, { paddingTop: top }]}>
        <Display size={21} ls={-0.8}>
          RECALL
          <Display size={21} color={T.acid}>
            .
          </Display>
        </Display>
        <View style={{ alignItems: "center", paddingVertical: 10 }}>
          <View style={{ width: 190, height: 150 }}>
            <Motion kind="sway" style={[s.art, { top: 18, left: 6, backgroundColor: T.surface, borderColor: T.line }]} />
            <Motion kind="sway" d={2} style={[s.art, { top: 8, left: 30, backgroundColor: "#241536", borderColor: "#46216B" }]} />
            <Motion kind="bob" style={[s.artMain]}>
              <Icon name="upload" size={58} stroke={2.4} color={T.onAcid} />
            </Motion>
          </View>
        </View>
        <Motion kind="up" d={1}>
          <Display size={31} ls={-1.1} lh={34}>
            Ucz się mądrzej, nie dłużej
          </Display>
          <Muted size={14} lh={21} style={{ marginTop: 9 }}>
            Zrób zdjęcie strony z podręcznika albo wrzuć notatki. Za minutę masz z tego lekcję.
          </Muted>
        </Motion>
        <View style={{ gap: 13 }}>
          {STEPS.map(([t, sub], i) => (
            <Motion key={i} kind="up" d={i + 2} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={s.num}>
                <Display size={17} color={T.acid}>
                  {i + 1}
                </Display>
              </View>
              <View style={{ flex: 1 }}>
                <Body size={14.5} weight={800}>
                  {t}
                </Body>
                <Muted size={12.5} style={{ marginTop: 2 }}>
                  {sub}
                </Muted>
              </View>
            </Motion>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ gap: 10 }}>
          <Btn label="Zaczynamy" glow onPress={() => router.push("/quick-add")} />
          <Btn label="Przeglądaj gotowe przedmioty" variant="text" onPress={() => router.push("/catalog")} />
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 22, paddingBottom: 26, gap: 22 },
  art: { position: "absolute", width: 120, height: 120, borderRadius: 30, borderWidth: 2 },
  artMain: { position: "absolute", top: 0, left: 56, width: 124, height: 124, borderRadius: 32, backgroundColor: T.acid, alignItems: "center", justifyContent: "center", shadowColor: T.acidDark, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 7 } },
  num: { width: 40, height: 40, borderRadius: 14, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, alignItems: "center", justifyContent: "center" },
});
