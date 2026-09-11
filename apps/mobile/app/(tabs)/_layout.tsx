import { Tabs } from "expo-router/js-tabs";
import React from "react";
import { Platform, Text } from "react-native";
import { C, FONT } from "@/lib/theme";

function Icon({ e, focused }: { e: string; focused: boolean }) {
  return <Text style={{ fontSize: 21, opacity: focused ? 1 : 0.55 }}>{e}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.txt,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: "rgba(16,16,28,0.96)", borderTopColor: C.border, height: Platform.OS === "ios" ? 84 : 66, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: FONT.bold },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Nauka", tabBarIcon: ({ focused }) => <Icon e="🏠" focused={focused} /> }} />
      <Tabs.Screen name="library" options={{ title: "Biblioteka", tabBarIcon: ({ focused }) => <Icon e="📚" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ focused }) => <Icon e="👤" focused={focused} /> }} />
    </Tabs>
  );
}
