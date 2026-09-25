import type { Metadata } from "next";
import { getSessionUser, listSubjects } from "@/lib/data";
import { SettingsScreen } from "@/components/screens/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ustawienia" };

export default async function SettingsPage() {
  const ctx = await getSessionUser();
  if (!ctx) return null;
  const subjects = await listSubjects(ctx.sb, ctx.userId);
  return <SettingsScreen subjects={subjects} />;
}
