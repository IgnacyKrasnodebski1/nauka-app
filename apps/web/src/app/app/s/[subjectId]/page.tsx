import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getSessionUser, getSubject, listTopics } from "@/lib/data";
import { slimTopic } from "@/lib/types";
import { SubjectPage } from "@/components/subject/subject-page";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ subjectId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { subjectId } = await params;
  const ctx = await getSessionUser();
  const s = ctx ? await getSubject(ctx.sb, subjectId) : null;
  return { title: s ? `${s.emoji} ${s.name}` : "Przedmiot" };
}

export default async function Page({ params }: Params) {
  const { subjectId } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return null;
  const subject = await getSubject(ctx.sb, subjectId);
  if (!subject) notFound();
  const topics = await listTopics(ctx.sb, { subjectId });
  return (
    <Suspense fallback={null}>
      <SubjectPage subject={subject} topics={topics.map(slimTopic)} />
    </Suspense>
  );
}
