import { redirect } from "next/navigation";

/** 1.x „Dzisiejsza sesja” → 2.0 Powtórka. */
export default function TodayPage() {
  redirect("/app/review");
}
