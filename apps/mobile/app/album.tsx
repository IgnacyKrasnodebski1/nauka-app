import { albumCount, albumTiles, todayStr, type AlbumRarity } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { HtmlText } from "@/components/HtmlText";
import { Icon } from "@/components/Icon";
import { Bar, Motion } from "@/components/Motion";
import { Body, Eyebrow, Muted } from "@/components/Text";
import { Chip, Screen, TopBar, Touch, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { noEmoji } from "@/lib/format";
import { T } from "@/lib/theme";

const RAR: Record<AlbumRarity, { bg: string; line: string; sw: string; txt: string; label: string }> = {
  common: { bg: T.surface, line: T.dash, sw: T.dash, txt: T.muted, label: "zwykła" },
  rare: { bg: "#0E2430", line: T.cyan, sw: T.cyan, txt: "#7EE8FA", label: "trudna" },
  epic: { bg: "#2A2110", line: T.gold, sw: T.gold, txt: "#FFD98A", label: "mistrzowska" },
};

/** Album pojęć (Album.html): fiszki z pudełkiem SRS ≥ 3, rzadkość (zwykła / trudna / mistrzowska), NOWA z dziś, filtr po przedmiocie. */
export default function Album() {
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);
  const today = todayStr();
  const topics = filter === "all" ? app.topics : app.topicsOf(filter);
  const tiles = useMemo(() => albumTiles(app.album, topics, today), [app.album, topics, today]);
  const tot = albumCount(app.album, app.topics);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"));
  const got = tiles.filter((t) => t.entry).length;
  return (
    <Screen scroll pad={false} bottom={40}>
      <View style={[s.wrap, { paddingTop: top }]}>
        <TopBar title="Album pojęć" sub={`${tot.n} z ${tot.m} zebrane`} onBack={back} />
        <Motion kind="up">
          <Bar pct={tot.m ? (tot.n / tot.m) * 100 : 0} color={T.acid} height={12} />
        </Motion>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          <Chip label="Wszystkie" active={filter === "all"} tone="acid" onPress={() => setFilter("all")} />
          {app.subjects.map((sub) => {
            const c = albumCount(app.album, app.topicsOf(sub.id));
            return (
              <AccentProvider key={sub.id} color={sub.accent2} seed={sub.name}>
                <Chip label={`${noEmoji(sub.name)}${c.n ? ` · ${c.n}` : ""}`} active={filter === sub.id} onPress={() => setFilter(sub.id)} />
              </AccentProvider>
            );
          })}
        </View>
        <View style={s.grid}>
          {tiles.map((t, i) => {
            const d = i < 9 ? Math.min(6, Math.floor(i / 3) + 1) : 0;
            if (!t.entry)
              return (
                <Motion key={t.key} kind={d ? "up" : "none"} d={d} style={s.cell}>
                  <View style={s.lock} accessibilityLabel="Nieodkryte pojęcie">
                    <Icon name="lock" size={20} stroke={2.4} color={T.muted2} />
                  </View>
                </Motion>
              );
            const r = RAR[t.entry.rarity];
            const flipped = open === t.key;
            return (
              <Motion key={t.key} kind={t.fresh ? "pulse" : d ? "up" : "none"} d={d} style={s.cell}>
                <Touch onPress={() => setOpen(flipped ? null : t.key)} accessibilityRole="button" accessibilityLabel={`${t.term} — ${r.label}, dotknij, żeby zobaczyć definicję`} style={[s.tile, { backgroundColor: r.bg, borderColor: r.line }]}>
                  {t.fresh ? (
                    <Motion kind="pop" d={3} style={s.newBadge}>
                      <Body size={9.5} weight={800} color={T.onPink} ls={1}>
                        NOWA
                      </Body>
                    </Motion>
                  ) : null}
                  {flipped ? (
                    <HtmlText html={t.def} inline textStyle={{ fontSize: 10.5, lineHeight: 14, color: r.txt }} />
                  ) : (
                    <>
                      <View style={[s.sw, { backgroundColor: r.sw }]} />
                      <Body size={12} weight={800} color={r.txt} lh={15}>
                        {t.term}
                      </Body>
                    </>
                  )}
                </Touch>
              </Motion>
            );
          })}
          {!tiles.length ? (
            <Muted size={13} center style={{ width: "100%", paddingVertical: 20 }}>
              Brak fiszek w tym przedmiocie.
            </Muted>
          ) : null}
        </View>
        <Motion kind="up" d={5} style={{ flexDirection: "row", gap: 14, justifyContent: "center" }}>
          {(["common", "rare", "epic"] as AlbumRarity[]).map((k) => (
            <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: RAR[k].sw }} />
              <Muted size={11.5} weight={700}>
                {k === "common" ? "zwykłe" : k === "rare" ? "trudne" : "mistrzowskie"}
              </Muted>
            </View>
          ))}
        </Motion>
        {!got ? (
          <Muted size={12.5} center lh={18}>
            Pojęcie trafia do albumu, gdy trzy razy z rzędu odpowiesz dobrze w powtórce (pudełko 3). Bez pomyłek = trudne, z poziomu na 3 gwiazdki = mistrzowskie.
          </Muted>
        ) : null}
        {!app.topics.length ? <Eyebrow center>Dodaj materiał, żeby zbierać pojęcia</Eyebrow> : null}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
  cell: { width: "30.5%", flexGrow: 1, maxWidth: "32%" },
  tile: { aspectRatio: 3 / 4, borderRadius: 16, borderWidth: 2, padding: 10, justifyContent: "space-between", shadowColor: "#0A0914", shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 } },
  lock: { aspectRatio: 3 / 4, borderRadius: 16, backgroundColor: T.surface2, borderWidth: 2, borderStyle: "dashed", borderColor: T.line, alignItems: "center", justifyContent: "center" },
  sw: { width: 26, height: 26, borderRadius: 9 },
  newBadge: { position: "absolute", top: -8, right: -6, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: T.pink, zIndex: 2 },
});
