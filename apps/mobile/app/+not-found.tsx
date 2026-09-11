import { useRouter } from "expo-router";
import React from "react";
import { Empty, PillButton, Screen } from "@/components/ui";

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <Empty emoji="🧭" title="Nie ma takiej strony" text="Ten link prowadzi donikąd. Wróć na start." action={<PillButton label="na start 🏠" onPress={() => router.replace("/(tabs)")} />} />
    </Screen>
  );
}
