import type { Metadata } from "next";
import { MissionsScreen } from "@/components/screens/missions";

export const metadata: Metadata = { title: "Misje" };
export default function MissionsPage() {
  return <MissionsScreen />;
}
