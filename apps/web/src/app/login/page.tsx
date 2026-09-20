import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Logowanie" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex flex-col">
      <div className="land-header">
        <div className="land-wrap flex items-center justify-between h-14">
          <Link href="/" className="logo">Recall</Link>
          <Link href="/" className="text-sm font-semibold text-muted hover:text-txt">Strona główna</Link>
        </div>
      </div>
      <div className="flex-1 flex items-start sm:items-center justify-center px-4 py-8 glow-head glow-gold">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
