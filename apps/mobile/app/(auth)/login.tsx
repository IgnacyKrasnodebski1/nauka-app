import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Display, Eyebrow, Muted } from "@/components/Text";
import { Blob, Btn, Input, Note, Screen, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { T } from "@/lib/theme";

type Mode = "magic" | "password" | "signup";

/** Logowanie (marka Recall 2.0): logo, hasło/link/rejestracja, Google. Bez trybu gościa. */
export default function Login() {
  const auth = useAuth();
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMsg(null);
    try {
      const info = await fn();
      if (info) setMsg({ ok: true, text: info });
      else app.showToast("Zalogowano", "check");
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Nie wyszło. Spróbuj jeszcze raz." });
    } finally {
      setBusy(false);
    }
  };
  const validEmail = /\S+@\S+\.\S+/.test(email.trim());
  const submit = () =>
    run(async () => {
      if (!validEmail) throw new Error("Podaj poprawny e-mail.");
      if (mode === "magic") {
        await auth.signInMagicLink(email);
        return "Wysłane. Sprawdź maila i kliknij link — apka sama się zaloguje.";
      }
      if (password.length < 6) throw new Error("Hasło: min. 6 znaków.");
      if (mode === "password") return void (await auth.signInPassword(email, password));
      const { needsConfirm } = await auth.signUpPassword(email, password);
      return needsConfirm ? "Konto założone. Potwierdź maila (link w skrzynce) i wróć tu." : undefined;
    });

  return (
    <Screen pad={false} blob={<><Blob tone="acid" size={300} top={-120} right={-110} /><Blob tone="pink" size={240} bottom={80} left={-110} d={3} /></>}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[s.wrap, { paddingTop: Math.max(insets.top, 14) + 40, paddingBottom: insets.bottom + 26 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Display size={26} ls={-1}>
            RECALL
            <Display size={26} color={T.acid}>
              .
            </Display>
          </Display>
          <Motion kind="up" d={1}>
            <Display size={31} ls={-1.1} lh={34}>
              Ucz się z tego, co masz.
            </Display>
            <Muted size={14} lh={21} style={{ marginTop: 9 }}>
              Zdjęcie strony, notatki albo samo hasło — z tego powstają poziomy, fiszki i pytania. Konto trzyma przedmioty i postępy na każdym urządzeniu.
            </Muted>
          </Motion>
          {!auth.enabled ? <Note tone="gold" icon="alert" text="Brak konfiguracji Supabase (EXPO_PUBLIC_SUPABASE_URL / ANON_KEY). Uzupełnij .env i zrestartuj." /> : null}
          <Motion kind="up" d={2} style={{ flexDirection: "row", gap: 7 }}>
            {(
              [
                ["password", "Hasło"],
                ["magic", "Link na maila"],
                ["signup", "Rejestracja"],
              ] as [Mode, string][]
            ).map(([m, l]) => (
              <Touch key={m} onPress={() => setMode(m)} accessibilityRole="button" accessibilityState={{ selected: mode === m }} style={[s.chip, mode === m && { backgroundColor: T.acid, borderColor: T.acid }]}>
                <Body size={12.5} weight={800} color={mode === m ? T.onAcid : T.muted}>
                  {l}
                </Body>
              </Touch>
            ))}
          </Motion>
          <Motion kind="up" d={3} style={{ gap: 10 }}>
            <Eyebrow>E-mail</Eyebrow>
            <Input value={email} onChangeText={setEmail} placeholder="twoj@email.pl" autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" editable={!busy && auth.enabled} />
            {mode !== "magic" ? (
              <>
                <Eyebrow style={{ marginTop: 4 }}>Hasło</Eyebrow>
                <Input value={password} onChangeText={setPassword} placeholder="min. 6 znaków" secureTextEntry autoComplete={mode === "signup" ? "new-password" : "password"} textContentType={mode === "signup" ? "newPassword" : "password"} editable={!busy && auth.enabled} onSubmitEditing={submit} />
              </>
            ) : null}
          </Motion>
          {msg ? <Note tone={msg.ok ? "acid" : "red"} icon={msg.ok ? "mail" : "alert"} text={msg.text} /> : null}
          <View style={{ gap: 10, marginTop: 4 }}>
            <Btn label={busy ? "Chwila…" : mode === "magic" ? "Wyślij link" : mode === "password" ? "Zaloguj się" : "Załóż konto"} onPress={submit} disabled={busy || !auth.enabled} glow right={<Icon name="chevron-right" size={18} stroke={3} color={T.onAcid} />} />
            <Btn label="Kontynuuj z Google" variant="ghost" onPress={() => run(() => auth.signInGoogle())} disabled={busy || !auth.enabled} left={<Icon name="globe" size={18} color={T.txt2} />} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
            {(
              [
                ["heart", T.red, "życia"],
                ["gem", T.cyan, "gemy"],
                ["flame", T.flame, "seria"],
                ["trophy", T.gold, "liga"],
              ] as [string, string, string][]
            ).map(([ic, c, l]) => (
              <View key={l} style={s.perk}>
                <Icon name={ic} size={13} color={c} />
                <Muted size={10.5} weight={700}>
                  {l}
                </Muted>
              </View>
            ))}
          </View>
          <Muted size={11.5} center>
            Za darmo: 3 tematy z AI miesięcznie. Bez karty.
          </Muted>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: 22, gap: 16 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line },
  perk: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9 },
});
