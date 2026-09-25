import type { Metadata } from "next";
import { Suspense } from "react";
import { LevelPickScreen } from "@/components/screens/onboarding";

export const metadata: Metadata = { title: "Etap nauki" };
export default function Page() {
  return <Suspense fallback={null}><LevelPickScreen /></Suspense>;
}
