import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSubject } from "@/lib/subjects";
import { Lesson } from "@/components/lesson/lesson";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; levelId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id, levelId } = await params;
  const s = await getSubject(id);
  const l = s?.levels.find((x) => x.id === levelId);
  return { title: l ? `${l.emoji} ${l.title}` : "Lekcja" };
}

export default async function LessonPage({ params }: Params) {
  const { id, levelId } = await params;
  const subject = await getSubject(id);
  if (!subject) notFound();
  const level = subject.levels.find((l) => l.id === levelId);
  if (!level) notFound();
  return <Lesson subject={subject} levelId={levelId} />;
}
