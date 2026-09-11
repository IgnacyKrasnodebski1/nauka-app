import type { Topic } from "@nauka/shared";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LevelPath } from "@/components/LevelPath";
import { useApp } from "@/lib/app-state";

export function PathTab({ topic }: { topic: Topic }) {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 + insets.bottom }} showsVerticalScrollIndicator={false}>
      <LevelPath subject={topic} progress={app.progressFor(topic.id)} onOpen={(levelId) => router.push({ pathname: "/t/[topicId]/l/[levelId]", params: { topicId: topic.id, levelId } })} onLocked={() => app.showToast("Najpierw zalicz poprzedni poziom 🔒")} />
    </ScrollView>
  );
}
