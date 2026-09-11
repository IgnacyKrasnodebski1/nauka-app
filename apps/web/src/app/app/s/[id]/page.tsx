import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSubject } from "@/lib/subjects";
import { SubjectShell } from "@/components/subject/shell";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const s = await getSubject(id);
  return { title: s ? `${s.emoji} ${s.name}` : "Przedmiot" };
}

export default async function SubjectPage({ params }: Params) {
  const { id } = await params;
  const subject = await getSubject(id);
  if (!subject) notFound();
  return <SubjectShell subject={subject} />;
}
