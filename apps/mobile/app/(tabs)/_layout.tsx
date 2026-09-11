import { BlurView } from "expo-blur";
import { Tabs } from "expo-router/js-tabs";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { COLORS, body } from "@/lib/theme";

function Icon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, lineHeight: 24, color: focused ? COLORS.accent : COLORS.muted, fontFamily: body(700) }}>{glyph}</Text>;
}

/** Tab bar: szkło + blur, aktywna ikona i etykieta złote, etykieta 11px. */
function GlassBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(12,13,20,0.72)" }]} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: COLORS.lineStrong }} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarBackground: () => <GlassBackground />,
        tabBarStyle: { position: "absolute", backgroundColor: "transparent", borderTopWidth: 0, elevation: 0, height: Platform.OS === "ios" ? 84 : 66, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontFamily: body(600), marginTop: 2 },
        sceneStyle: { backgroundColor: COLORS.bg0 },
      }}
    >
      <Tabs.Screen name="today" options={{ title: "Dziś", tabBarIcon: ({ focused }) => <Icon glyph="◆" focused={focused} /> }} />
      <Tabs.Screen name="index" options={{ title: "Przedmioty", tabBarIcon: ({ focused }) => <Icon glyph="▦" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ focused }) => <Icon glyph="●" focused={focused} /> }} />
    </Tabs>
  );
}
