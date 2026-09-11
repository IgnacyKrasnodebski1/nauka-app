"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "@/lib/store/app-context";
import { cn } from "@/lib/utils";

const isFullScreen = (p: string) => /^\/app\/t\/[^/]+\/l\//.test(p) || p === "/app/today";

export function AppChrome({ children }: { children: ReactNode }) {
  const { toasts } = useApp();
  const path = usePathname();
  return (
    <div className={cn("shell", isFullScreen(path) && "no-nav")}>
      {children}
      <div className="toastwrap" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.text}</div>
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
      <div className="card max-w-md w-full">
        <div className="tile neutral mb-4" aria-hidden="true">🔌</div>
        <h2>Brak konfiguracji Supabase</h2>
        <p className="mt-2">Apka wymaga konta, a ta instancja nie ma ustawionych <code>NEXT_PUBLIC_SUPABASE_URL</code> i <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Uzupełnij <code>apps/web/.env.local</code> i uruchom ponownie.</p>
        <Link href="/" className="pill ghost mt-5">Strona główna</Link>
      </div>
    </main>
  );
}

export function Pills({ xp }: { xp?: number }) {
  const { streak, totalXp, ready } = useApp();
  return (
    <div className="pills">
      <div className="streak fire" title="seria dni">🔥 <b>{ready ? streak : "·"}</b> <small>{streak === 1 ? "dzień" : "dni"}</small></div>
      <div className="streak xp" title="punkty XP">⚡ <b>{ready ? (xp ?? totalXp) : "·"}</b> <small>xp</small></div>
    </div>
  );
}

export function TopBar({ back, title, sub, xp, right }: { back?: string; title: ReactNode; sub?: ReactNode; xp?: number; right?: ReactNode }) {
  return (
    <div className="topbar">
      <div className="flex items-center gap-2.5 min-w-0">
        {back && <Link href={back} className="backbtn" aria-label="Wstecz">‹</Link>}
        <div className="min-w-0">
          <div className="logo truncate">{title}</div>
          {sub && <div className="subline truncate mt-0.5">{sub}</div>}
        </div>
      </div>
      {right ?? <Pills xp={xp} />}
    </div>
  );
}

function BottomNav() {
  const path = usePathname();
  if (isFullScreen(path)) return null; // lesson & session = full screen
  const items = [
    { href: "/app", ic: "🏠", label: "Start", match: (p: string) => p === "/app" || p.startsWith("/app/s/") || p.startsWith("/app/t/") },
    { href: "/app/today", ic: "⚡", label: "Dziś", match: (p: string) => p.startsWith("/app/today") },
    { href: "/app/account", ic: "👤", label: "Konto", match: (p: string) => p.startsWith("/app/account") },
  ];
  return (
    <nav className="nav" aria-label="Nawigacja apki">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={cn(it.match(path) && "active")} aria-current={it.match(path) ? "page" : undefined}>
          <span className="ic" aria-hidden="true">{it.ic}</span>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
