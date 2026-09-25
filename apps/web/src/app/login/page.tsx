import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Logowanie" };
export const dynamic = "force-dynamic";

const PERKS: { ic: string; t: string; cls: string }[] = [
  { ic: "flame", t: "Seria dni i cel dzienny", cls: "amber" },
  { ic: "heart", t: "Serca, combo i gemy", cls: "red" },
  { ic: "star", t: "Misje dnia i odznaki", cls: "gold" },
  { ic: "trophy", t: "Liga tygodnia", cls: "cyan" },
];

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex flex-col land">
      <div className="land-header">
        <div className="land-wrap flex items-center justify-between h-14">
          <Link href="/" aria-label="Recall — strona główna"><Logo size={26} /></Link>
          <Link href="/" className="text-sm font-bold text-muted hover:text-txt">Strona główna</Link>
        </div>
      </div>
      <div className="flex-1 land-wrap w-full grid lg:grid-cols-[1fr_1fr] gap-10 items-center py-8" style={{ position: "relative" }}>
        <div className="blob a-float acid" aria-hidden="true" />
        <div className="hidden lg:flex flex-col items-start gap-6" style={{ position: "relative" }}>
          <span className="tag">Recall 2.0</span>
          <h1 style={{ fontSize: 34 }}>Z notatek do lekcji. Serca, combo, gemy i liga w pakiecie.</h1>
          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
            {PERKS.map((p) => (
              <div key={p.t} className={`ftile ${p.cls}`} style={{ minHeight: 0, flexDirection: "row", alignItems: "center" }}>
                <span className="ic"><Icon name={p.ic} size={20} /></span>
                <span className="font-bold text-[14px] leading-tight">{p.t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="w-full max-w-md mx-auto" style={{ position: "relative" }}>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
