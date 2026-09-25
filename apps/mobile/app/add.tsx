import { CURRICULUM, PLANS, STAGES, SUBJECT_HUES, type GenerationOptions, type Stage, type Subject, type Topic } from "@nauka/shared";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Display, Eyebrow, Muted, Num } from "@/components/Text";
import { Blob, Btn, Card, Chip, IconTile, Input, ListCard, Mono, Note, Press, Ring, Screen, Toggle, TopBar, Touch, useTop } from "@/components/ui";
import { ApiError, generate } from "@/lib/api";
import { haptic, useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { hasApi } from "@/lib/env";
import { noEmoji, npl } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { T, TONES, accentOf, body } from "@/lib/theme";
import { isHidden, topicShort } from "@/lib/topic-view";
import { guessMime, uploadMaterial, type PickedFile } from "@/lib/upload";

type Mode = "photo" | "file" | "text" | "prompt";
type Step = "source" | "scan" | "detect" | "gen" | "ready" | "error";
const STEPS: [string, string][] = [
  ["Odczytuję pliki", "files"],
  ["Wyciągam pojęcia", "terms"],
  ["Układam poziomy", "levels"],
  ["Piszę pytania i zadania", "questions"],
  ["Dobieram mnemotechniki", "mnemo"],
];
const STAGE_LABEL: Record<Stage, string> = { podstawowa: "Podstawówka", liceum: "Liceum", studia: "Studia", inne: "Inne" };
const isLangSubject = (s: Subject) => s.category === "angielski" || s.category === "inny-jezyk" || s.category === "jezyk";
const fmtSize = (b?: number) => (b == null ? "" : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Dodawanie materiału (AddSubject → Scanner → Detected → Generating → SubjectReady / ErrorState): zdjęcia (pętla aparatu,
 * wiele stron), pliki (PDF/txt), wklejony tekst albo samo hasło → upload do Storage → POST /api/generate → nowy temat
 * w istniejącym lub nowym przedmiocie. Ostatni krok: nazwa i kolor przedmiotu, wyłączanie poziomów (overrides `hide:`).
 */
export default function AddScreen() {
  const { mode: modeParam, subjectId } = useLocalSearchParams<{ mode?: Mode; subjectId?: string }>();
  const app = useApp();
  const auth = useAuth();
  const router = useRouter();
  const top = useTop();
  const mode: Mode = modeParam === "photo" || modeParam === "file" || modeParam === "text" || modeParam === "prompt" ? modeParam : "file";
  const [step, setStep] = useState<Step>(mode === "photo" ? "scan" : "source");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");
  const [levels, setLevels] = useState(4);
  const [target, setTarget] = useState<string>(subjectId && app.findSubject(subjectId) ? subjectId : app.subjects[0]?.id ?? "new");
  const [lang, setLang] = useState(() => { const s0 = app.findSubject(target); return !!s0 && isLangSubject(s0); });
  const [newName, setNewName] = useState("");
  const [stage, setStage] = useState<Stage>(() => app.findSubject(target)?.stage ?? app.stage ?? "liceum");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [phase, setPhase] = useState(0);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ name: string; why: string }[]>([]);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const plan = app.plan;
  const maxFiles = PLANS[plan].filesPerGeneration;
  const cur = target !== "new" ? app.findSubject(target) : null;
  const pick = (id: string) => {
    setTarget(id);
    const sub = id !== "new" ? app.findSubject(id) : null;
    if (sub) {
      setStage(sub.stage);
      setLang(isLangSubject(sub));
    }
  };
  useEffect(() => {
    if (step !== "gen") return;
    timer.current = setInterval(() => {
      setPct((p) => (p < 92 ? p + Math.max(0.5, (92 - p) / 40) : p));
      setPhase((ph) => (ph < STEPS.length - 1 && Math.random() < 0.08 ? ph + 1 : ph));
    }, 400);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [step]);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  const addFiles = (list: PickedFile[]) =>
    setFiles((c) => {
      if (c.length + list.length > maxFiles) app.showToast(`Max ${maxFiles} plików na raz (plan ${PLANS[plan].label})`, "alert");
      return [...c, ...list].slice(0, maxFiles);
    });
  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return app.showToast("Bez aparatu nie zrobię zdjęcia", "camera");
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (r.canceled) return;
    addFiles(r.assets.map((a, i) => ({ uri: a.uri, name: a.fileName ?? `strona-${files.length + i + 1}.jpg`, mime: a.mimeType ?? "image/jpeg", size: a.fileSize, kind: "image" as const })));
    haptic.tap();
  };
  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return app.showToast("Bez dostępu do galerii nie dam rady", "alert");
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: Math.max(1, maxFiles - files.length), quality: 0.8 });
    if (r.canceled) return;
    addFiles(r.assets.map((a, i) => ({ uri: a.uri, name: a.fileName ?? `obraz-${Date.now()}-${i}.jpg`, mime: a.mimeType ?? guessMime(a.fileName ?? "", "image/jpeg"), size: a.fileSize, kind: "image" as const })));
  };
  const pickDocs = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "text/plain", "text/markdown", "image/*"], multiple: true, copyToCacheDirectory: true });
    if (r.canceled) return;
    addFiles(
      r.assets.map((a) => {
        const mime = a.mimeType ?? guessMime(a.name);
        return { uri: a.uri, name: a.name, mime, size: a.size, kind: mime.startsWith("image/") ? ("image" as const) : mime === "application/pdf" ? ("pdf" as const) : ("text" as const) };
      }),
    );
  };
  const canNext = mode === "prompt" ? hint.trim().length >= 3 : mode === "text" ? text.trim().length > 20 : files.length > 0 || text.trim().length > 20;

  const submit = async () => {
    if (!auth.user || !supabase) return;
    const token = await auth.accessToken();
    if (!token) return app.showToast("Sesja wygasła — zaloguj się ponownie.", "alert");
    if (!hasApi) {
      setError("Brak EXPO_PUBLIC_API_URL — nie wiem, gdzie jest API.");
      return setStep("error");
    }
    setError(null);
    setFailed([]);
    setPct(0);
    setPhase(0);
    setStep("gen");
    try {
      let subj = cur;
      if (!subj) {
        const nm = newName.trim() || hint.trim() || "Nowy przedmiot";
        const cat = CURRICULUM[stage].find((c) => c.name.toLowerCase() === nm.toLowerCase())?.key ?? "inny";
        if (!app.stage) app.setStage(stage);
        const created = await app.createSubjects([{ name: nm, emoji: "📘", category: cat, stage }]);
        subj = created[0] ?? null;
        if (!subj) throw new Error("Nie udało się założyć przedmiotu.");
      }
      setSubject(subj);
      const materialIds: string[] = [];
      const bad: { name: string; why: string }[] = [];
      if (mode !== "prompt" && files.length) {
        setProgress({ done: 0, total: files.length });
        for (const f of files) {
          try {
            const m = await uploadMaterial(supabase, auth.user.id, f, plan);
            materialIds.push(m.id);
          } catch (e) {
            bad.push({ name: f.name, why: e instanceof Error ? e.message : "nie udało się wysłać" });
          }
          setProgress((p) => ({ ...p, done: p.done + 1 }));
        }
        if (bad.length && !materialIds.length && !text.trim()) {
          setFailed(bad);
          setError("Żaden plik nie przeszedł.");
          return setStep("error");
        }
        setFailed(bad);
      }
      setPhase(1);
      const options: GenerationOptions = { stage: subj.stage, subjectName: subj.name, mode: mode === "prompt" ? "prompt" : "materials", levels, lang, locale: "pl" };
      if (hint.trim()) options.hint = hint.trim();
      const r = await generate(token, { subjectId: subj.id, materialIds: mode !== "prompt" && materialIds.length ? materialIds : undefined, text: mode !== "prompt" && text.trim() ? text.trim() : undefined, options });
      const t = r.topic ?? (await app.getTopic(r.topicId));
      if (!t) throw new Error("Temat powstał, ale nie udało się go wczytać.");
      app.registerTopic(t);
      setTopic(t);
      setName(subj.name);
      setPct(100);
      setPhase(STEPS.length - 1);
      setStep("ready");
      haptic.ok();
      void app.refresh();
    } catch (e) {
      haptic.bad();
      let msg = e instanceof Error ? e.message : "Coś się wysypało.";
      if (e instanceof ApiError && e.code === "limit_reached") msg = `Limit tematów na ten miesiąc wyczerpany (${String(e.extra?.used ?? "?")}/${String(e.extra?.limit ?? "?")}). Pro daje ${PLANS.pro.generationsPerMonth}/mies.`;
      if (e instanceof ApiError && e.status === 401) msg = "Sesja wygasła — zaloguj się ponownie.";
      if (e instanceof ApiError && e.code === "network") msg = "Brak połączenia z API. Sprawdź sieć i spróbuj jeszcze raz.";
      setError(msg);
      setStep("error");
    }
  };

  const stepDots = (n: number) => (
    <View style={{ flexDirection: "row", gap: 5 }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ width: 22, height: 6, borderRadius: 3, backgroundColor: i <= n ? T.acid : T.line2 }} />
      ))}
    </View>
  );

  /* ---------- Scanner ---------- */
  if (step === "scan") {
    const last = files[files.length - 1];
    return (
      <Screen pad={false} style={{ backgroundColor: "#1A1916" }}>
        <View style={s.camTop} />
        <View style={[s.head, { paddingTop: top, zIndex: 2, flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <Touch onPress={close} accessibilityRole="button" accessibilityLabel="Zamknij aparat" style={s.camBtn}>
            <Icon name="close" size={18} stroke={3} color="#FFF" />
          </Touch>
          <Body size={14} weight={800} color="#FFF" center style={{ flex: 1 }}>
            {files.length ? `Strona ${files.length}` : "Zdjęcie strony"}
          </Body>
          <Touch onPress={pickImages} accessibilityRole="button" accessibilityLabel="Z galerii" style={s.camBtn}>
            <Icon name="grid" size={19} color="#FFF" />
          </Touch>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <View>
            {last ? <Image source={{ uri: last.uri }} style={s.page} resizeMode="cover" /> : <View style={[s.page, { alignItems: "center", justifyContent: "center", gap: 8 }]}><Icon name="camera" size={44} stroke={1.8} color="#9E968A" /><Muted size={12} weight={700} color="#9E968A">strona z podręcznika, zeszyt, tablica</Muted></View>}
            {[
              { top: -10, left: -14, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 10 },
              { top: -18, right: -6, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 10 },
              { bottom: -18, left: -6, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 10 },
              { bottom: -10, right: -14, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 10 },
            ].map((st, i) => (
              <Motion key={i} kind="pulse" pointerEvents="none" style={[s.corner, st]} />
            ))}
          </View>
          <Motion kind="blink" style={s.camHint}>
            <Body size={13} weight={800} color="#FFF">
              {files.length ? "Dorzuć kolejną stronę albo zakończ" : "Zrób zdjęcie — jedna strona na raz"}
            </Body>
          </Motion>
        </View>
        <View style={s.camFoot}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, minHeight: 64 }}>
            {files.map((f, i) => (
              <Motion key={f.uri + i} kind="pop" d={Math.min(6, i)}>
                <Touch onPress={() => setFiles(files.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Usuń stronę ${i + 1}`}>
                  <Image source={{ uri: f.uri }} style={s.thumb} />
                  <View style={s.thumbOk}>
                    <Icon name="check" size={12} stroke={4} color={T.onAcid} />
                  </View>
                </Touch>
              </Motion>
            ))}
            {!files.length ? <Muted size={12}>Strony pojawią się tutaj.</Muted> : null}
          </ScrollView>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Btn label={files.length ? "Gotowe" : "Pomiń"} variant="ghost" onPress={() => setStep(files.length ? "detect" : "source")} style={{ flex: 1 }} />
            <Press onPress={takePhoto} drop={6} edge={T.acidDark} radius={40} faceStyle={s.shutter} accessibilityLabel="Zrób zdjęcie">
              <Icon name="camera" size={30} stroke={2.4} color={T.onAcid} />
            </Press>
            <View style={{ flex: 1 }} />
          </View>
        </View>
      </Screen>
    );
  }

  /* ---------- Generating ---------- */
  if (step === "gen") {
    return (
      <Screen pad={false} blob={<Blob tone="acid" size={320} top={90} center />}>
        <View style={[s.head, { paddingTop: top }]}>
          <TopBar title="Nowy temat" right={stepDots(2)} />
        </View>
        <View style={{ alignItems: "center", gap: 12, paddingHorizontal: 18, paddingTop: 14 }}>
          <Motion kind="pop">
            <Ring pct={pct} size={122} stroke={12} color={T.acid}>
              <Num size={33} color={T.acid}>
                {Math.round(pct)}%
              </Num>
              <Eyebrow size={11} style={{ marginTop: 4 }}>
                gotowe
              </Eyebrow>
            </Ring>
          </Motion>
          <View style={{ alignItems: "center" }}>
            <Display size={25} ls={-0.8} center>
              Buduję temat
            </Display>
            <Muted size={13.5} center style={{ marginTop: 6 }}>
              {progress.total && progress.done < progress.total ? `Wysyłam pliki ${progress.done}/${progress.total}` : "Zwykle zajmuje to 1–3 minuty. Nie zamykaj apki."}
            </Muted>
          </View>
        </View>
        <View style={{ marginHorizontal: 18, marginTop: 22 }}>
          <ListCard padding={14}>
            {STEPS.map(([label], i) => {
              const done = i < phase;
              const now = i === phase;
              return (
                <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 }}>
                  {done ? (
                    <View style={[s.stepIco, { backgroundColor: T.acid }]}>
                      <Icon name="check" size={15} stroke={4} color={T.onAcid} />
                    </View>
                  ) : now ? (
                    <Motion kind="blink">
                      <View style={[s.stepIco, { borderWidth: 3, borderColor: T.acid }]} />
                    </Motion>
                  ) : (
                    <View style={s.stepIco} />
                  )}
                  <Body size={13.5} weight={now ? 800 : 700} color={now ? T.txt : done ? "#7A74AA" : T.muted} style={{ flex: 1 }}>
                    {i === 0 && files.length ? `${done ? "Odczytałem" : "Odczytuję"} ${npl(files.length, "plik", "pliki", "plików")}` : label}
                  </Body>
                  {i === 2 && now ? (
                    <Body size={12} weight={800} color={T.acid}>
                      {levels} {npl(levels, "poziom", "poziomy", "poziomów").replace(/^\d+ /, "")}
                    </Body>
                  ) : null}
                </View>
              );
            })}
          </ListCard>
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginHorizontal: 18, marginTop: 14 }}>
          {(
            [
              [String(levels), "poziomów", 1],
              [String(levels * 8), "fiszek ~", 2],
              [String(levels * 6), "pytań ~", 3],
            ] as [string, string, number][]
          ).map(([v, k, d]) => (
            <Motion key={k} kind="pop" d={d} style={s.genStat}>
              <Num size={22}>{v}</Num>
              <Muted size={11} weight={700} style={{ marginTop: 2 }}>
                {k}
              </Muted>
            </Motion>
          ))}
        </View>
      </Screen>
    );
  }

  /* ---------- SubjectReady ---------- */
  if (step === "ready" && topic && subject) {
    const hues = SUBJECT_HUES;
    const cursub = app.findSubject(subject.id) ?? subject;
    const acc2 = accentOf(cursub.accent2, cursub.name);
    const saveName = async () => {
      const nm = name.trim();
      if (!nm || nm === cursub.name) return;
      setBusy(true);
      try {
        await app.updateSubject(subject.id, { name: nm });
      } finally {
        setBusy(false);
      }
    };
    return (
      <AccentProvider color={cursub.accent2} seed={cursub.name}>
        <Screen pad={false} blob={<Blob tone="violet" size={260} top={-100} right={-80} />}>
          <View style={[s.head, { paddingTop: top }]}>
            <TopBar title="Sprawdź i nazwij" onBack={close} right={stepDots(3)} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Card padding={16} radius={24} drop={5}>
              <View style={{ gap: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <Mono text={name || cursub.name} size={58} radius={19} color={acc2.color} on={acc2.on} />
                  <View style={{ flex: 1 }}>
                    <Eyebrow size={10.5}>Nazwa przedmiotu</Eyebrow>
                    <TextInput value={name} onChangeText={setName} onBlur={saveName} editable={!busy} style={s.nameIn} accessibilityLabel="Nazwa przedmiotu" />
                  </View>
                </View>
                <View>
                  <Eyebrow size={10.5}>Kolor</Eyebrow>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                    {hues.map((h) => {
                      const on = cursub.accent2.toLowerCase() === h.color.toLowerCase();
                      return (
                        <Touch key={h.color} onPress={() => void app.updateSubject(subject.id, { accent2: h.color, accent: h.color })} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Kolor ${h.name}`} style={[s.swatch, { backgroundColor: h.color }, on && { borderWidth: 3, borderColor: T.txt }]}>
                          <View />
                        </Touch>
                      );
                    })}
                  </View>
                </View>
              </View>
            </Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Eyebrow>Wygenerowane poziomy · {topicShort(topic)}</Eyebrow>
              <Touch onPress={() => { const l = topic.levels[0]; if (l?.quiz.length) router.push({ pathname: "/edit-question", params: { topicId: topic.id, levelId: l.id, qi: "0" } }); }} accessibilityRole="button" hitSlop={8}>
                <Body size={12.5} weight={800} color={T.acid}>
                  Edytuj treść
                </Body>
              </Touch>
            </View>
            <View style={{ gap: 9 }}>
              {topic.levels.map((l, i) => {
                const hidden = isHidden(app.extra.overrides, topic.id, l.id);
                const nt = (l.tasks ?? l.games ?? []).length;
                return (
                  <Motion key={l.id} kind="up" d={Math.min(6, i + 1)}>
                    <View style={[s.lvRow, hidden && { backgroundColor: T.surface2, borderColor: T.line2 }]}>
                      <Icon name="book" size={16} color={hidden ? T.muted2 : acc2.color} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Body size={13.5} weight={800} color={hidden ? "#7A74AA" : T.txt} numberOfLines={1}>
                          {i + 1} · {noEmoji(l.title)}
                        </Body>
                        <Muted size={11.5} color={hidden ? "#4E4778" : T.muted} style={{ marginTop: 2 }}>
                          {hidden ? "wyłączony — nie było na zajęciach" : `${npl(l.feed.length, "dawka", "dawki", "dawek")} · ${npl(l.flashcards.length, "fiszka", "fiszki", "fiszek")} · ${npl(l.quiz.length, "pytanie", "pytania", "pytań")}${nt ? ` · ${npl(nt, "zadanie", "zadania", "zadań")}` : ""}`}
                        </Muted>
                      </View>
                      <Toggle value={!hidden} onChange={(v) => app.hideLevel(topic.id, l.id, !v)} label={`Poziom ${noEmoji(l.title)}`} />
                    </View>
                  </Motion>
                );
              })}
            </View>
            {failed.length ? <Note tone="gold" icon="alert" text={`${npl(failed.length, "plik pominięty", "pliki pominięte", "plików pominiętych")}: ${failed.map((f) => f.name).join(", ")}.`} /> : null}
          </ScrollView>
          <View style={s.foot}>
            <Btn label="Zacznij naukę" glow onPress={() => router.replace({ pathname: "/t/[topicId]", params: { topicId: topic.id } })} />
            <Btn label="Udostępnij klasie" variant="text" onPress={() => router.push({ pathname: "/share", params: { subjectId: subject.id } })} />
          </View>
        </Screen>
      </AccentProvider>
    );
  }

  /* ---------- ErrorState ---------- */
  if (step === "error") {
    const one = failed.length === 1;
    return (
      <Screen pad={false}>
        <View style={[s.head, { paddingTop: top }]}>
          <TopBar title="Nowy temat" onBack={() => setStep("source")} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 26, paddingBottom: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: "center", gap: 14 }}>
            <Motion kind="shake">
              <View style={s.errIco}>
                <Icon name="file" size={44} stroke={2.4} color={T.red} />
              </View>
            </Motion>
            <View style={{ alignItems: "center" }}>
              <Motion kind="up" d={1}>
                <Display size={26} ls={-0.9} center lh={30}>
                  {failed.length ? (one ? "Jeden plik się nie udał" : `${failed.length} pliki się nie udały`) : "Nie wyszło"}
                </Display>
              </Motion>
              <Muted size={13.5} center lh={20} style={{ marginTop: 8 }}>
                {error ?? "Spróbuj jeszcze raz."}
              </Muted>
            </View>
          </View>
          {files.length ? (
            <Motion kind="up" d={2} style={{ gap: 9 }}>
              {files.map((f) => {
                const bad = failed.find((x) => x.name === f.name);
                return (
                  <View key={f.uri} style={[s.fileRow, bad && { backgroundColor: TONES.red.tint, borderColor: TONES.red.tintLine, alignItems: "flex-start" }]}>
                    <Icon name={f.kind === "image" ? "camera" : "file"} size={19} color={bad ? T.red : T.muted} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Body size={13} weight={bad ? 800 : 700} color={bad ? TONES.red.txt : T.txt2} numberOfLines={1}>
                        {f.name}
                      </Body>
                      {bad ? (
                        <Muted size={12} color={TONES.red.sub} lh={16} style={{ marginTop: 3 }}>
                          {bad.why}
                        </Muted>
                      ) : null}
                    </View>
                    {!bad ? <Muted size={11.5} weight={700}>{fmtSize(f.size)}</Muted> : null}
                  </View>
                );
              })}
            </Motion>
          ) : null}
          <Motion kind="up" d={3}>
            <Card tone="cyan" padding={15} radius={22} drop={4}>
              <Eyebrow color={T.cyan}>Co możesz zrobić</Eyebrow>
              <View style={{ gap: 10, marginTop: 11 }}>
                {[
                  ["camera", "Zrób zdjęcia stron — odczytam tekst"],
                  ["list", "Wklej najważniejsze fragmenty tekstem"],
                  ["refresh", "Sprawdź sieć i spróbuj jeszcze raz"],
                ].map(([ic, t]) => (
                  <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Icon name={ic!} size={17} color={T.cyan} />
                    <Body size={13} color={TONES.cyan.txt}>
                      {t}
                    </Body>
                  </View>
                ))}
              </View>
            </Card>
          </Motion>
        </ScrollView>
        <View style={s.foot}>
          <Btn label={failed.length && files.length > failed.length ? `Pomiń i twórz z ${files.length - failed.length}` : "Spróbuj jeszcze raz"} glow onPress={() => { if (failed.length) setFiles(files.filter((f) => !failed.some((x) => x.name === f.name))); void submit(); }} />
          <Btn label="Dorzuć inny plik" variant="ghost" onPress={() => setStep("source")} />
        </View>
      </Screen>
    );
  }

  /* ---------- Detected ---------- */
  if (step === "detect") {
    const nPages = files.length;
    return (
      <Screen pad={false} blob={<Blob tone="acid" size={270} top={-100} right={-90} />}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={[s.head, { paddingTop: top }]}>
            <TopBar title={mode === "prompt" ? "Z samego hasła" : "Rozpoznaję materiał"} onBack={() => setStep(mode === "photo" ? "scan" : "source")} right={stepDots(1)} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 20, paddingBottom: 20, gap: 13 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Motion kind="up" style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View style={{ width: 84, height: 100 }}>
                {files.slice(0, 2).map((f, i) => (
                  <View key={f.uri} style={[s.miniPage, { left: i ? 10 : 0, top: i ? 0 : 8, transform: [{ rotate: i ? "6deg" : "-5deg" }] }]}>{f.kind === "image" ? <Image source={{ uri: f.uri }} style={{ width: "100%", height: "100%" }} /> : <Icon name="file" size={26} color="#9E968A" />}</View>
                ))}
                {!files.length ? <View style={[s.miniPage, { alignItems: "center", justifyContent: "center" }]}><Icon name={mode === "prompt" ? "edit" : "list"} size={26} color="#9E968A" /></View> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Display size={22} ls={-0.6} lh={26}>
                  {mode === "prompt" ? "Podaj hasło, resztę zrobię sam" : nPages ? `${npl(nPages, "strona", "strony", "stron")} do przeczytania` : "Tekst do przeczytania"}
                </Display>
                <Muted size={12.5} lh={17} style={{ marginTop: 5 }}>
                  Sprawdź, gdzie to dodać — resztę zrobię sam.
                </Muted>
              </View>
            </Motion>
            <Card padding={0} radius={22} drop={4}>
              <View style={{ paddingHorizontal: 15, paddingVertical: 2 }}>
                <Motion kind="up" d={1} style={s.dRow}>
                  <Muted size={12} weight={700} style={{ width: 70 }}>
                    {mode === "prompt" ? "Temat" : "Dział"}
                  </Muted>
                  <TextInput value={hint} onChangeText={setHint} placeholder={mode === "prompt" ? "np. fotosynteza, klasa 7" : "opcjonalnie, np. oddychanie komórkowe"} placeholderTextColor={T.muted2} style={s.dIn} accessibilityLabel="Temat" />
                </Motion>
                <View style={{ height: 2, backgroundColor: T.line2 }} />
                <Motion kind="up" d={2} style={s.dRow}>
                  <Muted size={12} weight={700} style={{ width: 70 }}>
                    Poziom
                  </Muted>
                  <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {STAGES.map((st) => (
                      <Chip key={st.id} label={STAGE_LABEL[st.id]} active={stage === st.id} tone="acid" onPress={() => !cur && setStage(st.id)} style={{ paddingVertical: 5, paddingHorizontal: 10, minHeight: 30, opacity: cur && cur.stage !== st.id ? 0.4 : 1 }} />
                    ))}
                  </View>
                </Motion>
                <View style={{ height: 2, backgroundColor: T.line2 }} />
                <Motion kind="up" d={3} style={s.dRow}>
                  <Muted size={12} weight={700} style={{ width: 70 }}>
                    Poziomy
                  </Muted>
                  <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
                    {[2, 3, 4, 5, 6].map((n) => (
                      <Chip key={n} label={String(n)} active={levels === n} tone="acid" onPress={() => setLevels(n)} style={{ paddingVertical: 5, paddingHorizontal: 12, minHeight: 30 }} />
                    ))}
                  </View>
                </Motion>
                <View style={{ height: 2, backgroundColor: T.line2 }} />
                <View style={s.dRow}>
                  <Muted size={12} weight={700} style={{ width: 70 }}>
                    Język obcy
                  </Muted>
                  <Muted size={12} style={{ flex: 1 }}>
                    fiszki = słówka, quiz = tłumaczenia
                  </Muted>
                  <Toggle value={lang} onChange={setLang} label="Język obcy" />
                </View>
              </View>
            </Card>
            <Eyebrow>Gdzie dodać?</Eyebrow>
            <View style={{ gap: 10 }}>
              {app.subjects.map((sub) => {
                const on = target === sub.id;
                const a = accentOf(sub.accent2, sub.name);
                return (
                  <Motion key={sub.id} kind={on ? "pop" : "up"} d={on ? 0 : 2}>
                    <Press onPress={() => pick(sub.id)} drop={4} edge={on ? T.acidDark : T.shadow} radius={20} faceStyle={[s.where, on && { backgroundColor: TONES.acid.tint, borderColor: T.acid }]} accessibilityLabel={`Do ${noEmoji(sub.name)} — jako nowy temat`}>
                      <Mono text={sub.name} size={40} radius={13} color={a.color} on={a.on} />
                      <View style={{ flex: 1 }}>
                        <Body size={14} weight={800} color={on ? TONES.acid.txt : T.txt}>
                          Do „{noEmoji(sub.name)}” — jako nowy temat
                        </Body>
                        <Muted size={12} color={on ? TONES.acid.sub : T.muted} style={{ marginTop: 2 }}>
                          pojawi się jako kolejny rozdział
                        </Muted>
                      </View>
                      <View style={[s.ck, on && { backgroundColor: T.acid, borderColor: T.acid }]}>{on ? <Icon name="check" size={14} stroke={4} color={T.onAcid} /> : null}</View>
                    </Press>
                  </Motion>
                );
              })}
              <Motion kind={target === "new" ? "pop" : "up"} d={3}>
                <Press onPress={() => pick("new")} drop={4} edge={target === "new" ? T.acidDark : T.shadow} radius={20} faceStyle={[s.where, target === "new" && { backgroundColor: TONES.acid.tint, borderColor: T.acid }]} accessibilityLabel="Nowy przedmiot">
                  <IconTile icon="plus" size={40} color={T.line2} on={T.txt} stroke={3} />
                  <View style={{ flex: 1 }}>
                    <Body size={14} weight={800} color={target === "new" ? TONES.acid.txt : T.txt}>
                      Nowy przedmiot
                    </Body>
                    {target === "new" ? <Input value={newName} onChangeText={setNewName} placeholder="np. Biologia" style={{ marginTop: 8 }} accessibilityLabel="Nazwa nowego przedmiotu" /> : <Muted size={12} style={{ marginTop: 2 }}>osobny kafel na ekranie Dziś</Muted>}
                  </View>
                  <View style={[s.ck, target === "new" && { backgroundColor: T.acid, borderColor: T.acid }]}>{target === "new" ? <Icon name="check" size={14} stroke={4} color={T.onAcid} /> : null}</View>
                </Press>
              </Motion>
            </View>
          </ScrollView>
          <View style={s.foot}>
            <Btn label={mode === "prompt" ? "Generuj temat" : files.length ? `Generuj z ${npl(files.length, "pliku", "plików", "plików")}` : "Generuj"} glow disabled={!canNext || (target === "new" && !newName.trim() && !hint.trim())} onPress={submit} />
          </View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  /* ---------- AddSubject (source) ---------- */
  return (
    <Screen pad={false} blob={<Blob tone="acid" size={260} top={-110} left={-90} />}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={[s.head, { paddingTop: top }]}>
          <TopBar title={cur ? `Nowy temat · ${noEmoji(cur.name)}` : "Nowy przedmiot"} onBack={close} right={stepDots(1)} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 20, paddingBottom: 20, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View>
            <Display size={26} ls={-0.9} lh={29}>
              {mode === "prompt" ? "O czym ma być temat?" : "Skąd wziąć materiał?"}
            </Display>
            <Muted size={13.5} lh={20} style={{ marginTop: 7 }}>
              {mode === "prompt" ? "Wpisz hasło — ułożę poziomy według podstawy programowej dla twojego etapu." : "Wrzuć prezentacje z zajęć, skrypt albo notatki. Z tego powstaną poziomy, fiszki i pytania."}
            </Muted>
          </View>
          {mode === "prompt" ? (
            <>
              <Eyebrow>Temat</Eyebrow>
              <Input value={hint} onChangeText={setHint} placeholder="np. fotosynteza, klasa 7" autoFocus big />
            </>
          ) : (
            <>
              <Motion kind="glow">
                <Press onPress={pickDocs} drop={4} edge={T.acid} radius={22} faceStyle={s.big} accessibilityLabel="Wgraj pliki">
                  <IconTile icon="upload" size={46} tone="acid" />
                  <View style={{ flex: 1 }}>
                    <Body size={15} weight={800} color={TONES.acid.txt}>
                      Wgraj pliki
                    </Body>
                    <Muted size={12.5} color={TONES.acid.sub} style={{ marginTop: 2 }}>
                      PDF, tekst, zdjęcia — do {maxFiles} plików
                    </Muted>
                  </View>
                </Press>
              </Motion>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Press onPress={() => setStep("scan")} drop={4} edge={T.shadow} radius={22} style={{ flex: 1 }} faceStyle={s.tile} accessibilityLabel="Zdjęcia notatek">
                  <IconTile icon="camera" size={40} color={T.line2} on={T.txt} />
                  <Body size={14} weight={800}>
                    Zdjęcia notatek
                  </Body>
                  <Muted size={12} lh={16}>
                    tekst odczytany z fotek
                  </Muted>
                </Press>
                <Press onPress={pickImages} drop={4} edge={T.shadow} radius={22} style={{ flex: 1 }} faceStyle={s.tile} accessibilityLabel="Z galerii">
                  <IconTile icon="grid" size={40} color={T.line2} on={T.txt} />
                  <Body size={14} weight={800}>
                    Z galerii
                  </Body>
                  <Muted size={12} lh={16}>
                    zdjęcia, które już masz
                  </Muted>
                </Press>
              </View>
              {files.length ? (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Eyebrow>Dodane ({files.length})</Eyebrow>
                    <Muted size={12} weight={800}>
                      {files.length}/{maxFiles}
                    </Muted>
                  </View>
                  <View style={{ gap: 9 }}>
                    {files.map((f, i) => (
                      <Motion key={f.uri + i} kind="up" d={Math.min(6, i + 1)} style={s.fileRow}>
                        {f.kind === "image" ? <Image source={{ uri: f.uri }} style={{ width: 32, height: 40, borderRadius: 6 }} /> : <Icon name="file" size={20} color={T.muted} />}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Body size={13} color={T.txt2} numberOfLines={1}>
                            {f.name}
                          </Body>
                          <Muted size={11.5}>{[fmtSize(f.size), f.kind === "pdf" ? "PDF" : f.kind === "image" ? "zdjęcie" : "tekst"].filter(Boolean).join(" · ")}</Muted>
                        </View>
                        <Touch onPress={() => setFiles(files.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Usuń plik ${f.name}`} style={s.x}>
                          <Icon name="close" size={14} stroke={3} color={T.txt} />
                        </Touch>
                      </Motion>
                    ))}
                  </View>
                </>
              ) : null}
              <Eyebrow>{mode === "text" ? "Tekst" : "…albo wklej tekst"}</Eyebrow>
              <Input value={text} onChangeText={setText} placeholder="np. notatki z lekcji, definicje, rozdział z podręcznika…" multiline autoFocus={mode === "text"} style={{ minHeight: mode === "text" ? 180 : 96 }} />
            </>
          )}
        </ScrollView>
        <View style={s.foot}>
          <Btn label="Dalej" glow disabled={!canNext} onPress={() => setStep("detect")} right={<Icon name="chevron-right" size={18} stroke={3} color={T.onAcid} />} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: 18 },
  foot: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 26, gap: 4 },
  big: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: TONES.acid.tint, borderWidth: 2, borderColor: T.acid, paddingVertical: 15, paddingHorizontal: 16 },
  tile: { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, paddingVertical: 15, paddingHorizontal: 14, gap: 8 },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: T.surface2, borderWidth: 2, borderColor: T.line2, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 13 },
  x: { width: 30, height: 30, borderRadius: 10, backgroundColor: T.line2, alignItems: "center", justifyContent: "center" },
  camTop: { position: "absolute", top: 0, left: 0, right: 0, height: 520, backgroundColor: "#2A2723", opacity: 0.6 },
  camBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,.45)", alignItems: "center", justifyContent: "center" },
  page: { width: 262, height: 356, borderRadius: 8, backgroundColor: "#EDE9DF", transform: [{ rotate: "-3deg" }], overflow: "hidden" },
  corner: { position: "absolute", width: 38, height: 38, borderColor: T.acid },
  camHint: { position: "absolute", bottom: 18, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: "rgba(0,0,0,.6)" },
  camFoot: { backgroundColor: T.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28, gap: 16 },
  thumb: { width: 48, height: 64, borderRadius: 8, backgroundColor: "#EDE9DF" },
  thumbOk: { position: "absolute", bottom: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: T.acid, alignItems: "center", justifyContent: "center" },
  shutter: { width: 80, height: 80, backgroundColor: T.acid, alignItems: "center", justifyContent: "center" },
  stepIco: { width: 26, height: 26, borderRadius: 9, backgroundColor: T.line2, alignItems: "center", justifyContent: "center" },
  genStat: { flex: 1, backgroundColor: T.surface2, borderWidth: 2, borderColor: T.line2, borderRadius: 18, paddingVertical: 13, paddingHorizontal: 10, alignItems: "center" },
  nameIn: { marginTop: 6, backgroundColor: T.surface2, borderWidth: 2, borderColor: T.line, borderRadius: 13, paddingVertical: 10, paddingHorizontal: 12, color: T.txt, fontFamily: body(700), fontSize: 14 },
  swatch: { width: 38, height: 38, borderRadius: 13 },
  lvRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14 },
  errIco: { width: 92, height: 92, borderRadius: 30, backgroundColor: TONES.red.tint, borderWidth: 2, borderColor: T.red, alignItems: "center", justifyContent: "center" },
  miniPage: { position: "absolute", width: 66, height: 88, borderRadius: 8, backgroundColor: "#EDE9DF", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  dRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  dIn: { flex: 1, color: T.txt, fontFamily: body(800), fontSize: 14, padding: 0 },
  where: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, padding: 14 },
  ck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: T.dash, alignItems: "center", justifyContent: "center" },
});
