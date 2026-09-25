import { redirect } from "next/navigation";

/** 1.x „Ranking” → 2.0 Liga. */
export default function LeaderboardPage() {
  redirect("/app/league");
}
