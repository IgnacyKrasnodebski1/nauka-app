import type { Metadata } from "next";
import { LeagueScreen } from "@/components/screens/social";

export const metadata: Metadata = { title: "Liga" };
export default function LeaguePage() {
  return <LeagueScreen />;
}
