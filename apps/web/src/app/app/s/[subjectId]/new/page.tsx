import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getSessionUser, getSubject } from "@/lib/data";
import { NewTopicFlow } from "@/components/flow/new-topic";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nowy temat" };
type Props = { params: Promise<{ subjectId: string }> };

export default async function NewTopicPage({ params }: Props) {
  const { subjectId } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return null;
  const subject = await getSubject(ctx.sb, subjectId);
  if (!subject) notFound();
  return (
    <Suspense fallback={null}>
      <NewTopicFlow subject={subject} />
    </Suspense>
  );
}
