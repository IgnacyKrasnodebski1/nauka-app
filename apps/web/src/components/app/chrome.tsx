"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "@/lib/store/app-context";
import { cn } from "@/lib/utils";

export function AppChrome({ children }: { children: ReactNode }) {
  const { toasts } = useApp();
  return (
    <div className="mx-auto max-w-[560px] min-h-dvh relative pb-24">
      {children}
      <div aria-live="polite" className="contents">
        {toasts.map((t, i) => (
          <div key={t.id} className="toast" style={{ top: 64 + i * 46 }}>{t.text}</div>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}

/** Rendered instead of the app when NEXT_PUBLIC_SUPABASE_* is missing (build/preview without env). */
export function NoConfig() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="result">
        <div className="big">🔌</div>
        <h2>Brak konfiguracji Supabase</h2>
        <p>Apka wymaga konta, a ta instancja nie ma ustawionych <code>NEXT_PUBLIC_SUPABASE_URL</code> i <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Uzupełnij <code>apps/web/.env.local</code> i uruchom ponownie.</p>
        <Link href="/" className="pill sm:w-auto sm:px-8">Strona główna</Link>
      </div>
    </main>
  );
}

export function Pills({ xp }: { xp?: number }) {
  const { streak, totalXp, ready } = useApp();
  return (
    <div className="pills">
      <div className="streak" title="seria dni">🔥 <span>{ready ? streak : "·"}</span> <small>dni</small></div>
      <div className="streak" title="punkty XP">⚡ <span>{ready ? (xp ?? totalXp) : "·"}</span> <small>xp</small></div>
    </div>
  );
}

export function TopBar({ back, title, xp, right }: { back?: string; title: ReactNode; xp?: number; right?: ReactNode }) {
  return (
    <div className="topbar">
      <div className="flex items-center gap-2 min-w-0">
        {back && <Link href={back} className="backbtn" aria-label="Wstecz">‹</Link>}
        <div className="logo truncate">{title}</div>
      </div>
      {right ?? <Pills xp={xp} />}
    </div>
  );
}

function BottomNav() {
  const path = usePathname();
  if (/^\/app\/t\/[^/]+\/l\//.test(path) || path === "/app/today") return null; // lesson & session = full screen
  const items = [
    { href: "/app", ic: "🏠", label: "Start", match: (p: string) => p === "/app" || p.startsWith("/app/s/") || p.startsWith("/app/t/") },
    { href: "/app/today", ic: "⚡", label: "Dziś", match: (p: string) => p.startsWith("/app/today") },
    { href: "/app/account", ic: "👤", label: "Konto", match: (p: string) => p.startsWith("/app/account") },
  ];
  return (
    <nav className="nav mx-auto max-w-[560px]" aria-label="Nawigacja apki">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={cn(it.match(path) && "active")} aria-current={it.match(path) ? "page" : undefined}>
          <span className="ic" aria-hidden="true">{it.ic}</span>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
