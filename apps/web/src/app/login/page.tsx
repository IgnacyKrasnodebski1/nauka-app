import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Logowanie" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex flex-col">
      <div className="topbar mx-auto w-full max-w-md">
        <Link href="/" className="logo">📚 <span className="g">NAUKA</span></Link>
        <Link href="/" className="text-sm font-bold text-muted">← strona główna</Link>
      </div>
      <div className="flex-1 flex items-start sm:items-center justify-center px-4 py-6">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
