"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { STAGES, type Stage } from "@nauka/shared";
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
      <Onboarding />
    </div>
  );
}

export function Pills({ subjectXp }: { subjectXp?: number }) {
  const { streak, totalXp, ready } = useApp();
  return (
    <div className="pills">
      <div className="streak" title="seria dni">🔥 <span>{ready ? streak : "·"}</span> <small>dni</small></div>
      <div className="streak" title="punkty XP">⚡ <span>{ready ? (subjectXp ?? totalXp) : "·"}</span> <small>xp</small></div>
    </div>
  );
}

export function TopBar({ back, title, subjectXp, right }: { back?: string; title: ReactNode; subjectXp?: number; right?: ReactNode }) {
  return (
    <div className="topbar">
      <div className="flex items-center gap-2 min-w-0">
        {back && (
          <Link href={back} className="backbtn" aria-label="Wstecz">‹</Link>
        )}
        <div className="logo truncate">{title}</div>
      </div>
      {right ?? <Pills subjectXp={subjectXp} />}
    </div>
  );
}

function BottomNav() {
  const path = usePathname();
  if (/^\/app\/s\/[^/]+\/l\//.test(path)) return null; // lesson = full screen
  const items = [
    { href: "/app", ic: "🏠", label: "Start", match: (p: string) => p === "/app" || p.startsWith("/app/s/") },
    { href: "/app/new", ic: "✨", label: "Dodaj", match: (p: string) => p.startsWith("/app/new") },
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

function Onboarding() {
  const { ready, onboarded, stage, setStage, setOnboarded, toast } = useApp();
  if (!ready || onboarded) return null;
  const pick = (s: Stage) => {
    setStage(s);
    setOnboarded();
    toast("Git, lecimy 🚀");
  };
  return (
    <div className="fixed inset-0 z-[75] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="card w-full max-w-md pop">
        <span className="tag">hej 👋</span>
        <h2 id="onb-title" className="text-2xl font-black tracking-tight">Na jakim etapie jesteś?</h2>
        <p className="text-muted text-sm mt-1 mb-4">Dopasujemy język, trudność pytań i siatkę ocen. Zmienisz to potem w koncie.</p>
        <div className="grid grid-cols-2 gap-3">
          {STAGES.map((s) => (
            <button key={s.id} type="button" onClick={() => pick(s.id)} className={cn("card text-left !p-4 hover:border-white/30 transition", stage === s.id && "!border-[var(--accent2)]")}>
              <div className="text-3xl">{s.emoji}</div>
              <div className="font-black mt-1">{s.label}</div>
              <div className="text-muted text-xs">{s.hint}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
