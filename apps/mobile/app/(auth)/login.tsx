import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glow } from "@/components/Accent";
import { Button3D } from "@/components/Button3D";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { Mascot, MascotBubble } from "@/components/Mascot";
import { Body, Display, Label, Muted } from "@/components/Text";
import { Input, Screen, Touch } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { COLORS, PLAY, RADIUS, SPACE } from "@/lib/theme";

type Mode = "magic" | "password" | "signup";

/** Logowanie wymagane — brak trybu gościa. Logo + maskotka z dymkiem + przyciski 3D. */
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

  const bubble = msg ? (msg.ok ? "Sprawdź skrzynkę!" : "Hmm, coś nie zagrało.") : mode === "signup" ? "Nowe konto = nowa seria. Zaczynamy?" : "Cześć! Jestem Rec. Zaloguj się i lecimy.";

  return (
    <Screen padded={false}>
      <Glow color={PLAY.purple} size={460} alpha={0.14} style={{ top: -200, alignSelf: "center" }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[s.wrap, { paddingTop: insets.top + SPACE[6], paddingBottom: insets.bottom + SPACE[6] }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(300)} style={s.head}>
            <Logo size={40} />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(60).duration(300)} style={s.hero}>
            <Mascot state={msg && !msg.ok ? "sad" : msg?.ok ? "cheer" : "happy"} size={120} streak={3} />
            <View style={{ flex: 1, gap: SPACE[2] }}>
              <MascotBubble text={bubble} tail="left" style={{ maxWidth: undefined }} />
              <View style={s.perks}>
                <Perk icon="heart" color={PLAY.red} label="serca" />
                <Perk icon="diamond" color={PLAY.gem} label="klejnoty" />
                <Perk icon="flame" color={PLAY.orange} label="seria" />
                <Perk icon="trophy" color={PLAY.yellow} label="ranking" />
              </View>
            </View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(120).duration(300)}>
            <Display size="2xl" weight={800}>
              Ucz się z tego, co masz.
            </Display>
            <Body color={COLORS.muted} style={{ marginTop: 4 }}>
              Notatki, zdjęcia albo samo hasło — AI składa z tego lekcje jak w Duolingo. Konto trzyma Twoje przedmioty i postępy.
            </Body>
          </Animated.View>

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
                <Body size="sm" weight={700} color={mode === m ? "#fff" : COLORS.muted}>
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

          <View style={{ gap: SPACE[3], marginTop: SPACE[1] }}>
            <Button3D label={busy ? "Chwila…" : mode === "magic" ? "Wyślij link" : mode === "password" ? "Zaloguj się" : "Załóż konto"} onPress={submit} disabled={busy || !auth.enabled} right={<Icon name="arrow-forward" size={18} color="#fff" />} />
            <Button3D label="Kontynuuj z Google" variant="ghost" onPress={() => run(() => auth.signInGoogle())} disabled={busy || !auth.enabled} left={<Icon name="logo-google" size={18} color={COLORS.textSoft} />} />
          </View>
          <Muted size="xs" center style={{ marginTop: SPACE[2] }}>
            Free: 3 tematy z AI miesięcznie. Bez karty.
          </Muted>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Perk({ icon, color, label }: { icon: React.ComponentProps<typeof Icon>["name"]; color: string; label: string }) {
  return (
    <View style={s.perk}>
      <Icon name={icon} size={13} color={color} />
      <Muted size="xs" weight={700} style={{ fontSize: 10 }}>
        {label}
      </Muted>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: SPACE[5], gap: SPACE[4] },
  head: { flexDirection: "row", alignItems: "center" },
  hero: { flexDirection: "row", alignItems: "center", gap: SPACE[3] },
  perks: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  perk: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.pill, paddingVertical: 4, paddingHorizontal: 8 },
  warn: { backgroundColor: "rgba(242,193,78,0.10)", borderWidth: 1, borderColor: COLORS.accentGlow, borderRadius: RADIUS.sm, padding: SPACE[3] },
  modes: { flexDirection: "row", gap: 4, backgroundColor: COLORS.bg2, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.md, padding: 4 },
  mode: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  modeOn: { backgroundColor: PLAY.green, borderBottomColor: PLAY.greenDeep },
});
