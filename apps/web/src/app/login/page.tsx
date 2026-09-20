import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icons";
import { Mascot } from "@/components/mascot/mascot";

export const metadata: Metadata = { title: "Logowanie" };
export const dynamic = "force-dynamic";

const PERKS: { ic: "flame" | "heart" | "gem" | "trophy"; t: string; c: string }[] = [
  { ic: "flame", t: "Seria dni i cel dzienny", c: "var(--play-orange)" },
  { ic: "heart", t: "Serca, combo i klejnoty", c: "var(--play-red)" },
  { ic: "gem", t: "Misje dnia i odznaki", c: "var(--play-gem)" },
  { ic: "trophy", t: "Ranking tygodnia", c: "var(--play-yellow)" },
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
      <div className="flex-1 land-wrap w-full grid lg:grid-cols-[1fr_1fr] gap-10 items-center py-8 glow-head">
        <div className="hidden lg:flex flex-col items-start gap-6">
          <Mascot state="happy" size={180} say="Cześć, jestem Rec. Wchodzisz?" />
          <h1 style={{ fontSize: 34 }}>Z notatek do lekcji. Serca, combo, klejnoty i ranking w pakiecie.</h1>
          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
            {PERKS.map((p) => (
              <div key={p.t} className="card3d flex items-center gap-3 !p-3.5">
                <span className="tile sm neutral" style={{ color: p.c }}><Icon name={p.ic} size={20} /></span>
                <span className="font-bold text-txt text-[14px] leading-tight">{p.t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="w-full max-w-md mx-auto">
          <div className="lg:hidden flex justify-center mb-4"><Mascot state="happy" size={110} say="Cześć, jestem Rec!" bubbleSide="top" /></div>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
