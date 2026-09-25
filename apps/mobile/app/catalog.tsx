import { CURRICULUM, STAGES, type Stage } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Display, Eyebrow, Muted } from "@/components/Text";
import { Btn, Chip, IconTile, Mono, Press, RoundBtn, Screen, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { noEmoji, npl } from "@/lib/format";
import { T, TONES, accentOf, body } from "@/lib/theme";

const CHIP: Record<Stage, string> = { podstawowa: "Podstawówka", liceum: "Liceum", studia: "Studia", inne: "Inne" };
const HINT: Record<string, string> = { matematyka: "funkcje, ciągi, pochodne", biologia: "komórka, genetyka, ekologia", chemia: "reakcje, stechiometria", historia: "od starożytności do XX w.", polski: "epoki, lektury, środki stylistyczne", fizyka: "mechanika, elektryczność, fale", geografia: "mapa, klimat, gospodarka", angielski: "słówka, czasy, phrasal verbs", wos: "ustrój, prawo, Unia", informatyka: "algorytmy, sieci, Python" };
const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Katalog (Catalog.html): gotowe przedmioty z `CURRICULUM` wg etapu, szukajka, CTA „Masz notatki?”. Wybrane trafiają do
 * `subjects` (kolor z `paletteFor`), potem temat generuje AI z samego hasła (QuickAdd → „Z samego hasła”).
 */
export default function Catalog() {
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<Stage>(app.stage ?? "liceum");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const mine = useMemo(() => new Set(app.subjects.map((s) => fold(s.name))), [app.subjects]);
  const list = useMemo(() => {
    const words = fold(q).split(/\s+/).filter(Boolean);
    return CURRICULUM[level].filter((c) => !words.length || words.every((w) => fold(c.name + " " + (HINT[c.key] ?? "")).includes(w)));
  }, [q, level]);
  const toggle = (key: string) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    return n;
  });
  const add = async () => {
    const items = CURRICULUM[level].filter((c) => picked.has(c.key));
    if (!items.length) return;
    setBusy(true);
    try {
      if (!app.stage) app.setStage(level);
      const created = await app.createSubjects(items.map((c) => ({ name: c.name, emoji: c.emoji, category: c.key, stage: level })));
      app.showToast(`${npl(created.length, "przedmiot dodany", "przedmioty dodane", "przedmiotów dodanych")}`, "check");
      if (created.length === 1) router.replace({ pathname: "/s/[subjectId]", params: { subjectId: created[0]!.id } });
      else router.replace("/(tabs)");
    } catch (e) {
      app.showToast(e instanceof Error ? e.message : "Nie udało się dodać", "alert");
    } finally {
      setBusy(false);
    }
  };
  const stageLabel = STAGES.find((s) => s.id === level)?.label ?? "";
  return (
    <Screen scroll pad={false} bottom={110}>
      <View style={[s.wrap, { paddingTop: top }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Display size={26} ls={-0.9}>
            Odkrywaj
          </Display>
          <RoundBtn icon="close" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} label="Zamknij" />
        </View>
        <Motion kind="up">
          <View style={s.search}>
            <Icon name="search" size={19} color={T.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Przedmiot, dział albo temat" placeholderTextColor={T.muted2} style={s.input} accessibilityLabel="Szukaj przedmiotu" autoCorrect={false} />
          </View>
        </Motion>
        <View style={{ flexDirection: "row", gap: 7, flexWrap: "wrap" }}>
          {STAGES.map((st) => (
            <Chip key={st.id} label={CHIP[st.id]} active={level === st.id} tone="acid" onPress={() => setLevel(st.id)} />
          ))}
        </View>
        <Motion kind="glow">
          <Press onPress={() => router.replace("/quick-add")} drop={4} edge={T.acidDark} radius={22} faceStyle={s.cta} accessibilityLabel="Masz notatki od nauczyciela? Zrób z nich przedmiot">
            <IconTile icon="upload" size={44} tone="acid" kind="bob" />
            <View style={{ flex: 1 }}>
              <Body size={14.5} weight={800} color={TONES.acid.txt}>
                Masz notatki od nauczyciela?
              </Body>
              <Muted size={12} color={TONES.acid.sub} style={{ marginTop: 2 }}>
                Zrób z nich przedmiot w 3 minuty
              </Muted>
            </View>
          </Press>
        </Motion>
        <Eyebrow>
          {stageLabel} · {list.length}
        </Eyebrow>
        {!list.length ? (
          <View style={{ alignItems: "center", gap: 8, padding: 24 }}>
            <Icon name="search" size={26} stroke={2.2} color={T.muted} />
            <Body size={15} weight={800}>
              Nic nie znaleziono
            </Body>
            <Muted center>Spróbuj krócej albo innym słowem.</Muted>
          </View>
        ) : null}
        <View style={s.grid}>
          {list.map((c, i) => {
            const have = mine.has(fold(c.name));
            const on = picked.has(c.key);
            const acc = accentOf(undefined, c.name);
            return (
              <AccentProvider key={c.key} color={acc.color}>
                <Motion kind="up" d={Math.min(6, i + 1)} style={s.cell}>
                  <Press onPress={have ? undefined : () => toggle(c.key)} drop={4} edge={on ? T.acidDark : T.shadow} radius={22} faceStyle={[s.card, on && { backgroundColor: TONES.acid.tint, borderColor: T.acid }, have && { opacity: 0.55 }]} accessibilityLabel={`${c.name}${have ? ", już masz" : on ? ", wybrany" : ""}`}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Mono text={c.name} size={44} />
                      {on ? (
                        <View style={s.ck}>
                          <Icon name="check" size={14} stroke={4} color={T.onAcid} />
                        </View>
                      ) : null}
                    </View>
                    <View>
                      <Body size={14} weight={800} lh={18}>
                        {noEmoji(c.name)}
                      </Body>
                      <Muted size={11.5} style={{ marginTop: 3 }} numberOfLines={2}>
                        {have ? "już w twoich przedmiotach" : (HINT[c.key] ?? "poziomy, fiszki, pytania")}
                      </Muted>
                    </View>
                  </Press>
                </Motion>
              </AccentProvider>
            );
          })}
        </View>
      </View>
      {picked.size ? (
        <View style={s.foot}>
          <Btn label={busy ? "Dodaję…" : `Dodaj ${npl(picked.size, "przedmiot", "przedmioty", "przedmiotów")}`} onPress={add} disabled={busy} glow />
        </View>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 13 },
  search: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14 },
  input: { flex: 1, color: T.txt, fontFamily: body(700), fontSize: 13.5, padding: 0 },
  cta: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: TONES.acid.tint, borderWidth: 2, borderColor: T.acid, paddingVertical: 14, paddingHorizontal: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
  cell: { width: "47%", flexGrow: 1 },
  card: { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, padding: 14, gap: 10, minHeight: 130 },
  ck: { width: 24, height: 24, borderRadius: 12, backgroundColor: T.acid, alignItems: "center", justifyContent: "center" },
  foot: { position: "absolute", left: 18, right: 18, bottom: 26 },
});
