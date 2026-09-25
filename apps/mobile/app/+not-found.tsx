import { useRouter } from "expo-router";
import React from "react";
import { Btn, Empty, Screen } from "@/components/ui";

/** 404 (ErrorState w wersji minimalnej): brak strony → Dziś. */
export default function NotFound() {
  const router = useRouter();
  return (
    <Screen style={{ justifyContent: "center" }}>
      <Empty icon="alert" title="Nie ma takiej strony" text="Ten link prowadzi donikąd." action={<Btn label="Na start" onPress={() => router.replace("/(tabs)")} />} />
    </Screen>
  );
}
