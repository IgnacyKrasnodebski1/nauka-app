import type { Metadata } from "next";
import { LeaderboardPage } from "@/components/leaderboard/leaderboard-page";

export const metadata: Metadata = { title: "Ranking" };

export default function Page() {
  return <LeaderboardPage />;
}
