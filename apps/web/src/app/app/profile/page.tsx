import type { Metadata } from "next";
import { getSessionUser, listSubjects, listTopics } from "@/lib/data";
import { ProfileScreen } from "@/components/screens/profile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const ctx = await getSessionUser();
  if (!ctx) return null;
  const [subjects, topics] = await Promise.all([listSubjects(ctx.sb, ctx.userId), listTopics(ctx.sb, { userId: ctx.userId })]);
  return <ProfileScreen subjects={subjects} topics={topics} />;
}
