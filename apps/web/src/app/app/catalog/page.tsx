import type { Metadata } from "next";
import { Suspense } from "react";
import { getSessionUser, listSubjects, listTopics } from "@/lib/data";
import { CatalogScreen } from "@/components/screens/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Odkrywaj" };

export default async function CatalogPage() {
  const ctx = await getSessionUser();
  if (!ctx) return null;
  const [subjects, topics] = await Promise.all([listSubjects(ctx.sb, ctx.userId), listTopics(ctx.sb, { userId: ctx.userId })]);
  return (
    <Suspense fallback={null}>
      <CatalogScreen subjects={subjects} topics={topics} />
    </Suspense>
  );
}
