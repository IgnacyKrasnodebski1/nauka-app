import { Redirect, useLocalSearchParams } from "expo-router";
import React from "react";

/** Stara ścieżka „nowy temat w przedmiocie” → jeden przepływ dodawania (AddSubject 2.0) z prefillem przedmiotu. */
export default function NewTopicRedirect() {
  const { subjectId, mode } = useLocalSearchParams<{ subjectId: string; mode?: string }>();
  return <Redirect href={{ pathname: "/add", params: { subjectId: subjectId ?? "", mode: mode === "prompt" ? "prompt" : "file" } }} />;
}
