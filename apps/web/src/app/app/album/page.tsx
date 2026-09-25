import type { Metadata } from "next";
import { getSessionUser, listSubjects, listTopics } from "@/lib/data";
import { AlbumScreen } from "@/components/screens/album";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Album pojęć" };

export default async function AlbumPage() {
  const ctx = await getSessionUser();
  if (!ctx) return null;
  const [subjects, topics] = await Promise.all([listSubjects(ctx.sb, ctx.userId), listTopics(ctx.sb, { userId: ctx.userId })]);
  return <AlbumScreen subjects={subjects} topics={topics} />;
}
