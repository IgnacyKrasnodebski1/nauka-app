import { Suspense } from "react";
import { getSessionUser, listSubjects, listTopics } from "@/lib/data";
import { slimTopic } from "@/lib/types";
import { Home } from "@/components/app/home";

export const dynamic = "force-dynamic";

export default async function AppHome() {
  const ctx = await getSessionUser();
  if (!ctx) return null; // layout renders the not-configured / redirect state
  const [subjects, topics] = await Promise.all([listSubjects(ctx.sb, ctx.userId), listTopics(ctx.sb, { userId: ctx.userId })]);
  return (
    <Suspense fallback={null}>
      <Home subjects={subjects} topics={topics.map(slimTopic)} />
    </Suspense>
  );
}
