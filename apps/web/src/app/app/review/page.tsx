import type { Metadata } from "next";
import { Suspense } from "react";
import { getSessionUser, listSubjects, listTopics } from "@/lib/data";
import { ReviewScreen } from "@/components/screens/review";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Powtórka" };

export default async function ReviewPage() {
  const ctx = await getSessionUser();
  if (!ctx) return null;
  const [subjects, topics] = await Promise.all([listSubjects(ctx.sb, ctx.userId), listTopics(ctx.sb, { userId: ctx.userId })]);
  return (
    <Suspense fallback={null}>
      <ReviewScreen subjects={subjects} topics={topics} />
    </Suspense>
  );
}
