import { Stack } from "expo-router";
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

function Shell() {
  const auth = useAuth();
  const app = useApp();
  useEffect(() => {
    if (!auth.loading && app.ready) SplashScreen.hideAsync().catch(() => {});
  }, [auth.loading, app.ready]);
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: "slide_from_right" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="new" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="s/[id]/l/[levelId]" options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }} />
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
