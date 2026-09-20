import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Loading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/** Landing deep linku `recall://auth/callback` — sesja obsługiwana w AuthProvider (Linking), tu tylko przekierowanie. */
export default function AuthCallback() {
  const router = useRouter();
  const auth = useAuth();
  useEffect(() => {
    if (auth.loading) return;
    const t = setTimeout(() => router.replace("/(tabs)"), auth.user ? 0 : 1500);
    return () => clearTimeout(t);
  }, [auth.loading, auth.user, router]);
  return (
    <Screen>
      <Loading label="loguję…" />
    </Screen>
  );
}
