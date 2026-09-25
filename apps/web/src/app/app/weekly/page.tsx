import type { Metadata } from "next";
import { Suspense } from "react";
import { WeeklyScreen } from "@/components/screens/weekly";

export const metadata: Metadata = { title: "Twój tydzień" };
export default function WeeklyPage() {
  return (
    <Suspense fallback={null}>
      <WeeklyScreen />
    </Suspense>
  );
}
