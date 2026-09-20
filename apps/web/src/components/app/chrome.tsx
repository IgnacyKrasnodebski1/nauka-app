"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useApp, useAppEvent } from "@/lib/store/app-context";
import { AnimatePresence, m } from "@/lib/motion";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Btn3d } from "@/components/ui/btn3d";
import { Icon, type IconName } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { AchievementToast, LevelUpModal } from "@/components/ui/modals";
import { Gems, Hearts, StreakPill } from "@/components/ui/pills";

const isFullScreen = (p: string) => /^\/app\/t\/[^/]+\/l\//.test(p) || p === "/app/today";

export function AppChrome({ children }: { children: ReactNode }) {
  const { toasts, unlockedQueue, popUnlocked, levelUpQueue, popLevelUp, streak } = useApp();
  const path = usePathname();
  const sfx = useSfx();
  // global sounds for wallet / streak events
  useAppEvent("gem", (e) => e.delta > 0 && sfx.play("gem"));
  useAppEvent("streak", () => sfx.play("streak"));
  useAppEvent("goal", () => sfx.play("levelup"));
  return (
    <div className={cn("shell", isFullScreen(path) && "no-nav")}>
      {children}
      <div className="toastwrap" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <m.div key={t.id} className={cn("toast", t.kind)} initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.95 }}>
              {t.text}
            </m.div>
          ))}
        </AnimatePresence>
      </div>
      <LevelUpModal rank={levelUpQueue[0] ?? null} onClose={popLevelUp} streak={streak} />
      <AchievementToast achievement={levelUpQueue.length ? null : (unlockedQueue[0] ?? null)} onClose={popUnlocked} />
      <BottomNav />
    </div>
  );
}

/** Rendered instead of the app when NEXT_PUBLIC_SUPABASE_* is missing (build/preview without env). */
export function NoConfig() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="card3d max-w-md w-full">
        <Logo size={36} />
        <h2 className="mt-4">Brak konfiguracji Supabase</h2>
        <p className="mt-2">Apka wymaga konta, a ta instancja nie ma ustawionych <code>NEXT_PUBLIC_SUPABASE_URL</code> i <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Uzupełnij <code>apps/web/.env.local</code> i uruchom ponownie.</p>
        <Btn3d variant="ghost" className="mt-5" href="/">Strona główna</Btn3d>
      </div>
    </main>
  );
}

/** Streak + gems + hearts HUD. */
export function Hud({ compact }: { compact?: boolean }) {
  const { streak, gems, hearts, ready } = useApp();
  return (
    <div className="hud">
      <StreakPill days={ready ? streak : 0} />
      <Gems n={ready ? gems : 0} />
      <Hearts view={hearts} compact={compact ?? true} />
    </div>
  );
}

export function TopBar({ back, title, sub, right }: { back?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  const sfx = useSfx();
  return (
    <div className="topbar">
      <div className="flex items-center gap-2.5 min-w-0">
        {back && <Link href={back} className="backbtn" aria-label="Wstecz" onClick={() => sfx.play("tap")}><Icon name="back" size={20} /></Link>}
        <div className="min-w-0">
          <div className="logo truncate">{title}</div>
          {sub && <div className="subline truncate mt-0.5">{sub}</div>}
        </div>
      </div>
      {right ?? <Hud />}
    </div>
  );
}

const NAV: { href: string; ic: IconName; label: string; match: (p: string) => boolean }[] = [
  { href: "/app", ic: "home", label: "Start", match: (p) => p === "/app" || p.startsWith("/app/s/") || p.startsWith("/app/t/") },
  { href: "/app/today", ic: "bolt", label: "Dziś", match: (p) => p.startsWith("/app/today") },
  { href: "/app/leaderboard", ic: "trophy", label: "Ranking", match: (p) => p.startsWith("/app/leaderboard") },
  { href: "/app/account", ic: "user", label: "Konto", match: (p) => p.startsWith("/app/account") },
];

function BottomNav() {
  const path = usePathname();
  const sfx = useSfx();
  useEffect(() => {
    // keep the nav out of the way of iOS overscroll
  }, []);
  if (isFullScreen(path)) return null; // lesson & session = full screen
  return (
    <nav className="nav" aria-label="Nawigacja apki">
      {NAV.map((it) => {
        const active = it.match(path);
        return (
          <Link key={it.href} href={it.href} className={cn(active && "active")} aria-current={active ? "page" : undefined} onClick={() => sfx.play("tap")}>
            {active && <m.span className="navind" layoutId="navind" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
            <Icon name={it.ic} size={24} />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
