import { CURRICULUM, DAILY_GOALS, DAILY_GOAL_LABEL, STAGES, type DailyGoal, type Stage } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button3D } from "@/components/Button3D";
import { Icon } from "@/components/Icon";
import { SegmentedProgress } from "@/components/Lesson";
import { LogoMark } from "@/components/Logo";
import { Mascot, MascotBubble } from "@/components/Mascot";
import { StagePicker, SubjectChips, type SubjectPick } from "@/components/Onboarding";
import { Body, Display, Label, Muted, Num, Title } from "@/components/Text";
import { Input, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { COLORS, PLAY, RADIUS, SPACE } from "@/lib/theme";

type Step = 1 | 2 | 3 | 4;

/** Onboarding 4 kroki z maskotką „Rec”: etap → przedmioty → cel dzienny → start. */
export default function Onboarding() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(app.stage ? 2 : 1);
  const [stage, setStage] = useState<Stage | null>(app.stage);
  const [picked, setPicked] = useState<SubjectPick[]>([]);
  const [goal, setGoal] = useState<DailyGoal>(app.dailyGoal);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (p: SubjectPick) => setPicked((cur) => (cur.some((x) => x.key === p.key) ? cur.filter((x) => x.key !== p.key) : [...cur, p]));
  const addCustom = () => {
    const name = custom.trim();
    if (!name) return;
    const key = `custom:${name.toLowerCase().replace(/\s+/g, "-")}`;
    if (!picked.some((x) => x.key === key)) setPicked([...picked, { key, name, emoji: "📘" }]);
    setCustom("");
  };

  const finish = async () => {
    if (!stage || !picked.length) return;
    setBusy(true);
    setErr(null);
    try {
      app.setStage(stage);
      app.setDailyGoal(goal);
      await app.createSubjects(picked.map((p) => ({ name: p.name, emoji: p.emoji, category: p.key.startsWith("custom:") ? "inne" : p.key, stage })));
      app.showToast("Przedmioty gotowe");
      router.replace("/(tabs)");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Nie udało się zapisać przedmiotów.");
    } finally {
      setBusy(false);
    }
  };

  const bubble: Record<Step, string> = {
    1: "Cześć, jestem Rec! Powiedz mi, na jakim jesteś etapie.",
    2: "Z czego się uczysz? Do każdego przedmiotu dodasz tematy ze zdjęć albo z hasła.",
    3: "Ile chcesz robić dziennie? Cel = ring na Start i bonus XP.",
    4: "Gotowe! Pierwsza lekcja to 10 minut. Lecimy?",
  };
  const mascotState = step === 4 ? "cheer" : step === 3 ? "think" : step === 2 ? "happy" : "idle";

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
      <ScrollView contentContainerStyle={[s.wrap, { paddingTop: insets.top + SPACE[4], paddingBottom: insets.bottom + SPACE[6] }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          {step > 1 ? (
            <Touch onPress={() => setStep((step - 1) as Step)} style={s.back} accessibilityLabel="Wstecz">
              <Icon name="chevron-back" size={22} color={COLORS.text} />
            </Touch>
          ) : (
            <LogoMark size={38} />
          )}
          <SegmentedProgress done={step} total={4} color={PLAY.green} style={{ flex: 1 }} />
          <Muted size="xs" weight={700}>
            {step}/4
          </Muted>
        </View>

        <View style={s.hero}>
          <Mascot state={mascotState} size={110} streak={0} />
          <MascotBubble text={bubble[step]} tail="left" style={{ flex: 1, maxWidth: undefined }} />
        </View>

        {step === 1 ? (
          <Animated.View key="s1" entering={FadeInRight.duration(240)} style={s.stepBox}>
            <Label>krok 1 · etap</Label>
            <Display size="2xl" weight={800}>
              Na jakim etapie jesteś?
            </Display>
            <Body color={COLORS.muted}>Dopasujemy przedmioty, poziom trudności i siatkę ocen. Zmienisz to potem w profilu.</Body>
            <StagePicker value={stage} onChange={setStage} />
            <Button3D label="Dalej" disabled={!stage} onPress={() => setStep(2)} style={{ marginTop: SPACE[2] }} right={<Icon name="arrow-forward" size={18} color="#fff" />} />
          </Animated.View>
        ) : null}

        {step === 2 && stage ? (
          <Animated.View key="s2" entering={FadeInRight.duration(240)} style={s.stepBox}>
            <Label>krok 2 · przedmioty</Label>
            <Display size="2xl" weight={800}>
              Z czego się uczysz?
            </Display>
            <SubjectChips stage={stage} selected={picked.map((p) => p.key)} onToggle={toggle} />
            <View style={s.customRow}>
              <Input value={custom} onChangeText={setCustom} placeholder="Własny przedmiot, np. Łacina" onSubmitEditing={addCustom} returnKeyType="done" style={{ flex: 1 }} />
              <Button3D label="Dodaj" size="sm" variant="blue" onPress={addCustom} disabled={!custom.trim()} style={{ width: 84, alignSelf: "center" }} />
            </View>
            {picked.filter((p) => p.key.startsWith("custom:")).length ? <Muted size="xs">własne: {picked.filter((p) => p.key.startsWith("custom:")).map((p) => p.name).join(", ")}</Muted> : null}
            <Button3D label={picked.length ? `Dalej · ${picked.length}` : "Wybierz min. 1 przedmiot"} disabled={!picked.length} onPress={() => setStep(3)} style={{ marginTop: SPACE[2] }} right={<Icon name="arrow-forward" size={18} color="#fff" />} />
            <Muted size="xs" center>
              {CURRICULUM[stage].length} propozycji z podstawy programowej · kolejne dodasz później
            </Muted>
          </Animated.View>
        ) : null}

        {step === 3 ? (
          <Animated.View key="s3" entering={FadeInRight.duration(240)} style={s.stepBox}>
            <Label>krok 3 · cel dzienny</Label>
            <Display size="2xl" weight={800}>
              Ile dziennie?
            </Display>
            <Body color={COLORS.muted}>Jedna lekcja to ok. 30–50 XP. Cel możesz zmienić w profilu.</Body>
            <View style={{ gap: SPACE[2] }}>
              {DAILY_GOALS.map((g) => {
                const on = goal === g;
                const minutes = g === 20 ? "~5 min" : g === 50 ? "~10 min" : "~20 min";
                return (
                  <Touch key={g} onPress={() => setGoal(g)} style={[s.goal, on && { backgroundColor: PLAY.greenSoft, borderColor: PLAY.green, borderBottomColor: PLAY.greenDeep }]}>
                    <Num size="xl" weight={800} color={on ? PLAY.green : COLORS.text} style={{ width: 64 }}>
                      {g}
                    </Num>
                    <View style={{ flex: 1 }}>
                      <Title size="base">{DAILY_GOAL_LABEL[g]}</Title>
                      <Muted size="xs">
                        {g} XP dziennie · {minutes}
                      </Muted>
                    </View>
                    {on ? <Icon name="checkmark-circle" size={22} color={PLAY.green} /> : <Icon name="ellipse-outline" size={22} color={COLORS.faint} />}
                  </Touch>
                );
              })}
            </View>
            <Button3D label="Dalej" onPress={() => setStep(4)} style={{ marginTop: SPACE[2] }} right={<Icon name="arrow-forward" size={18} color="#fff" />} />
          </Animated.View>
        ) : null}

        {step === 4 && stage ? (
          <Animated.View key="s4" entering={FadeInRight.duration(240)} style={s.stepBox}>
            <Label>krok 4 · start</Label>
            <Display size="2xl" weight={800}>
              Twój plan
            </Display>
            <View style={s.summary}>
              <Row icon="school" label="Etap" value={STAGES.find((x) => x.id === stage)?.label ?? ""} />
              <Row icon="library" label="Przedmioty" value={picked.map((p) => p.name).join(", ")} />
              <Row icon="flag" label="Cel dzienny" value={`${goal} XP · ${DAILY_GOAL_LABEL[goal]}`} />
              <Row icon="heart" label="Serca" value="5 na start, +1 co 30 min" />
              <Row icon="diamond" label="Klejnoty" value="za poziomy, skrzynki i misje" />
            </View>
            {err ? (
              <Body size="sm" color={COLORS.danger}>
                {err}
              </Body>
            ) : null}
            <Button3D label={busy ? "Zapisuję…" : "Zaczynamy!"} disabled={busy} onPress={finish} size="lg" style={{ marginTop: SPACE[2] }} right={<Icon name="rocket" size={18} color="#fff" />} />
          </Animated.View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({ icon, label, value }: { icon: React.ComponentProps<typeof Icon>["name"]; label: string; value: string }) {
  return (
    <View style={s.srow}>
      <View style={s.sicon}>
        <Icon name={icon} size={16} color={PLAY.green} />
      </View>
      <Muted size="xs" weight={700} style={{ width: 86 }}>
        {label}
      </Muted>
      <Body weight={600} color={COLORS.text} style={{ flex: 1 }} numberOfLines={2}>
        {value}
      </Body>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: SPACE[5], gap: SPACE[4] },
  top: { flexDirection: "row", alignItems: "center", gap: SPACE[3] },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center" },
  hero: { flexDirection: "row", alignItems: "center", gap: SPACE[3] },
  stepBox: { gap: SPACE[3] },
  customRow: { flexDirection: "row", gap: SPACE[2], alignItems: "center" },
  goal: { flexDirection: "row", alignItems: "center", gap: SPACE[3], padding: SPACE[3], paddingHorizontal: SPACE[4], borderRadius: RADIUS.md, backgroundColor: COLORS.bg2, borderWidth: 1.5, borderColor: COLORS.line, borderBottomWidth: 4, borderBottomColor: PLAY.surfaceDeep },
  summary: { backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.lg, padding: SPACE[4], gap: SPACE[3] },
  srow: { flexDirection: "row", alignItems: "center", gap: SPACE[2] },
  sicon: { width: 30, height: 30, borderRadius: 9, backgroundColor: PLAY.greenSoft, alignItems: "center", justifyContent: "center" },
});
