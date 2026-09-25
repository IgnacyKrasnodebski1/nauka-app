import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Share, StyleSheet, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Display, Eyebrow, Muted } from "@/components/Text";
import { Blob, Btn, Card, ListCard, Note, Row, Screen, Toggle, TopBar, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { noEmoji } from "@/lib/format";
import { T } from "@/lib/theme";

function classCode(seed: string): string {
  let n = 2166136261;
  for (let i = 0; i < seed.length; i++) n = Math.imul(n ^ seed.charCodeAt(i), 16777619) >>> 0;
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += A[(n >>> (i * 5)) % A.length];
  return out;
}

/** Udostępnij klasie (ShareClass.html) — wkrótce: kod dla klasy, co się udostępnia, zgoda na poprawki. Wymaga wersji online. */
export default function ShareClass() {
  const { subjectId } = useLocalSearchParams<{ subjectId?: string }>();
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const subject = app.findSubject(subjectId ?? "") ?? app.subjects[0];
  const name = subject ? noEmoji(subject.name) : "Recall";
  const code = `${name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "REC"}-${classCode(subject?.id ?? "recall")}`;
  const [fixes, setFixes] = React.useState(true);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  return (
    <Screen scroll pad={false} bottom={40} blob={<Blob tone="cyan2" size={270} top={-100} left={-90} />}>
      <View style={[s.wrap, { paddingTop: top }]}>
        <TopBar title="Udostępnij klasie" sub={subject ? `${name} · wkrótce` : "wkrótce"} onBack={back} />
        <Motion kind="up">
          <Card tone="cyan" padding={20} radius={26} drop={5}>
            <View style={{ alignItems: "center" }}>
              <Eyebrow color="#7FAEBC">Kod dla klasy</Eyebrow>
              <Motion kind="pop" d={1}>
                <Display size={40} color="#7EE8FA" ls={4} style={{ marginTop: 6 }}>
                  {code}
                </Display>
              </Motion>
              <Muted size={12.5} color="#7FAEBC" center style={{ marginTop: 6 }}>
                Ktoś wpisuje kod — ma całą lekcję u siebie.
              </Muted>
            </View>
          </Card>
        </Motion>
        <Motion kind="up" d={2}>
          <Note tone="violet" icon="wifi" text="Udostępnianie klasie pojawi się w następnej wersji. Kod jest już przypisany do przedmiotu — możesz go wysłać, zadziała, gdy funkcja ruszy." />
        </Motion>
        <Motion kind="up" d={3}>
          <ListCard>
            <Row icon="check" iconColor={T.acid} title="Poziomy, pytania i fiszki" />
            <Row icon="lock" title="Twoje zdjęcia stron — zostają u ciebie" titleColor={T.txt2} />
            <Row title="Inni mogą zgłaszać poprawki" sub="ty zatwierdzasz" right={<Toggle value={fixes} onChange={setFixes} label="Poprawki od innych" />} />
          </ListCard>
        </Motion>
        <View style={{ gap: 10, marginTop: 6 }}>
          <Btn label="Wyślij kod" tone="cyan" glow onPress={() => Share.share({ message: `Kod do „${name}” w Recall: ${code}` }).catch(() => {})} left={<Icon name="upload" size={18} color={T.onCyan} />} />
          <Btn label="Wracam" variant="text" onPress={back} />
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 13 },
});
