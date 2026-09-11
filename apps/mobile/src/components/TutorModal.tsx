import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, tutorAsk, type TutorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { hasApi } from "@/lib/env";
import { C, FONT, R } from "@/lib/theme";
import { BackButton, PillButton, Touch } from "./ui";

/** Czat z tutorem AI (POST /api/tutor, streaming gdy RN fetch to umie). */
export function TutorModal({ open, onClose, subjectId, levelId, levelTitle }: { open: boolean; onClose: () => void; subjectId: string; levelId: string; levelTitle: string }) {
  const auth = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const abort = useRef<AbortController | null>(null);

  const send = async (q?: string) => {
    const question = (q ?? input).trim();
    if (!question || busy) return;
    const token = await auth.accessToken();
    if (!token) {
      setErr("Tutor działa tylko po zalogowaniu — załóż konto, to za darmo.");
      return;
    }
    setErr(null);
    setInput("");
    const history = msgs;
    setMsgs([...history, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setBusy(true);
    abort.current = new AbortController();
    try {
      await tutorAsk(
        token,
        { subjectId, levelId, question, history },
        (text) => setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: text }]),
        abort.current.signal,
      );
    } catch (e) {
      const msg = e instanceof ApiError && e.code === "limit_reached" ? "Limit wiadomości na dziś wyczerpany. Pro = bez limitu 💜" : e instanceof Error ? e.message : "Coś się wysypało.";
      setErr(msg);
      setMsgs((m) => (m[m.length - 1]?.content === "" ? m.slice(0, -1) : m));
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const close = () => {
    abort.current?.abort();
    onClose();
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[s.wrap, { paddingTop: Platform.OS === "ios" ? 12 : insets.top + 8 }]}>
        <View style={s.head}>
          <BackButton onPress={close} label="✕" />
          <View style={{ flex: 1 }}>
            <Text style={s.title}>🤖 Tutor</Text>
            <Text style={s.sub} numberOfLines={1}>
              {levelTitle}
            </Text>
          </View>
        </View>
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={s.list} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
          {msgs.length === 0 ? (
            <View style={{ gap: 10 }}>
              <Text style={s.hello}>Siema 👋 Jestem Twoim tutorem od tego poziomu. Pytaj o cokolwiek — wytłumaczę po ludzku, dam przykład, przepytam.</Text>
              {!hasApi ? <Text style={s.err}>Brak EXPO_PUBLIC_API_URL — tutor wymaga API weba.</Text> : null}
              {!auth.user ? (
                <PillButton label="zaloguj się, żeby gadać z tutorem" ghost small onPress={() => { close(); router.push("/(auth)/login"); }} />
              ) : (
                <View style={s.sugg}>
                  {["Wytłumacz to jak 12-latkowi", "Daj przykład z życia", "Przepytaj mnie z tego"].map((t) => (
                    <Touch key={t} onPress={() => send(t)} style={s.suggBtn}>
                      <Text style={s.suggTxt}>{t}</Text>
                    </Touch>
                  ))}
                </View>
              )}
            </View>
          ) : null}
          {msgs.map((m, i) => (
            <View key={i} style={[s.msg, m.role === "user" ? s.me : s.bot]}>
              <Text style={s.msgTxt}>{m.content || (busy ? "…myślę 🧠" : "")}</Text>
            </View>
          ))}
          {err ? <Text style={s.err}>{err}</Text> : null}
        </ScrollView>
        <View style={[s.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput value={input} onChangeText={setInput} placeholder="np. czemu to działa tak, a nie inaczej?" placeholderTextColor={C.muted} style={s.input} multiline onSubmitEditing={() => send()} editable={!busy} returnKeyType="send" />
          <Touch onPress={() => send()} disabled={busy || !input.trim()} style={[s.sendBtn, (busy || !input.trim()) && { opacity: 0.4 }]}>
            <Text style={{ fontSize: 20 }}>🚀</Text>
          </Touch>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  title: { color: C.txt, fontWeight: FONT.black, fontSize: 18 },
  sub: { color: C.muted, fontSize: 12.5, fontWeight: FONT.semi },
  list: { padding: 16, gap: 10, paddingBottom: 24 },
  hello: { color: C.txt, fontSize: 15.5, lineHeight: 23, backgroundColor: C.card, borderRadius: R.lg, padding: 16, borderWidth: 1, borderColor: C.border },
  sugg: { gap: 8 },
  suggBtn: { backgroundColor: C.faint2, borderWidth: 1, borderColor: C.border2, borderRadius: R.pill, paddingVertical: 10, paddingHorizontal: 14, alignSelf: "flex-start" },
  suggTxt: { color: C.txt, fontWeight: FONT.bold, fontSize: 13.5 },
  msg: { maxWidth: "88%", padding: 13, paddingHorizontal: 15, borderRadius: 18 },
  me: { alignSelf: "flex-end", backgroundColor: C.selBg, borderBottomRightRadius: 6 },
  bot: { alignSelf: "flex-start", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 6 },
  msgTxt: { color: C.txt, fontSize: 15.5, lineHeight: 23 },
  err: { color: "#ff8aa3", fontSize: 13.5, fontWeight: FONT.semi, lineHeight: 19 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  input: { flex: 1, minHeight: 46, maxHeight: 120, backgroundColor: "#0e0e1a", borderWidth: 2, borderColor: C.border2, borderRadius: 15, color: C.txt, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15.5 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border2, alignItems: "center", justifyContent: "center" },
});
