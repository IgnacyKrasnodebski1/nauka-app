import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toast } from "@/components/ui";
import { AppProvider, useApp } from "@/lib/app-state";
import { AuthProvider, useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Bramka: bez sesji → login; z sesją bez etapu/przedmiotów → onboarding; zalogowany na ekranie logowania → apka. */
function Shell() {
  const auth = useAuth();
  const app = useApp();
  const router = useRouter();
  const segments = useSegments();
  const first = segments[0] as string | undefined;

  useEffect(() => {
    if (auth.loading || !app.ready) return;
    SplashScreen.hideAsync().catch(() => {});
    const inAuth = first === "(auth)" || first === "auth";
    if (!auth.user) {
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }
    if (first === "(auth)") return router.replace("/(tabs)");
    if (!app.onboarded && !app.offline && first !== "onboarding" && first !== "auth") router.replace("/onboarding");
    if (app.onboarded && first === "onboarding") router.replace("/(tabs)");
  }, [auth.loading, auth.user, app.ready, app.onboarded, app.offline, first, router]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: "slide_from_right" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen name="onboarding" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="s/[subjectId]/new" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="t/[topicId]/l/[levelId]" options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }} />
      </Stack>
      <Toast text={app.toast} />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppProvider>
            <StatusBar style="light" />
            <Shell />
          </AppProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
