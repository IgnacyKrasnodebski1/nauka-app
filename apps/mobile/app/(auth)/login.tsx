import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Muted, PillButton, Screen, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { C, FONT, R } from "@/lib/theme";

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
      else app.showToast("Zalogowano ✅");
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
        return "Wysłane 📩 Sprawdź maila i kliknij link — apka sama się zaloguje.";
      }
      if (password.length < 6) throw new Error("Hasło: min. 6 znaków.");
      if (mode === "password") return void (await auth.signInPassword(email, password));
      const { needsConfirm } = await auth.signUpPassword(email, password);
      return needsConfirm ? "Konto założone 🎉 Potwierdź maila (link w skrzynce) i wróć tu." : undefined;
    });

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[s.wrap, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 48 }}>📚</Text>
          <Text style={s.h1}>
            <Text style={{ color: C.pink }}>NAUKA</Text> — wbijaj
          </Text>
          <Muted>Wrzucasz notatki albo wpisujesz temat — AI robi z tego lekcje jak w Duolingo. Konto jest potrzebne, żeby trzymać Twoje przedmioty i postępy.</Muted>

          {!auth.enabled ? (
            <View style={s.warn}>
              <Text style={s.warnTxt}>Brak konfiguracji Supabase (EXPO_PUBLIC_SUPABASE_URL / ANON_KEY) — logowanie nie zadziała. Uzupełnij .env i zrestartuj.</Text>
            </View>
          ) : null}

          <View style={s.modes}>
            {(
              [
                ["magic", "✨ link na maila"],
                ["password", "🔑 hasło"],
                ["signup", "🆕 rejestracja"],
              ] as [Mode, string][]
            ).map(([m, l]) => (
              <Touch key={m} onPress={() => setMode(m)} style={[s.mode, mode === m && s.modeOn]}>
                <Text style={[s.modeTxt, mode === m && { color: C.txt }]}>{l}</Text>
              </Touch>
            ))}
          </View>

          <TextInput value={email} onChangeText={setEmail} placeholder="twoj@email.pl" placeholderTextColor={C.muted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" style={s.input} editable={!busy && auth.enabled} />
          {mode !== "magic" ? (
            <TextInput value={password} onChangeText={setPassword} placeholder="hasło (min. 6 znaków)" placeholderTextColor={C.muted} secureTextEntry autoComplete={mode === "signup" ? "new-password" : "password"} textContentType={mode === "signup" ? "newPassword" : "password"} style={s.input} editable={!busy && auth.enabled} onSubmitEditing={submit} />
          ) : null}

          {msg ? <Text style={[s.msg, { color: msg.ok ? "#7dffa6" : "#ff8aa3" }]}>{msg.text}</Text> : null}

          <PillButton label={busy ? "chwila…" : mode === "magic" ? "wyślij link ✨" : mode === "password" ? "zaloguj 🔑" : "załóż konto 🆕"} onPress={submit} disabled={busy || !auth.enabled} />
          <PillButton label="Kontynuuj z Google" ghost onPress={() => run(() => auth.signInGoogle())} disabled={busy || !auth.enabled} />
          <Muted style={{ fontSize: 12, textAlign: "center", marginTop: 8 }}>Free: 3 tematy z AI miesięcznie. Bez karty.</Muted>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: 20, gap: 12 },
  h1: { color: C.txt, fontSize: 28, fontWeight: FONT.black, letterSpacing: -0.6 },
  warn: { backgroundColor: "#2a230066", borderLeftWidth: 3, borderLeftColor: C.lime, borderRadius: 12, padding: 12 },
  warnTxt: { color: "#e7e7f4", fontSize: 13.5, lineHeight: 19 },
  modes: { flexDirection: "row", gap: 6, backgroundColor: C.faint, borderRadius: R.pill, padding: 4, marginTop: 6 },
  mode: { flex: 1, paddingVertical: 9, borderRadius: R.pill, alignItems: "center" },
  modeOn: { backgroundColor: C.card2 },
  modeTxt: { color: C.muted, fontWeight: FONT.bold, fontSize: 12.5 },
  input: { backgroundColor: "#0e0e1a", borderWidth: 2, borderColor: C.border2, borderRadius: 15, color: C.txt, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, fontWeight: FONT.semi },
  msg: { fontSize: 14, fontWeight: FONT.semi, lineHeight: 20 },
});
