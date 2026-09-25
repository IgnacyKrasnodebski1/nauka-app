import { useRouter } from "expo-router";
import React from "react";
import { Share, StyleSheet, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Display, Eyebrow } from "@/components/Text";
import { Blob, Btn, Card, ListCard, Note, Press, Row, Screen, TopBar, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { firstName } from "@/lib/format";
import { T, body } from "@/lib/theme";

/** Kod znajomego z id konta (stały dla usera, do wpisania w wersji online). */
function codeOf(uid: string | null, name: string): string {
  const h = (uid ?? "anon").replace(/-/g, "").slice(0, 8);
  let n = 0;
  for (let i = 0; i < h.length; i++) n = (n * 31 + h.charCodeAt(i)) >>> 0;
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += A[(n >>> (i * 5)) % A.length];
  return `${name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "REC"}-${out}`;
}

/** Znajomi (Friends.html) — wkrótce: twój kod i szukajka są gotowe, zaproszenia i wspólny tydzień wymagają wersji online. */
export default function Friends() {
  const app = useApp();
  const auth = useAuth();
  const router = useRouter();
  const top = useTop();
  const name = firstName(app.displayName, auth.user?.email);
  const code = codeOf(app.userId, name);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"));
  return (
    <Screen scroll pad={false} bottom={40} blob={<Blob tone="cyan2" size={250} top={-100} right={-80} />}>
      <View style={[s.wrap, { paddingTop: top }]}>
        <TopBar title="Znajomi" sub="wkrótce · uczycie się razem" onBack={back} />
        <Motion kind="up">
          <View style={s.search}>
            <Icon name="search" size={19} color={T.muted} />
            <TextInput placeholder="Szukaj po nazwie albo kodzie" placeholderTextColor={T.muted2} editable={false} style={s.input} accessibilityLabel="Szukaj znajomego" />
          </View>
        </Motion>
        <Motion kind="up" d={1}>
          <Card tone="cyan" padding={15} radius={22} drop={4}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
              <View style={{ flex: 1 }}>
                <Eyebrow color="#7FAEBC">Twój kod</Eyebrow>
                <Display size={25} color="#7EE8FA" ls={2} style={{ marginTop: 4 }}>
                  {code}
                </Display>
              </View>
              <Press onPress={() => Share.share({ message: `Ucz się ze mną w Recall — mój kod: ${code}` }).catch(() => {})} drop={4} edge={T.cyanDark} radius={15} faceStyle={s.shareBtn} accessibilityLabel="Udostępnij kod">
                <Icon name="upload" size={16} color={T.onCyan} />
                <Body size={13} weight={800} color={T.onCyan}>
                  Udostępnij
                </Body>
              </Press>
            </View>
          </Card>
        </Motion>
        <Motion kind="up" d={2}>
          <Note tone="violet" icon="users" text="Zaproszenia, wspólny tydzień i porównanie serii pojawią się w następnej wersji. Kod już działa — zapisz go albo wyślij znajomym, żeby byli gotowi." />
        </Motion>
        <Eyebrow>Co tu będzie</Eyebrow>
        <Motion kind="up" d={3}>
          <ListCard>
            <Row icon="mail" title="Zaproszenia" sub="kto chce się uczyć razem z tobą" />
            <Row icon="flame" title="Ten tydzień" sub="kto ile XP, czyja seria dłuższa" />
            <Row icon="book" title="Wspólne przedmioty" sub="kto uczy się tego samego" />
          </ListCard>
        </Motion>
        <Btn label="Wracam do nauki" variant="ghost" onPress={back} style={{ marginTop: 6 }} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 13 },
  search: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, opacity: 0.7 },
  input: { flex: 1, color: T.txt, fontFamily: body(700), fontSize: 13.5, padding: 0 },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: T.cyan, paddingVertical: 12, paddingHorizontal: 15 },
});
