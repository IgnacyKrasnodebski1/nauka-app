import { allFlashcards } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Display, Eyebrow, Muted } from "@/components/Text";
import { Blob, Card, ListCard, Mono, Press, Row, Screen, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { noEmoji, npl } from "@/lib/format";
import { T } from "@/lib/theme";
import { dueEntries } from "@/lib/srs-view";

/** Zakładka „Fiszki” (legacy `renderCardsHub`): przedmioty z liczbą fiszek i pojęć do powtórki → fiszki przedmiotu. */
export default function CardsHub() {
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const { due } = useMemo(() => dueEntries(app), [app]);
  const totalC = app.topics.reduce((a, t) => a + allFlashcards(t).length, 0);
  return (
    <Screen scroll pad={false} blob={<Blob tone="violet" size={280} top={-120} right={-90} />} bottom={40}>
      <View style={[s.wrap, { paddingTop: top }]}>
        <Display size={18} ls={-0.4}>
          Fiszki
        </Display>
        <View>
          <Eyebrow size={12}>
            {npl(totalC, "pojęcie", "pojęcia", "pojęć")} · {npl(app.subjects.length, "przedmiot", "przedmioty", "przedmiotów")}
          </Eyebrow>
          <Muted size={13} lh={19} style={{ marginTop: 6 }}>
            Wybierz przedmiot i przeglądaj fiszki. Każda odpowiedź trafia do powtórki na interwałach.
          </Muted>
        </View>
        {due.length ? (
          <Motion kind="up" d={1}>
            <Card tone="cyan" onPress={() => router.push("/review-run")} padding={14} radius={20} accessibilityLabel="Powtórka na dziś">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
                <View style={s.ico}>
                  <Icon name="refresh" size={22} stroke={2.6} color={T.onCyan} />
                </View>
                <View style={{ flex: 1 }}>
                  <Body size={14} weight={800}>
                    Powtórka na dziś
                  </Body>
                  <Muted style={{ marginTop: 2 }}>{npl(due.length, "pojęcie czeka", "pojęcia czekają", "pojęć czeka")}</Muted>
                </View>
                <Body size={16} weight={800} color={T.cyan}>
                  {due.length}
                </Body>
              </View>
            </Card>
          </Motion>
        ) : null}
        <Motion kind="up" d={2}>
          <ListCard>
            {app.subjects.map((sub) => {
              const topics = app.topicsOf(sub.id);
              const nc = topics.reduce((a, t) => a + allFlashcards(t).length, 0);
              const tids = new Set(topics.map((t) => t.id));
              const nd = due.filter((d) => tids.has(d.topicId)).length;
              return (
                <AccentProvider key={sub.id} color={sub.accent2} seed={sub.name}>
                  <Row left={<Mono text={sub.name} size={32} />} title={noEmoji(sub.name)} sub={`${npl(nc, "fiszka", "fiszki", "fiszek")}${nd ? ` · ${nd} do powtórki` : ""}`} onPress={() => router.push({ pathname: "/s/[subjectId]/cards", params: { subjectId: sub.id } })} />
                </AccentProvider>
              );
            })}
            {!app.subjects.length ? <Row title="Jeszcze nic — dodaj pierwszy materiał." titleColor={T.muted} /> : null}
          </ListCard>
        </Motion>
        {!totalC && app.subjects.length ? (
          <Motion kind="up" d={3}>
            <Press onPress={() => router.push("/quick-add")} drop={4} edge={T.shadow} radius={20} faceStyle={s.add} accessibilityLabel="Dodaj materiał">
              <Icon name="plus" size={20} stroke={3} color={T.acid} />
              <Body size={14} weight={800} color={T.acid}>
                Dodaj materiał — powstaną fiszki
              </Body>
            </Press>
          </Motion>
        ) : null}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 16 },
  ico: { width: 44, height: 44, borderRadius: 15, backgroundColor: T.cyan, alignItems: "center", justifyContent: "center" },
  add: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, paddingVertical: 14 },
});
