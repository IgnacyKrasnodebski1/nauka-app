import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { useFonts } from "expo-font";
import { Stack, useGlobalSearchParams, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GamificationOverlay } from "@/components/GamificationOverlay";
import { Toast } from "@/components/ui";
import { AppProvider, useApp } from "@/lib/app-state";
import { AuthProvider, useAuth } from "@/lib/auth";
import { COLORS, FONT } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Bramka: bez sesji → login; z sesją bez etapu/przedmiotów → onboarding; zalogowany na ekranie logowania → apka. */
function Shell({ fontsReady }: { fontsReady: boolean }) {
  const auth = useAuth();
  const app = useApp();
  const router = useRouter();
  const segments = useSegments();
  const first = segments[0] as string | undefined;
  /** `?preview=1` pozwala obejrzeć onboarding po jego zrobieniu (podgląd / zrzuty) */
  const { preview } = useGlobalSearchParams<{ preview?: string }>();

  useEffect(() => {
    if (auth.loading || !app.ready || !fontsReady) return;
    SplashScreen.hideAsync().catch(() => {});
    const inAuth = first === "(auth)" || first === "auth";
    if (!auth.user) {
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }
    if (first === "(auth)") return router.replace("/(tabs)");
    if (!app.onboarded && !app.offline && first !== "onboarding" && first !== "auth") router.replace("/onboarding");
    if (app.onboarded && first === "onboarding" && !preview) router.replace("/(tabs)");
  }, [auth.loading, auth.user, app.ready, app.onboarded, app.offline, first, router, fontsReady, preview]);

  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: COLORS.bg0 }} />;
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg0 }, animation: "slide_from_right" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen name="onboarding" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="s/[subjectId]/new" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="t/[topicId]/l/[levelId]" options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }} />
      </Stack>
      <Toast text={app.toast} />
      <GamificationOverlay />
    </>
  );
}

export default function RootLayout() {
  // Fonty ładowane pod nazwami z FONT (src/lib/theme.ts); splash trzymany do czasu załadowania.
  const [fontsLoaded, fontError] = useFonts({
    [FONT.display600]: BricolageGrotesque_600SemiBold,
    [FONT.display700]: BricolageGrotesque_700Bold,
    [FONT.display800]: BricolageGrotesque_800ExtraBold,
    [FONT.body400]: Manrope_400Regular,
    [FONT.body500]: Manrope_500Medium,
    [FONT.body600]: Manrope_600SemiBold,
    [FONT.body700]: Manrope_700Bold,
  });
  const fontsReady = fontsLoaded || !!fontError;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.bg0 }}>
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
