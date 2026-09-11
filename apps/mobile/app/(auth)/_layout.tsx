import { Stack } from "expo-router";
import React from "react";
import { COLORS } from "@/lib/theme";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg0 } }} />;
}
