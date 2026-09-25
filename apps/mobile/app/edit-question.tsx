import { type QuizQuestion, type Topic } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Eyebrow } from "@/components/Text";
import { Blob, Btn, Empty, Loading, Note, Press, Screen, TopBar, Touch, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { ovKey, qOf } from "@/lib/extra";
import { KEYS_ABC, noEmoji } from "@/lib/format";
import { T, TONES, body } from "@/lib/theme";
import { topicShort } from "@/lib/topic-view";

/**
 * Popraw pytanie (EditContent.html): treść, odpowiedzi (zaznacz poprawną), wyjaśnienie. Zapis = `overrides["topic:level:qi"]`
 * (nakładane wszędzie przez `qOf`); „Przywróć oryginał” kasuje nadpisanie. Synchronizowane przez `user_meta.overrides`.
 */
export default function EditQuestion() {
  const { topicId, levelId, qi: qiParam } = useLocalSearchParams<{ topicId: string; levelId: string; qi: string }>();
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const qi = Math.max(0, +(qiParam ?? 0) || 0);
  const [topic, setTopic] = useState<Topic | null | undefined>(app.findTopic(topicId ?? ""));
  useEffect(() => {
    let alive = true;
    if (topicId && app.ready && !topic) app.getTopic(topicId).then((t) => alive && setTopic(t));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, app.ready]);
  const level = topic?.levels.find((l) => l.id === levelId);
  const base = level?.quiz[qi];
  const ov = app.extra.overrides[ovKey(topicId ?? "", levelId ?? "", qi)];
  const cur = topic && level && base ? qOf(app.extra.overrides, topic.id, level.id, qi, base) : null;
  const [q, setQ] = useState<string | null>(null);
  const [a, setA] = useState<string[] | null>(null);
  const [c, setC] = useState<number | null>(null);
  const [e, setE] = useState<string | null>(null);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  if (topic === undefined) return <Loading label="wczytuję pytanie…" />;
  if (!topic || !level || !base || !cur)
    return (
      <Screen>
        <Empty icon="alert" title="Nie ma takiego pytania" action={<Btn label="Wróć" onPress={close} />} />
      </Screen>
    );
  const vq = q ?? cur.q,
    va = a ?? cur.a,
    vc = c ?? cur.c,
    ve = e ?? cur.e;
  const subject = app.findSubject(topic.subjectId);
  const save = () => {
    const qq = vq.trim(),
      aa = va.map((x) => x.trim()),
      ee = ve.trim();
    if (!qq || aa.some((x) => !x)) return app.showToast("Uzupełnij pytanie i wszystkie odpowiedzi", "alert");
    const same = qq === base.q && ee === (base.e ?? "") && vc === base.c && aa.every((x, i) => x === base.a[i]);
    const next: QuizQuestion | null = same ? null : { q: qq, a: aa, c: vc, e: ee, src: base.src };
    app.setOverride(topic.id, level.id, qi, next);
    app.showToast(same ? "Bez zmian — oryginał" : "Poprawka zapisana", "check");
    close();
  };
  const reset = () => {
    app.setOverride(topic.id, level.id, qi, null);
    app.showToast("Przywrócono oryginał", "refresh");
    close();
  };
  return (
    <AccentProvider color={subject?.accent2 ?? topic.accent2} seed={subject?.name ?? topic.name}>
      <Screen pad={false} blob={<Blob tone="violet" size={250} top={120} left={-100} />}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={[s.head, { paddingTop: top }]}>
            <TopBar title="Popraw pytanie" sub={`${subject ? noEmoji(subject.name) : topicShort(topic)} · ${noEmoji(level.title)} · pytanie ${qi + 1} z ${level.quiz.length}`} onBack={close} />
          </View>
          <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Motion kind="up">
              <Note tone="gold" icon="alert" blink text={ov && ov !== true ? "To pytanie ma już twoją poprawkę. Zastąpi oryginał w lekcji, quizie, egzaminie i powtórce." : "Wygenerowane z materiałów. Sprawdź, zanim się tego nauczysz."} />
            </Motion>
            <Motion kind="up" d={1}>
              <Eyebrow>Treść pytania</Eyebrow>
              <TextInput value={vq} onChangeText={setQ} multiline style={[s.ta, { fontSize: 14.5, fontFamily: body(700), color: T.txt }]} accessibilityLabel="Treść pytania" />
            </Motion>
            <Motion kind="up" d={2}>
              <Eyebrow>Odpowiedzi — zaznacz poprawną</Eyebrow>
              <View style={{ gap: 9, marginTop: 10 }}>
                {va.map((x, i) => {
                  const on = vc === i;
                  return (
                    <View key={i} style={[s.opt, on && { backgroundColor: TONES.acid.tint, borderColor: T.acid, shadowColor: TONES.acid.tintShadow, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 } }]}>
                      <Touch onPress={() => setC(i)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`Poprawna: ${KEYS_ABC[i]}`} hitSlop={6} style={[s.radio, on && { borderColor: T.acid }]}>
                        {on ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: T.acid }} /> : null}
                      </Touch>
                      <Body size={12} weight={800} color={on ? T.acid : T.muted} style={{ width: 16 }}>
                        {KEYS_ABC[i]}
                      </Body>
                      <TextInput value={x} multiline onChangeText={(v) => setA(va.map((y, k) => (k === i ? v : y)))} style={[s.in, { color: on ? TONES.acid.txt : T.txt2, fontFamily: body(on ? 800 : 700) }]} accessibilityLabel={`Odpowiedź ${KEYS_ABC[i]}`} />
                    </View>
                  );
                })}
              </View>
            </Motion>
            <Motion kind="up" d={3}>
              <Eyebrow>Wyjaśnienie</Eyebrow>
              <TextInput value={ve} onChangeText={setE} multiline style={[s.ta, { fontSize: 13.5, fontFamily: body(600), color: T.txt2 }]} accessibilityLabel="Wyjaśnienie" />
            </Motion>
            {ov && ov !== true ? (
              <Motion kind="up" d={4}>
                <Press onPress={reset} drop={4} edge={T.shadow} radius={16} faceStyle={s.resetBtn} accessibilityLabel="Przywróć oryginał">
                  <Icon name="refresh" size={17} stroke={2.8} color={T.muted} />
                  <Body size={13} weight={800} color={T.muted}>
                    Przywróć oryginał
                  </Body>
                </Press>
              </Motion>
            ) : null}
          </ScrollView>
          <View style={s.foot}>
            <Btn label="Zapisz zmiany" glow onPress={save} />
          </View>
        </KeyboardAvoidingView>
      </Screen>
    </AccentProvider>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: 18 },
  wrap: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 20, gap: 14 },
  ta: { marginTop: 8, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 14, minHeight: 88, textAlignVertical: "top", lineHeight: 20 },
  opt: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 16, paddingVertical: 9, paddingHorizontal: 13 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: T.dash, alignItems: "center", justifyContent: "center" },
  in: { flex: 1, fontSize: 13.5, paddingVertical: 4, padding: 0, lineHeight: 19 },
  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line },
  foot: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 26 },
});
