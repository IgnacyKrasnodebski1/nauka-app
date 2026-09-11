import type { Metadata } from "next";
import { getSessionUser, listTopics } from "@/lib/data";
import { slimTopic } from "@/lib/types";
import { TodaySession } from "@/components/today/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dzisiejsza sesja" };

export default async function TodayPage() {
  const ctx = await getSessionUser();
  if (!ctx) return null;
  const topics = await listTopics(ctx.sb, { userId: ctx.userId });
  return <TodaySession topics={topics.map(slimTopic)} />;
}
