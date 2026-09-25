import { Tabs } from "expo-router/js-tabs";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body } from "@/components/Text";
import { haptic } from "@/lib/haptic";
import { play } from "@/lib/sfx";
import { T } from "@/lib/theme";

const TABS: { name: string; icon: IconName; label: string }[] = [
  { name: "index", icon: "home", label: "Dziś" },
  { name: "review", icon: "refresh", label: "Powtórka" },
  { name: "cards", icon: "cards", label: "Fiszki" },
  { name: "profile", icon: "user", label: "Profil" },
];

/** Dolna nawigacja (Main.html): Dziś · Powtórka · [+] · Fiszki · Profil; plus 62 px uniesiony, limonkowy, pulsujący. */
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];
function NavBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const active = state.routes[state.index]?.name;
  const tab = (t: (typeof TABS)[number]) => {
    const on = active === t.name;
    const route = state.routes.find((r) => r.name === t.name);
    return (
      <Pressable
        key={t.name}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={t.label}
        onPress={() => {
          if (!route) return;
          const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!on && !ev.defaultPrevented) navigation.navigate(t.name as never);
        }}
        style={s.tab}
      >
        <Icon name={t.icon} size={24} stroke={2.4} color={on ? T.acid : T.muted2} />
        <Body size={10.5} weight={800} color={on ? T.acid : T.muted2}>
          {t.label}
        </Body>
      </Pressable>
    );
  };
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 22) }]}>
      {tab(TABS[0]!)}
      {tab(TABS[1]!)}
      <Motion kind="pulse">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dodaj materiał"
          onPress={() => {
            haptic.tap();
            play("tap");
            router.push("/quick-add");
          }}
          style={({ pressed }) => [s.plus, pressed && { transform: [{ translateY: 5 }], shadowOffset: { width: 0, height: 0 } }]}
        >
          <Icon name="plus" size={30} stroke={3.2} color={T.onAcid} />
        </Pressable>
      </Motion>
      {tab(TABS[2]!)}
      {tab(TABS[3]!)}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: T.bg } }} tabBar={(props) => <NavBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "Dziś" }} />
      <Tabs.Screen name="review" options={{ title: "Powtórka" }} />
      <Tabs.Screen name="cards" options={{ title: "Fiszki" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: T.surface2, borderTopWidth: 2, borderTopColor: T.line, paddingTop: 10, paddingHorizontal: 8 },
  tab: { alignItems: "center", gap: 4, width: 60, minHeight: 44, justifyContent: "center" },
  plus: { width: 62, height: 62, marginTop: -34, borderRadius: 22, backgroundColor: T.acid, alignItems: "center", justifyContent: "center", shadowColor: T.acidDark, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
});
