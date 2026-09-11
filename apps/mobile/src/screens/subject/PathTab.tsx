import { useRouter } from "expo-router";
import React from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LevelPath } from "@/components/LevelPath";
import { useApp } from "@/lib/app-state";
import type { AppSubject } from "@/lib/subjects";

export function PathTab({ subject }: { subject: AppSubject }) {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = app.progressFor(subject);
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 + insets.bottom }} showsVerticalScrollIndicator={false}>
      <LevelPath
        subject={subject}
        progress={p}
        onOpen={(levelId) => router.push({ pathname: "/s/[id]/l/[levelId]", params: { id: subject.slug && !subject.ownerId ? subject.slug : subject.id, levelId } })}
        onLocked={() => app.showToast("Najpierw zalicz poprzedni poziom 🔒")}
      />
    </ScrollView>
  );
}
