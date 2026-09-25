import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Display, Muted } from "@/components/Text";
import { Press, RoundBtn, Sheet, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { T, TONES, type Tone } from "@/lib/theme";

/**
 * Arkusz „Dodaj materiał” (QuickAdd.html): zdjęcie strony (skaner) → plik → tekst; „Mam sprawdzian” → plan; katalog.
 * Otwierany z plusa w nawigacji na każdym ekranie (design/DESIGN.md §0).
 */
export default function QuickAdd() {
  const router = useRouter();
  const app = useApp();
  const go = (path: Parameters<typeof router.replace>[0]) => router.replace(path);
  const tile = (icon: IconName, tone: Tone, t: string, sub: string, d: number, onPress: () => void) => (
    <Motion kind="up" d={d} style={{ width: "48%", flexGrow: 1 }}>
      <Press onPress={onPress} drop={4} edge="#0A0914" radius={22} faceStyle={[s.tile, { backgroundColor: TONES[tone].tint, borderColor: TONES[tone].tintLine }]} accessibilityLabel={t}>
        <Icon name={icon} size={24} stroke={2.6} color={TONES[tone].color} />
        <View>
          <Body size={14} weight={800}>
            {t}
          </Body>
          <Muted size={11.5} lh={15} style={{ marginTop: 3 }}>
            {sub}
          </Muted>
        </View>
      </Press>
    </Motion>
  );
  return (
    <Sheet open onClose={() => router.back()} bg={T.surface2} tone="acid" top={118}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Display size={25} ls={-0.8}>
          Dodaj materiał
        </Display>
        <RoundBtn icon="close" onPress={() => router.back()} label="Zamknij" />
      </View>
      <Motion kind="pop">
        <Press onPress={() => go({ pathname: "/add", params: { mode: "photo" } })} drop={6} edge={T.acidDark} radius={26} faceStyle={s.big} accessibilityLabel="Zrób zdjęcie">
          <Motion kind="bob">
            <View style={s.bigIco}>
              <Icon name="camera" size={32} stroke={2.4} color={T.acid} />
            </View>
          </Motion>
          <View style={{ flex: 1 }}>
            <Display size={22} color={T.onAcid} ls={-0.5}>
              Zrób zdjęcie
            </Display>
            <Body size={13} weight={700} color="#2C4A14" style={{ marginTop: 3 }}>
              strona z podręcznika, zeszyt, tablica
            </Body>
          </View>
        </Press>
      </Motion>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 11 }}>
        {tile("upload", "pink", "Wgraj plik", "PDF, tekst, notatki", 1, () => go({ pathname: "/add", params: { mode: "file" } }))}
        {tile("list", "cyan", "Wklej tekst", "notatki, konspekt, zagadnienia", 2, () => go({ pathname: "/add", params: { mode: "text" } }))}
        {tile("edit", "amber", "Z samego hasła", "temat wg podstawy programowej", 3, () => go({ pathname: "/add", params: { mode: "prompt" } }))}
        {tile("grid", "acid", "Gotowy przedmiot", "z katalogu, wg etapu", 4, () => go("/catalog"))}
      </View>
      <Motion kind="up" d={5}>
        <Touch onPress={() => (app.subjects.length ? go("/test-new") : go("/catalog"))} accessibilityRole="button" style={s.test}>
          <Icon name="calendar" size={20} stroke={2.4} color={TONES.red.txt} />
          <Body size={14} weight={800} color={TONES.red.txt} style={{ flex: 1 }}>
            Mam sprawdzian — ułóż mi plan
          </Body>
          <Icon name="chevron-right" size={18} color={TONES.red.txt} />
        </Touch>
      </Motion>
      <Motion kind="up" d={6}>
        <Touch onPress={() => go("/catalog")} accessibilityRole="button" style={{ padding: 6, alignItems: "center" }}>
          <Body size={13} weight={800} color={T.muted}>
            albo weź gotowy przedmiot z katalogu
          </Body>
        </Touch>
      </Motion>
    </Sheet>
  );
}

const s = StyleSheet.create({
  big: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: T.acid, padding: 20 },
  bigIco: { width: 62, height: 62, borderRadius: 20, backgroundColor: T.onAcid, alignItems: "center", justifyContent: "center" },
  tile: { padding: 14, gap: 10, borderWidth: 2, minHeight: 112 },
  test: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: TONES.red.tint, borderWidth: 2, borderColor: TONES.red.tintLine, borderRadius: 18, paddingVertical: 13, paddingHorizontal: 15 },
});
