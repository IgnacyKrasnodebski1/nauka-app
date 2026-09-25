import type { Metadata } from "next";
import { getSessionUser, listSubjects, listTopics } from "@/lib/data";
import { ComeBackScreen } from "@/components/screens/comeback";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Wracasz" };

export default async function ComeBackPage() {
  const ctx = await getSessionUser();
  if (!ctx) return null;
  const [subjects, topics] = await Promise.all([listSubjects(ctx.sb, ctx.userId), listTopics(ctx.sb, { userId: ctx.userId })]);
  return <ComeBackScreen subjects={subjects} topics={topics} />;
}
