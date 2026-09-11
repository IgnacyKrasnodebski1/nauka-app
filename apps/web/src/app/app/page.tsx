import { Suspense } from "react";
import { getServerSupabase } from "@/lib/supabase/server";
import { listOwnSubjects, listPublicSubjects } from "@/lib/subjects";
import { Home } from "@/components/app/home";
import type { AppSubject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppHome() {
  const sb = await getServerSupabase();
  let own: AppSubject[] = [];
  let userId: string | null = null;
  if (sb) {
    const { data } = await sb.auth.getUser();
    if (data.user) {
      userId = data.user.id;
      own = await listOwnSubjects(sb, data.user.id);
    }
  }
  const library = await listPublicSubjects(sb);
  return (
    <Suspense fallback={null}>
      <Home own={own} library={library} serverUserId={userId} />
    </Suspense>
  );
}
