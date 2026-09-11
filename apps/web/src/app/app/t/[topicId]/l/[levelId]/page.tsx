import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser, getSubject, getTopic } from "@/lib/data";
import { Lesson } from "@/components/lesson/lesson";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ topicId: string; levelId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { topicId, levelId } = await params;
  const ctx = await getSessionUser();
  const t = ctx ? await getTopic(ctx.sb, topicId) : null;
  const l = t?.levels.find((x) => x.id === levelId);
  return { title: l ? `${l.emoji} ${l.title}` : "Lekcja" };
}

export default async function LessonPage({ params }: Params) {
  const { topicId, levelId } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return null;
  const topic = await getTopic(ctx.sb, topicId);
  if (!topic || !topic.levels.some((l) => l.id === levelId)) notFound();
  const subject = await getSubject(ctx.sb, topic.subjectId);
  if (!subject) notFound();
  return <Lesson topic={topic} subject={subject} levelId={levelId} />;
}
