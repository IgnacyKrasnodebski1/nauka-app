import type { Metadata } from "next";
import { getSessionUser, listSubjects, listTopics } from "@/lib/data";
import { CardsHub } from "@/components/screens/cards-hub";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fiszki" };

export default async function CardsPage() {
  const ctx = await getSessionUser();
  if (!ctx) return null;
  const [subjects, topics] = await Promise.all([listSubjects(ctx.sb, ctx.userId), listTopics(ctx.sb, { userId: ctx.userId })]);
  return <CardsHub subjects={subjects} topics={topics} />;
}
