import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser, getSubject, listTopics } from "@/lib/data";
import { SubjectScreen } from "@/components/screens/subject";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ subjectId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { subjectId } = await params;
  const ctx = await getSessionUser();
  const s = ctx ? await getSubject(ctx.sb, subjectId) : null;
  return { title: s ? s.name : "Przedmiot" };
}

export default async function Page({ params }: Params) {
  const { subjectId } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return null;
  const subject = await getSubject(ctx.sb, subjectId);
  if (!subject) notFound();
  const topics = await listTopics(ctx.sb, { subjectId });
  return <SubjectScreen subject={subject} topics={topics} />;
}
