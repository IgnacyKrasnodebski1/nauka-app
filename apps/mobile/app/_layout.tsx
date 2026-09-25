import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans";
import { dayDiff, todayStr } from "@nauka/shared";
import { useFonts } from "expo-font";
import { Stack, useGlobalSearchParams, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OfflineBar } from "@/components/OfflineBar";
import { Overlay } from "@/components/Overlay";
import { AppProvider, useApp } from "@/lib/app-state";
import { AuthProvider, useAuth } from "@/lib/auth";
import { KEYS, getJson, setJson } from "@/lib/storage";
import { FONT, T } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Bramka: bez sesji → login; z sesją bez etapu → LevelPick (onboarding); z etapem bez przedmiotów → EmptyState;
 * ≥ 3 dni przerwy → ComeBack (raz dziennie); poniedziałek → podsumowanie tygodnia (raz). `?preview=1` wyłącza przekierowania.
 */
function Shell({ fontsReady }: { fontsReady: boolean }) {
  const auth = useAuth();
  const app = useApp();
  const router = useRouter();
  const segments = useSegments();
  const first = segments[0] as string | undefined;
  const { preview } = useGlobalSearchParams<{ preview?: string }>();
  const shown = useRef(false);

  useEffect(() => {
    if (auth.loading || !app.ready || !fontsReady) return;
    SplashScreen.hideAsync().catch(() => {});
    const inAuth = first === "(auth)" || first === "auth";
    if (!auth.user) {
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }
    if (first === "(auth)") return router.replace("/(tabs)");
    if (preview) return;
    if (!app.stage && !app.offline && first !== "onboarding" && first !== "goal" && first !== "auth") return router.replace("/onboarding");
    if (app.stage && !app.subjects.length && !app.offline && !["onboarding", "goal", "empty", "catalog", "add", "quick-add", "auth"].includes(first ?? "")) return router.replace("/empty");
    if (app.onboarded && !shown.current && app.userId) {
      shown.current = true;
      const gap = app.meta.lastDay ? dayDiff(app.meta.lastDay, todayStr()) : 0;
      const today = todayStr();
      (async () => {
        const cb = await getJson<string | null>(`${KEYS.comebackShown}:${app.userId}`, null);
        if (gap >= 3 && cb !== today) {
          await setJson(`${KEYS.comebackShown}:${app.userId}`, today);
          router.push("/comeback");
          return;
        }
        if (new Date().getDay() === 1) {
          const wk = await getJson<string | null>(`${KEYS.weeklyShown}:${app.userId}`, null);
          if (wk !== today && Object.keys(app.extra.history).length) {
            await setJson(`${KEYS.weeklyShown}:${app.userId}`, today);
            router.push({ pathname: "/weekly", params: { mode: "last" } });
          }
        }
      })();
    }
  }, [auth.loading, auth.user, app.ready, app.onboarded, app.stage, app.subjects.length, app.offline, first, router, fontsReady, preview, app.meta.lastDay, app.userId, app.extra.history]);

  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: T.bg }} />;
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.bg }, animation: "slide_from_right" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen name="onboarding" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="goal" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="empty" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="quick-add" options={{ presentation: "transparentModal", animation: "fade" }} />
        <Stack.Screen name="test-new" options={{ presentation: "transparentModal", animation: "fade" }} />
        <Stack.Screen name="edit-question" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="add" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="t/[topicId]/l/[levelId]" options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="t/[topicId]/boss" options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="exam-run" options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="review-run" options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="cram" options={{ animation: "fade" }} />
        <Stack.Screen name="streak" options={{ animation: "fade" }} />
        <Stack.Screen name="weekly" options={{ animation: "fade" }} />
        <Stack.Screen name="comeback" options={{ animation: "fade" }} />
      </Stack>
      <OfflineBar />
      <Overlay />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [FONT.display700]: BricolageGrotesque_700Bold,
    [FONT.display800]: BricolageGrotesque_800ExtraBold,
    [FONT.body500]: PlusJakartaSans_500Medium,
    [FONT.body600]: PlusJakartaSans_600SemiBold,
    [FONT.body700]: PlusJakartaSans_700Bold,
    [FONT.body800]: PlusJakartaSans_800ExtraBold,
  });
  const fontsReady = fontsLoaded || !!fontError;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: T.bg }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppProvider>
            <StatusBar style="light" />
            <Shell fontsReady={fontsReady} />
          </AppProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
