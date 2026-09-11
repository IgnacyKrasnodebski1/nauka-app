import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { getServerSupabase } from "@/lib/supabase/server";
import { AppProvider } from "@/lib/store/app-context";
import { AppChrome, NoConfig } from "@/components/app/chrome";

export const metadata: Metadata = { title: "Apka" };
export const dynamic = "force-dynamic";

/** Everything under /app requires a logged-in user. Without Supabase env we render a clear "not configured" state. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseEnv()) return <NoConfig />;
  const sb = await getServerSupabase();
  const { data } = await sb!.auth.getUser();
  if (!data.user) redirect("/login?next=/app");
  const u = data.user;
  const name = (u.user_metadata?.full_name as string | undefined) || (u.user_metadata?.name as string | undefined) || null;
  return (
    <AppProvider user={{ id: u.id, email: u.email ?? null, name }}>
      <AppChrome>{children}</AppChrome>
    </AppProvider>
  );
}
