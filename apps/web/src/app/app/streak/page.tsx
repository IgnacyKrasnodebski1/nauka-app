import type { Metadata } from "next";
import { StreakScreen } from "@/components/screens/streak";

export const metadata: Metadata = { title: "Seria" };
export default function StreakPage() {
  return <StreakScreen />;
}
