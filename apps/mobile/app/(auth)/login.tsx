import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glow } from "@/components/Accent";
import { Body, Display, Label, Muted } from "@/components/Text";
import { Button, Input, Screen, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { COLORS, RADIUS, SPACE, body } from "@/lib/theme";

type Mode = "magic" | "password" | "signup";

/** Logowanie wymagane — brak trybu gościa. Po sesji bramka w _layout przenosi do apki / onboardingu. */
export default function Login() {
  const auth = useAuth();
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("magic");
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
      else app.showToast("Zalogowano");
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
    <Screen padded={false}>
      <Glow color={COLORS.accent} size={420} alpha={0.12} style={{ top: -180, alignSelf: "center" }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[s.wrap, { paddingTop: insets.top + SPACE[12], paddingBottom: insets.bottom + SPACE[6] }]} keyboardShouldPersistTaps="handled">
          <View style={s.logo}>
            <View style={s.logoMark} />
            <Display size="md" weight={800} style={{ letterSpacing: 2 }}>
              NAUKA
            </Display>
          </View>
          <Display size="3xl" weight={700}>
            Ucz się z tego, co masz.
          </Display>
          <Body color={COLORS.muted}>Notatki, zdjęcia albo samo hasło — AI składa z tego lekcje jak w Duolingo. Konto trzyma Twoje przedmioty i postępy.</Body>

          {!auth.enabled ? (
            <View style={s.warn}>
              <Body size="sm" color={COLORS.accent}>
                Brak konfiguracji Supabase (EXPO_PUBLIC_SUPABASE_URL / ANON_KEY). Uzupełnij .env i zrestartuj.
              </Body>
            </View>
          ) : null}

          <View style={s.modes}>
            {(
              [
                ["magic", "Link na maila"],
                ["password", "Hasło"],
                ["signup", "Rejestracja"],
              ] as [Mode, string][]
            ).map(([m, l]) => (
              <Touch key={m} onPress={() => setMode(m)} style={[s.mode, mode === m && s.modeOn]}>
                <Body size="sm" weight={600} color={mode === m ? COLORS.text : COLORS.muted}>
                  {l}
                </Body>
              </Touch>
            ))}
          </View>

          <View style={{ gap: SPACE[2] }}>
            <Label>e-mail</Label>
            <Input value={email} onChangeText={setEmail} placeholder="twoj@email.pl" autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" editable={!busy && auth.enabled} />
            {mode !== "magic" ? (
              <>
                <Label style={{ marginTop: SPACE[2] }}>hasło</Label>
                <Input value={password} onChangeText={setPassword} placeholder="min. 6 znaków" secureTextEntry autoComplete={mode === "signup" ? "new-password" : "password"} textContentType={mode === "signup" ? "newPassword" : "password"} editable={!busy && auth.enabled} onSubmitEditing={submit} />
              </>
            ) : null}
          </View>

          {msg ? (
            <Body size="sm" weight={600} color={msg.ok ? COLORS.success : COLORS.danger}>
              {msg.text}
            </Body>
          ) : null}

          <View style={{ gap: SPACE[2], marginTop: SPACE[2] }}>
            <Button label={busy ? "Chwila…" : mode === "magic" ? "Wyślij link" : mode === "password" ? "Zaloguj się" : "Załóż konto"} onPress={submit} disabled={busy || !auth.enabled} />
            <Button label="Kontynuuj z Google" variant="secondary" onPress={() => run(() => auth.signInGoogle())} disabled={busy || !auth.enabled} />
          </View>
          <Muted size="xs" center style={{ marginTop: SPACE[2] }}>
            Free: 3 tematy z AI miesięcznie. Bez karty.
          </Muted>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: SPACE[6], gap: SPACE[4] },
  logo: { flexDirection: "row", alignItems: "center", gap: SPACE[2], marginBottom: SPACE[2] },
  logoMark: { width: 12, height: 12, borderRadius: 4, backgroundColor: COLORS.accent },
  warn: { backgroundColor: "rgba(242,193,78,0.10)", borderWidth: 1, borderColor: COLORS.accentGlow, borderRadius: RADIUS.sm, padding: SPACE[3] },
  modes: { flexDirection: "row", gap: 4, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.pill, padding: 4 },
  mode: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.pill, alignItems: "center" },
  modeOn: { backgroundColor: COLORS.bg4 },
  _f: { fontFamily: body(500) },
});
