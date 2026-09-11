import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, tutorAsk, type TutorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { hasApi } from "@/lib/env";
import { COLORS, RADIUS, SPACE, body } from "@/lib/theme";
import { Body, Muted, Title } from "./Text";
import { BackButton, Touch } from "./ui";

/** Czat z tutorem AI (POST /api/tutor, streaming gdy RN fetch to umie). */
export function TutorModal({ open, onClose, topicId, levelId, levelTitle }: { open: boolean; onClose: () => void; topicId: string; levelId: string; levelTitle: string }) {
  const auth = useAuth();
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
    if (!token) return setErr("Sesja wygasła — zaloguj się ponownie.");
    setErr(null);
    setInput("");
    const history = msgs;
    setMsgs([...history, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setBusy(true);
    abort.current = new AbortController();
    try {
      await tutorAsk(token, { topicId, levelId, question, history }, (text) => setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: text }]), abort.current.signal);
    } catch (e) {
      const msg = e instanceof ApiError && e.code === "limit_reached" ? "Limit wiadomości na dziś wyczerpany. Pro = bez limitu." : e instanceof Error ? e.message : "Coś się wysypało.";
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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[s.wrap, { paddingTop: Platform.OS === "ios" ? SPACE[3] : insets.top + SPACE[2] }]}>
        <View style={s.head}>
          <BackButton onPress={close} label="✕" />
          <View style={{ flex: 1 }}>
            <Title size="md">Tutor</Title>
            <Muted size="xs" numberOfLines={1}>
              {levelTitle}
            </Muted>
          </View>
        </View>
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={s.list} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
          {msgs.length === 0 ? (
            <View style={{ gap: SPACE[3] }}>
              <View style={s.hello}>
                <View style={s.hl} />
                <Body>Cześć, jestem Twoim tutorem od tego poziomu. Pytaj o cokolwiek — wytłumaczę po ludzku, dam przykład, przepytam.</Body>
              </View>
              {!hasApi ? <Muted color={COLORS.danger}>Brak EXPO_PUBLIC_API_URL — tutor wymaga API weba.</Muted> : null}
              <View style={s.sugg}>
                {["Wytłumacz to jak 12-latkowi", "Daj przykład z życia", "Przepytaj mnie z tego"].map((t) => (
                  <Touch key={t} onPress={() => send(t)} style={s.suggBtn}>
                    <Body size="sm" weight={600} color={COLORS.text}>
                      {t}
                    </Body>
                  </Touch>
                ))}
              </View>
            </View>
          ) : null}
          {msgs.map((m, i) => (
            <View key={i} style={[s.msg, m.role === "user" ? s.me : s.bot]}>
              <Body color={m.role === "user" ? COLORS.accentInk : COLORS.textSoft}>{m.content || (busy ? "…" : "")}</Body>
            </View>
          ))}
          {err ? <Muted color={COLORS.danger}>{err}</Muted> : null}
        </ScrollView>
        <View style={[s.inputRow, { paddingBottom: Math.max(insets.bottom, SPACE[3]) }]}>
          <TextInput value={input} onChangeText={setInput} placeholder="np. czemu to działa tak, a nie inaczej?" placeholderTextColor={COLORS.faint} style={s.input} multiline onSubmitEditing={() => send()} editable={!busy} returnKeyType="send" />
          <Touch onPress={() => send()} disabled={busy || !input.trim()} style={s.sendBtn}>
            <Text style={{ color: COLORS.accentInk, fontFamily: body(700), fontSize: 18, marginTop: -2 }}>↑</Text>
          </Touch>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg0 },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE[3], paddingHorizontal: SPACE[4], paddingVertical: SPACE[3] },
  list: { padding: SPACE[4], gap: SPACE[3], paddingBottom: SPACE[6] },
  hello: { backgroundColor: COLORS.bg2, borderRadius: RADIUS.lg, padding: SPACE[5], borderWidth: 1, borderColor: COLORS.line, overflow: "hidden" },
  hl: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: COLORS.highlight },
  sugg: { gap: SPACE[2] },
  suggBtn: { backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.pill, paddingVertical: 10, paddingHorizontal: 14, alignSelf: "flex-start" },
  msg: { maxWidth: "88%", padding: 13, paddingHorizontal: 15, borderRadius: RADIUS.md },
  me: { alignSelf: "flex-end", backgroundColor: COLORS.accent, borderBottomRightRadius: 6 },
  bot: { alignSelf: "flex-start", backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderBottomLeftRadius: 6 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: SPACE[2], paddingHorizontal: SPACE[4], paddingTop: SPACE[2], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.lineStrong },
  input: { flex: 1, minHeight: 46, maxHeight: 120, backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.md, color: COLORS.text, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: body(500) },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
});
