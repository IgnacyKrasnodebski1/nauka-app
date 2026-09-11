import { PLANS, type GenerationOptions } from "@nauka/shared";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, generate } from "@/lib/api";
import { haptic, useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { hasApi } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { C, FONT, R } from "@/lib/theme";
import { guessMime, uploadMaterial, type PickedFile } from "@/lib/upload";
import { BackButton, Empty, Muted, PillButton, Touch } from "@/components/ui";

type Mode = "materials" | "prompt";
type Phase = "form" | "upload" | "generate" | "done" | "error";

const FUN = [
  "czytam Twoje materiały 👀",
  "rozkminiam, co jest ważne 🧠",
  "sprawdzam podstawę programową 📚",
  "wymyślam pytania, które wejdą na sprawdzianie 📝",
  "robię fiszki (te dobre) 🎴",
  "składam mini-gry 🧩",
  "dopieszczam wyjaśnienia „po ludzku” 🗣️",
];

/** Nowy temat w przedmiocie: `materials` (zdjęcia/PDF/tekst) albo `prompt` (samo hasło) → POST /api/generate → t/[topicId]. */
export default function NewTopic() {
  const { subjectId, mode: modeParam } = useLocalSearchParams<{ subjectId: string; mode?: Mode }>();
  const app = useApp();
  const auth = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const subject = app.findSubject(subjectId ?? "");
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
    if (!perm.granted) return app.showToast("Bez aparatu nie zrobię zdjęcia 📷");
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (r.canceled) return;
    addFiles(r.assets.map((a, i) => ({ uri: a.uri, name: a.fileName ?? `zdjecie-${Date.now()}-${i}.jpg`, mime: a.mimeType ?? "image/jpeg", size: a.fileSize, kind: "image" as const })));
  };
  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return app.showToast("Bez dostępu do galerii nie dam rady 🖼️");
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
      if (e instanceof ApiError && e.code === "limit_reached") msg = `Limit tematów na ten miesiąc wyczerpany (${String(e.extra?.used ?? "?")}/${String(e.extra?.limit ?? "?")}). Pro daje ${PLANS.pro.generationsPerMonth}/mies. 💜`;
      if (e instanceof ApiError && e.status === 401) msg = "Sesja wygasła — zaloguj się ponownie.";
      setError(msg);
      setPhase("error");
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  if (!subject) return <Empty emoji="🫥" title="Brak przedmiotu" action={<PillButton label="wróć" onPress={close} />} />;

  if (phase === "upload" || phase === "generate") {
    return (
      <View style={[s.wrap, s.center, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 64 }}>{phase === "upload" ? "📤" : "🤖"}</Text>
        <Text style={s.h}>{phase === "upload" ? `Wysyłam pliki ${progress.done}/${progress.total}` : "AI składa temat"}</Text>
        <Text style={s.fun}>{phase === "upload" ? "prosto do Twojego prywatnego schowka" : FUN[funIdx]}</Text>
        <View style={s.dots}>
          {FUN.map((_, i) => (
            <View key={i} style={[s.dot, phase === "generate" && i === funIdx && { backgroundColor: C.cyan, width: 18 }]} />
          ))}
        </View>
        <Muted style={{ textAlign: "center", fontSize: 13 }}>To trwa zwykle 1–3 min. Nie zamykaj apki.</Muted>
      </View>
    );
  }

  if (phase === "done" && topicId) {
    return (
      <View style={[s.wrap, s.center, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 64 }}>🎉</Text>
        <Text style={s.h}>Temat gotowy!</Text>
        <Muted style={{ textAlign: "center" }}>Ścieżka, fiszki, mini-gry, quiz i egzamin czekają.</Muted>
        <PillButton label="otwórz 🚀" onPress={() => router.replace({ pathname: "/t/[topicId]", params: { topicId } })} style={{ marginTop: 10 }} />
        <PillButton label="wróć do przedmiotu" ghost onPress={close} />
      </View>
    );
  }

  if (phase === "error") {
    return (
      <View style={[s.wrap, { paddingTop: insets.top }]}>
        <Empty emoji="💀" title="Nie wyszło" text={error ?? "Spróbuj ponownie."} action={<PillButton label="spróbuj jeszcze raz" onPress={() => setPhase("form")} />} />
        <PillButton label="wróć" ghost onPress={close} style={{ marginHorizontal: 20 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.wrap}>
      <View style={[s.head, { paddingTop: Platform.OS === "ios" ? 14 : insets.top + 8 }]}>
        <BackButton onPress={close} label="✕" />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Nowy temat</Text>
          <Text style={s.subTitle}>
            {subject.emoji} {subject.name}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.modes}>
          <Touch onPress={() => setMode("materials")} style={[s.mode, mode === "materials" && s.modeOn]}>
            <Text style={[s.modeTxt, mode === "materials" && { color: C.txt }]}>📸 Z materiałów</Text>
          </Touch>
          <Touch onPress={() => setMode("prompt")} style={[s.mode, mode === "prompt" && s.modeOn]}>
            <Text style={[s.modeTxt, mode === "prompt" && { color: C.txt }]}>✍️ Z hasła</Text>
          </Touch>
        </View>

        {mode === "prompt" ? (
          <>
            <Muted>Wpisz temat — AI zrobi lekcje wg podstawy programowej dla Twojego etapu ({subject.stage}).</Muted>
            <Text style={s.label}>Temat</Text>
            <TextInput value={hint} onChangeText={setHint} placeholder="np. fotosynteza, klasa 7" placeholderTextColor={C.muted} style={s.input} autoFocus />
          </>
        ) : (
          <>
            <Muted>Wrzuć zdjęcia notatek/slajdów, PDF albo wklej tekst. AI uczy tylko tego, co jest w materiałach.</Muted>
            <Text style={s.label}>
              Materiały ({files.length}/{maxFiles})
            </Text>
            <View style={s.srcRow}>
              <Touch onPress={takePhoto} style={s.src}>
                <Text style={s.srcEmoji}>📷</Text>
                <Text style={s.srcTxt}>zrób zdjęcie</Text>
              </Touch>
              <Touch onPress={pickImages} style={s.src}>
                <Text style={s.srcEmoji}>🖼️</Text>
                <Text style={s.srcTxt}>z galerii</Text>
              </Touch>
              <Touch onPress={pickPdf} style={s.src}>
                <Text style={s.srcEmoji}>📄</Text>
                <Text style={s.srcTxt}>PDF / txt</Text>
              </Touch>
            </View>
            {files.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
                {files.map((f, i) => (
                  <Touch key={`${f.uri}-${i}`} onPress={() => setFiles(files.filter((_, j) => j !== i))} style={s.thumbWrap}>
                    {f.kind === "image" ? (
                      <Image source={{ uri: f.uri }} style={s.thumb} />
                    ) : (
                      <View style={[s.thumb, s.thumbDoc]}>
                        <Text style={{ fontSize: 26 }}>{f.kind === "pdf" ? "📄" : "📝"}</Text>
                        <Text style={s.thumbName} numberOfLines={2}>
                          {f.name}
                        </Text>
                      </View>
                    )}
                    <View style={s.x}>
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: FONT.black }}>✕</Text>
                    </View>
                  </Touch>
                ))}
              </ScrollView>
            ) : null}
            <Text style={s.label}>…albo wklej tekst</Text>
            <TextInput value={text} onChangeText={setText} placeholder="np. notatki z lekcji, definicje, rozdział z podręcznika…" placeholderTextColor={C.muted} multiline style={[s.input, { minHeight: 100, textAlignVertical: "top" }]} />
            <Text style={s.label}>Co to jest? (opis dla AI, opcjonalnie)</Text>
            <TextInput value={hint} onChangeText={setHint} placeholder="np. fotosynteza — kartkówka za tydzień" placeholderTextColor={C.muted} style={s.input} />
          </>
        )}

        <Text style={s.label}>Ile poziomów: {levels}</Text>
        <View style={s.lvRow}>
          {[2, 3, 4, 5, 6].map((n) => (
            <Touch key={n} onPress={() => setLevels(n)} style={[s.lv, levels === n && s.lvOn]}>
              <Text style={[s.lvTxt, levels === n && { color: "#fff" }]}>{n}</Text>
            </Touch>
          ))}
        </View>

        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.switchTitle}>🌍 Język obcy</Text>
            <Muted style={{ fontSize: 12.5 }}>fiszki = słówka, quiz = tłumaczenia</Muted>
          </View>
          <Switch value={lang} onValueChange={setLang} trackColor={{ true: C.purple, false: C.card2 }} thumbColor="#fff" />
        </View>
      </ScrollView>
      <View style={[s.foot, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <PillButton label={mode === "prompt" ? "generuj temat 🚀" : files.length ? `generuj z ${files.length} ${files.length === 1 ? "pliku" : "plików"} 🚀` : "generuj 🚀"} onPress={submit} disabled={!canSubmit} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: "center", justifyContent: "center", gap: 14, padding: 28 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  title: { color: C.txt, fontSize: 19, fontWeight: FONT.black, letterSpacing: -0.3 },
  subTitle: { color: C.muted, fontSize: 12.5, fontWeight: FONT.semi },
  h: { color: C.txt, fontSize: 24, fontWeight: FONT.black, textAlign: "center", letterSpacing: -0.5 },
  fun: { color: C.cyan, fontSize: 16, fontWeight: FONT.bold, textAlign: "center" },
  dots: { flexDirection: "row", gap: 6, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.card2 },
  scroll: { paddingHorizontal: 16, gap: 8 },
  modes: { flexDirection: "row", gap: 6, backgroundColor: C.faint, borderRadius: R.pill, padding: 4, marginBottom: 6 },
  mode: { flex: 1, paddingVertical: 10, borderRadius: R.pill, alignItems: "center" },
  modeOn: { backgroundColor: C.card2 },
  modeTxt: { color: C.muted, fontWeight: FONT.bold, fontSize: 13.5 },
  label: { color: C.muted, fontSize: 12, fontWeight: FONT.bold, textTransform: "uppercase", letterSpacing: 0.7, marginTop: 14, marginBottom: 4 },
  srcRow: { flexDirection: "row", gap: 8 },
  src: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border2, borderRadius: R.md, paddingVertical: 14, alignItems: "center", gap: 4 },
  srcEmoji: { fontSize: 26 },
  srcTxt: { color: C.txt, fontSize: 12.5, fontWeight: FONT.bold },
  thumbWrap: { position: "relative" },
  thumb: { width: 92, height: 92, borderRadius: 14, backgroundColor: C.card2 },
  thumbDoc: { alignItems: "center", justifyContent: "center", padding: 6, gap: 4 },
  thumbName: { color: C.muted, fontSize: 10, textAlign: "center" },
  x: { position: "absolute", top: -4, right: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: C.red, alignItems: "center", justifyContent: "center" },
  input: { backgroundColor: "#0e0e1a", borderWidth: 2, borderColor: C.border2, borderRadius: 15, color: C.txt, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15.5 },
  lvRow: { flexDirection: "row", gap: 8 },
  lv: { flex: 1, aspectRatio: 1, borderRadius: 12, backgroundColor: C.faint, borderWidth: 1, borderColor: C.border2, alignItems: "center", justifyContent: "center" },
  lvOn: { backgroundColor: C.purple, borderColor: C.purple },
  lvTxt: { color: C.muted, fontWeight: FONT.black, fontSize: 16 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 14, marginTop: 14 },
  switchTitle: { color: C.txt, fontWeight: FONT.bold, fontSize: 15 },
  foot: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
});
