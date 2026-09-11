import { PLANS, type GenerationOptions } from "@nauka/shared";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glow, HueProvider } from "@/components/Accent";
import { Body, Display, Label, Muted, Title } from "@/components/Text";
import { BackButton, Button, Empty, Input, Touch } from "@/components/ui";
import { ApiError, generate } from "@/lib/api";
import { haptic, useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { hasApi } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { COLORS, RADIUS, SPACE, UI, display, hueFrom } from "@/lib/theme";
import { guessMime, uploadMaterial, type PickedFile } from "@/lib/upload";

type Mode = "materials" | "prompt";
type Phase = "form" | "upload" | "generate" | "done" | "error";

const FUN = ["czytam Twoje materiały", "rozkminiam, co jest ważne", "sprawdzam podstawę programową", "wymyślam pytania, które wejdą na sprawdzianie", "robię fiszki (te dobre)", "składam mini-gry", "dopieszczam wyjaśnienia „po ludzku”"];

/** Nowy temat w przedmiocie: `materials` (zdjęcia/PDF/tekst) albo `prompt` (samo hasło) → POST /api/generate → t/[topicId]. */
export default function NewTopic() {
  const { subjectId, mode: modeParam } = useLocalSearchParams<{ subjectId: string; mode?: Mode }>();
  const app = useApp();
  const auth = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const subject = app.findSubject(subjectId ?? "");
  const hue = hueFrom(subject?.accent2, subject?.name);
  const [mode, setMode] = useState<Mode>(modeParam === "prompt" ? "prompt" : "materials");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");
  const [levels, setLevels] = useState(4);
  const [lang, setLang] = useState(subject?.category === "angielski" || subject?.category === "inny-jezyk" || subject?.category === "jezyk");
  const [phase, setPhase] = useState<Phase>("form");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [funIdx, setFunIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const plan = "free" as const; // limity egzekwuje API; tu tylko UX
  const maxFiles = PLANS[plan].filesPerGeneration;

  useEffect(() => {
    if (phase !== "generate") return;
    timer.current = setInterval(() => setFunIdx((i) => (i + 1) % FUN.length), 2600);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [phase]);

  const addFiles = (list: PickedFile[]) =>
    setFiles((cur) => {
      if (cur.length + list.length > maxFiles) app.showToast(`Max ${maxFiles} plików na raz (plan ${PLANS[plan].label})`);
      return [...cur, ...list].slice(0, maxFiles);
    });

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return app.showToast("Bez aparatu nie zrobię zdjęcia");
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (r.canceled) return;
    addFiles(r.assets.map((a, i) => ({ uri: a.uri, name: a.fileName ?? `zdjecie-${Date.now()}-${i}.jpg`, mime: a.mimeType ?? "image/jpeg", size: a.fileSize, kind: "image" as const })));
  };
  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return app.showToast("Bez dostępu do galerii nie dam rady");
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: maxFiles - files.length, quality: 0.8 });
    if (r.canceled) return;
    addFiles(r.assets.map((a, i) => ({ uri: a.uri, name: a.fileName ?? `obraz-${Date.now()}-${i}.jpg`, mime: a.mimeType ?? guessMime(a.fileName ?? "", "image/jpeg"), size: a.fileSize, kind: "image" as const })));
  };
  const pickPdf = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "text/plain", "text/markdown"], multiple: true, copyToCacheDirectory: true });
    if (r.canceled) return;
    addFiles(
      r.assets.map((a) => {
        const mime = a.mimeType ?? guessMime(a.name);
        return { uri: a.uri, name: a.name, mime, size: a.size, kind: mime === "application/pdf" ? ("pdf" as const) : ("text" as const) };
      }),
    );
  };

  const canSubmit = phase === "form" && !!subject && (mode === "prompt" ? hint.trim().length >= 3 : files.length > 0 || text.trim().length > 20);

  const submit = async () => {
    if (!subject || !auth.user || !supabase) return;
    const token = await auth.accessToken();
    if (!token) return app.showToast("Sesja wygasła — zaloguj się ponownie.");
    if (!hasApi) {
      setError("Brak EXPO_PUBLIC_API_URL — nie wiem, gdzie jest API.");
      return setPhase("error");
    }
    setError(null);
    try {
      const materialIds: string[] = [];
      if (mode === "materials" && files.length) {
        setPhase("upload");
        setProgress({ done: 0, total: files.length });
        for (const f of files) {
          const m = await uploadMaterial(supabase, auth.user.id, f, plan);
          materialIds.push(m.id);
          setProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      }
      setPhase("generate");
      haptic.tap();
      const options: GenerationOptions = { stage: subject.stage, subjectName: subject.name, mode, levels, lang, locale: "pl" };
      if (hint.trim()) options.hint = hint.trim();
      const r = await generate(token, { subjectId: subject.id, materialIds: mode === "materials" ? materialIds : undefined, text: mode === "materials" && text.trim() ? text.trim() : undefined, options });
      const topic = r.topic ?? (await app.getTopic(r.topicId));
      if (topic) app.registerTopic(topic);
      setTopicId(r.topicId);
      setPhase("done");
      haptic.ok();
      void app.refresh();
    } catch (e) {
      haptic.bad();
      let msg = e instanceof Error ? e.message : "Coś się wysypało.";
      if (e instanceof ApiError && e.code === "limit_reached") msg = `Limit tematów na ten miesiąc wyczerpany (${String(e.extra?.used ?? "?")}/${String(e.extra?.limit ?? "?")}). Pro daje ${PLANS.pro.generationsPerMonth}/mies.`;
      if (e instanceof ApiError && e.status === 401) msg = "Sesja wygasła — zaloguj się ponownie.";
      setError(msg);
      setPhase("error");
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  if (!subject)
    return (
      <View style={[s.wrap, { justifyContent: "center" }]}>
        <Empty icon="?" title="Brak przedmiotu" action={<Button label="Wróć" onPress={close} />} />
      </View>
    );

  if (phase === "upload" || phase === "generate") {
    return (
      <HueProvider color={hue.color}>
        <View style={[s.wrap, s.center, { paddingTop: insets.top }]}>
          <Glow size={420} alpha={0.16} style={{ alignSelf: "center", top: "25%" }} />
          <Label>{phase === "upload" ? `wysyłam pliki ${progress.done}/${progress.total}` : "ai składa temat"}</Label>
          <Display size="2xl" weight={700} center>
            {phase === "upload" ? "Prosto do Twojego schowka" : FUN[funIdx]}
          </Display>
          <View style={s.dots}>
            {FUN.map((_, i) => (
              <View key={i} style={[s.dot, phase === "generate" && i === funIdx && { backgroundColor: COLORS.accent, width: 18 }]} />
            ))}
          </View>
          <Muted center>To trwa zwykle 1–3 min. Nie zamykaj apki.</Muted>
        </View>
      </HueProvider>
    );
  }

  if (phase === "done" && topicId) {
    return (
      <HueProvider color={hue.color}>
        <View style={[s.wrap, s.center, { paddingTop: insets.top }]}>
          <Glow size={420} alpha={0.16} style={{ alignSelf: "center", top: "25%" }} />
          <Label>gotowe</Label>
          <Display size="2xl" weight={700} center>
            Temat gotowy
          </Display>
          <Body center color={COLORS.muted}>
            Ścieżka, fiszki, mini-gry, quiz i egzamin czekają.
          </Body>
          <View style={{ alignSelf: "stretch", gap: SPACE[2], marginTop: SPACE[3] }}>
            <Button label="Otwórz" onPress={() => router.replace({ pathname: "/t/[topicId]", params: { topicId } })} />
            <Button label="Wróć do przedmiotu" variant="ghost" onPress={close} />
          </View>
        </View>
      </HueProvider>
    );
  }

  if (phase === "error") {
    return (
      <View style={[s.wrap, { paddingTop: insets.top, justifyContent: "center" }]}>
        <Empty icon="!" title="Nie wyszło" text={error ?? "Spróbuj ponownie."} action={<Button label="Spróbuj jeszcze raz" onPress={() => setPhase("form")} />} />
        <Button label="Wróć" variant="ghost" onPress={close} style={{ marginHorizontal: SPACE[5] }} />
      </View>
    );
  }

  return (
    <HueProvider color={hue.color}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.wrap}>
        <View style={[s.head, { paddingTop: Platform.OS === "ios" ? SPACE[4] : insets.top + SPACE[2] }]}>
          <BackButton onPress={close} label="✕" />
          <View style={{ flex: 1 }}>
            <Title size="md">Nowy temat</Title>
            <Muted size="xs">{subject.name}</Muted>
          </View>
        </View>
        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.modes}>
            <Touch onPress={() => setMode("materials")} style={[s.mode, mode === "materials" && s.modeOn]}>
              <Body size="sm" weight={600} color={mode === "materials" ? COLORS.text : COLORS.muted}>
                Z materiałów
              </Body>
            </Touch>
            <Touch onPress={() => setMode("prompt")} style={[s.mode, mode === "prompt" && s.modeOn]}>
              <Body size="sm" weight={600} color={mode === "prompt" ? COLORS.text : COLORS.muted}>
                Z hasła
              </Body>
            </Touch>
          </View>

          {mode === "prompt" ? (
            <>
              <Body color={COLORS.muted}>Wpisz temat — AI zrobi lekcje wg podstawy programowej dla Twojego etapu.</Body>
              <Label>temat</Label>
              <Input value={hint} onChangeText={setHint} placeholder="np. fotosynteza, klasa 7" autoFocus />
            </>
          ) : (
            <>
              <Body color={COLORS.muted}>Wrzuć zdjęcia notatek lub slajdów, PDF albo wklej tekst. AI uczy tylko tego, co jest w materiałach.</Body>
              <Label>
                materiały · {files.length}/{maxFiles}
              </Label>
              <View style={s.srcRow}>
                {(
                  [
                    ["Zdjęcie", "📷", takePhoto],
                    ["Galeria", "🖼", pickImages],
                    ["PDF / txt", "📄", pickPdf],
                  ] as [string, string, () => void][]
                ).map(([l, e, fn]) => (
                  <Touch key={l} onPress={fn} style={s.src}>
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                    <Muted size="xs" weight={600} color={COLORS.text}>
                      {l}
                    </Muted>
                  </Touch>
                ))}
              </View>
              {files.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE[2], paddingVertical: SPACE[2] }}>
                  {files.map((f, i) => (
                    <Touch key={`${f.uri}-${i}`} onPress={() => setFiles(files.filter((_, j) => j !== i))} style={s.thumbWrap}>
                      {f.kind === "image" ? (
                        <Image source={{ uri: f.uri }} style={s.thumb} />
                      ) : (
                        <View style={[s.thumb, s.thumbDoc]}>
                          <Text style={{ fontSize: 22 }}>{f.kind === "pdf" ? "📄" : "📝"}</Text>
                          <Muted size="xs" center numberOfLines={2}>
                            {f.name}
                          </Muted>
                        </View>
                      )}
                      <View style={s.x}>
                        <Text style={{ color: COLORS.text, fontSize: 11, fontFamily: display(700) }}>✕</Text>
                      </View>
                    </Touch>
                  ))}
                </ScrollView>
              ) : null}
              <Label>…albo wklej tekst</Label>
              <Input value={text} onChangeText={setText} placeholder="np. notatki z lekcji, definicje, rozdział z podręcznika…" multiline />
              <Label>co to jest? (opcjonalnie)</Label>
              <Input value={hint} onChangeText={setHint} placeholder="np. fotosynteza — kartkówka za tydzień" />
            </>
          )}

          <Label>poziomy · {levels}</Label>
          <View style={s.lvRow}>
            {[2, 3, 4, 5, 6].map((n) => (
              <Touch key={n} onPress={() => setLevels(n)} style={[s.lv, levels === n && { backgroundColor: hue.soft, borderColor: hue.color }]}>
                <Text style={[s.lvTxt, levels === n && { color: COLORS.text }]}>{n}</Text>
              </Touch>
            ))}
          </View>

          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Title size="base">Język obcy</Title>
              <Muted size="xs">fiszki = słówka, quiz = tłumaczenia</Muted>
            </View>
            <Switch value={lang} onValueChange={setLang} trackColor={{ true: COLORS.accent, false: COLORS.bg4 }} thumbColor={COLORS.text} />
          </View>
        </ScrollView>
        <View style={[s.foot, { paddingBottom: Math.max(insets.bottom, SPACE[3]) }]}>
          <Button label={mode === "prompt" ? "Generuj temat" : files.length ? `Generuj z ${files.length} ${files.length === 1 ? "pliku" : "plików"}` : "Generuj"} onPress={submit} disabled={!canSubmit} />
        </View>
      </KeyboardAvoidingView>
    </HueProvider>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg0 },
  center: { alignItems: "center", justifyContent: "center", gap: SPACE[3], padding: SPACE[8] },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE[3], paddingHorizontal: UI.gutter, paddingBottom: SPACE[2] },
  dots: { flexDirection: "row", gap: 6, marginTop: SPACE[1] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.bg4 },
  scroll: { paddingHorizontal: UI.gutter, gap: SPACE[2] },
  modes: { flexDirection: "row", gap: 4, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.pill, padding: 4, marginBottom: SPACE[2] },
  mode: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.pill, alignItems: "center" },
  modeOn: { backgroundColor: COLORS.bg4 },
  srcRow: { flexDirection: "row", gap: SPACE[2] },
  src: { flex: 1, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.md, paddingVertical: SPACE[3], alignItems: "center", gap: 4 },
  thumbWrap: { position: "relative" },
  thumb: { width: 88, height: 88, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg3 },
  thumbDoc: { alignItems: "center", justifyContent: "center", padding: 6, gap: 4, borderWidth: 1, borderColor: COLORS.line },
  x: { position: "absolute", top: -4, right: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.bg4, borderWidth: 1, borderColor: COLORS.lineStrong, alignItems: "center", justifyContent: "center" },
  lvRow: { flexDirection: "row", gap: SPACE[2] },
  lv: { flex: 1, aspectRatio: 1, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center" },
  lvTxt: { color: COLORS.muted, fontFamily: display(700), fontSize: 16 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: SPACE[3], backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.md, padding: SPACE[4], marginTop: SPACE[3] },
  foot: { paddingHorizontal: UI.gutter, paddingTop: SPACE[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.lineStrong, backgroundColor: COLORS.bg0 },
});
