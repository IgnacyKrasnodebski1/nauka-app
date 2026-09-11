import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser, getSubject } from "@/lib/data";
import { NewTopic } from "@/components/upload/new-topic";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nowy temat" };
type Props = { params: Promise<{ subjectId: string }>; searchParams: Promise<{ mode?: string }> };

export default async function NewTopicPage({ params, searchParams }: Props) {
  const { subjectId } = await params;
  const { mode } = await searchParams;
  const ctx = await getSessionUser();
  if (!ctx) return null;
  const subject = await getSubject(ctx.sb, subjectId);
  if (!subject) notFound();
  return <NewTopic subject={subject} mode={mode === "prompt" ? "prompt" : "materials"} />;
}
