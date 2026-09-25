import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser, getSubject, getTopic } from "@/lib/data";
import { BossFight } from "@/components/lesson/boss";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Boss rozdziału" };
type Params = { params: Promise<{ topicId: string }> };

export default async function BossPage({ params }: Params) {
  const { topicId } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return null;
  const topic = await getTopic(ctx.sb, topicId);
  if (!topic) notFound();
  const subject = await getSubject(ctx.sb, topic.subjectId);
  if (!subject) notFound();
  return <BossFight topic={topic} subject={subject} />;
}
