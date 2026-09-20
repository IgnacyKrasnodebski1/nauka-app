import { BlurView } from "expo-blur";
import { Tabs } from "expo-router/js-tabs";
import React, { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Icon, type IoniconName } from "@/components/Icon";
import { useReduceMotion } from "@/lib/motion";
import { COLORS, MOTION, PLAY, body } from "@/lib/theme";

/** Ikona zakładki: spring na skali przy aktywacji + animowany pill pod ikoną (zielony). */
function TabIcon({ name, active, focused }: { name: IoniconName; active: IoniconName; focused: boolean }) {
  const reduce = useReduceMotion();
  const sc = useSharedValue(1);
  const pill = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    if (reduce) {
      pill.set(focused ? 1 : 0);
      return;
    }
    if (focused) sc.set(withSpring(1.18, { damping: 7, stiffness: 320 }, () => sc.set(withSpring(1, MOTION.spring))));
    pill.set(withTiming(focused ? 1 : 0, { duration: 220 }));
  }, [focused, sc, pill, reduce]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  const ps = useAnimatedStyle(() => ({ opacity: pill.value, transform: [{ scaleX: pill.value }] }));
  return (
    <View style={{ alignItems: "center", justifyContent: "center", height: 30 }}>
      <Animated.View style={st}>
        <Icon name={focused ? active : name} size={24} color={focused ? PLAY.green : COLORS.muted} />
      </Animated.View>
      <Animated.View style={[{ position: "absolute", bottom: -6, width: 22, height: 4, borderRadius: 2, backgroundColor: PLAY.green }, ps]} />
    </View>
  );
}

/** Tab bar: szkło + blur, 4 zakładki (Start, Dziś, Ranking, Profil), aktywna zielona. */
function GlassBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(12,13,20,0.78)" }]} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: COLORS.lineStrong }} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PLAY.green,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarBackground: () => <GlassBackground />,
        tabBarStyle: { position: "absolute", backgroundColor: "transparent", borderTopWidth: 0, elevation: 0, height: Platform.OS === "ios" ? 86 : 68, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontFamily: body(700), marginTop: 6 },
        sceneStyle: { backgroundColor: COLORS.bg0 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Start", tabBarIcon: ({ focused }) => <TabIcon name="home-outline" active="home" focused={focused} /> }} />
      <Tabs.Screen name="today" options={{ title: "Dziś", tabBarIcon: ({ focused }) => <TabIcon name="rocket-outline" active="rocket" focused={focused} /> }} />
      <Tabs.Screen name="ranking" options={{ title: "Ranking", tabBarIcon: ({ focused }) => <TabIcon name="trophy-outline" active="trophy" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ focused }) => <TabIcon name="person-outline" active="person" focused={focused} /> }} />
    </Tabs>
  );
}
