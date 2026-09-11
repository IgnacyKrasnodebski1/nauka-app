import { useRouter } from "expo-router";
import React from "react";
import { Button, Empty, Screen } from "@/components/ui";

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen style={{ justifyContent: "center" }}>
      <Empty icon="?" title="Nie ma takiej strony" text="Ten link prowadzi donikąd." action={<Button label="Na start" onPress={() => router.replace("/(tabs)")} />} />
    </Screen>
  );
}
