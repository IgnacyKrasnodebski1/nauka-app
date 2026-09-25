import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getSessionUser, getSubject, getTopic } from "@/lib/data";
import { TopicShell } from "@/components/topic/shell";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ topicId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { topicId } = await params;
  const ctx = await getSessionUser();
  const t = ctx ? await getTopic(ctx.sb, topicId) : null;
  return { title: t ? t.name : "Temat" };
}

export default async function TopicPage({ params }: Params) {
  const { topicId } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return null;
  const topic = await getTopic(ctx.sb, topicId);
  if (!topic) notFound();
  const subject = await getSubject(ctx.sb, topic.subjectId);
  if (!subject) notFound();
  return (
    <Suspense fallback={null}>
      <TopicShell topic={topic} subject={subject} />
    </Suspense>
  );
}
