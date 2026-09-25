import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingScreen } from "@/components/screens/onboarding";

export const metadata: Metadata = { title: "Cel dzienny" };
export default function Page() {
  return <Suspense fallback={null}><OnboardingScreen /></Suspense>;
}
