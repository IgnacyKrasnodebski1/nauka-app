import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/lib/app-state";
import { T, TONES } from "@/lib/theme";
import { Icon } from "./Icon";
import { Motion } from "./Motion";
import { Body } from "./Text";

/** Pasek „Brak połączenia” (ErrorState.html, legacy `netbar`) nad aplikacją, gdy dane przyszły z cache. */
export function OfflineBar() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  if (!app.offline) return null;
  return (
    <Motion kind="blink" style={{ position: "absolute", left: 0, right: 0, top: 0, zIndex: 90 }}>
      <View style={{ backgroundColor: TONES.gold.tint, borderBottomWidth: 2, borderBottomColor: TONES.gold.tintLine, paddingTop: insets.top + 6, paddingBottom: 8, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 9 }}>
        <Icon name="wifi" size={16} color={T.gold} />
        <Body size={12.5} weight={800} color={TONES.gold.txt}>
          Brak połączenia — wznowię, gdy wróci
        </Body>
      </View>
    </Motion>
  );
}
