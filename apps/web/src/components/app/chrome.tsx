"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { HEARTS_MAX } from "@nauka/shared";
import { useApp, useAppEvent } from "@/lib/store/app-context";
import { useSfx } from "@/lib/sfx";
import { etaText, fmtNum } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { QuickAddSheet } from "@/components/sheets/quick-add";
import { TestPlanSheet } from "@/components/sheets/test-plan";

/* ---------------- UI context: global sheets (QuickAdd from every screen — design/DESIGN.md §0) ---------------- */
type SheetState = ({ kind: "quickadd" } | { kind: "test"; subjectId?: string | null }) & { path: string };
interface Ui {
  sheet: SheetState | null;
  openQuickAdd(): void;
  openTestSheet(subjectId?: string | null): void;
  closeSheet(): void;
}
const UiCtx = createContext<Ui | null>(null);
export function useUi(): Ui {
  const v = useContext(UiCtx);
  if (!v) throw new Error("useUi outside AppChrome");
  return v;
}

const isFull = (p: string) => /^\/app\/t\/[^/]+\/(l\/|boss)/.test(p) || /^\/app\/(levelpick|onboarding|streak|comeback|weekly|cram|generating)/.test(p);
const NAV: { key: string; href: string; ic: string; label: string; match: (p: string) => boolean }[] = [
  { key: "today", href: "/app", ic: "home", label: "Dziś", match: (p) => p === "/app" || p.startsWith("/app/s/") || p.startsWith("/app/t/") || p.startsWith("/app/missions") || p.startsWith("/app/shop") || p.startsWith("/app/testplan") || p.startsWith("/app/catalog") },
  { key: "review", href: "/app/review", ic: "refresh", label: "Powtórka", match: (p) => p.startsWith("/app/review") },
  { key: "cards", href: "/app/cards", ic: "cards", label: "Fiszki", match: (p) => p.startsWith("/app/cards") },
  { key: "profile", href: "/app/profile", ic: "user", label: "Profil", match: (p) => p.startsWith("/app/profile") || p.startsWith("/app/settings") || p.startsWith("/app/album") || p.startsWith("/app/league") || p.startsWith("/app/friends") },
];

export function AppChrome({ children }: { children: ReactNode }) {
  const [stored, setSheet] = useState<SheetState | null>(null);
  const path = usePathname();
  const sfx = useSfx();
  useAppEvent("gem", (e) => e.delta > 0 && sfx.play("gem"));
  useAppEvent("streak", () => sfx.play("streak"));
  useAppEvent("goal", () => sfx.play("levelup"));
  // a sheet belongs to the route it was opened on — navigating away closes it
  const sheet = stored && stored.path === path ? stored : null;
  const ui = useMemo<Ui>(() => ({ sheet, openQuickAdd: () => setSheet({ kind: "quickadd", path }), openTestSheet: (subjectId) => setSheet({ kind: "test", subjectId, path }), closeSheet: () => setSheet(null) }), [sheet, path]);
  return (
    <UiCtx.Provider value={ui}>
      <div id="app">
        {children}
        <ToastView />
        <AchievementToasts />
        <NetBar />
        {sheet?.kind === "quickadd" && <QuickAddSheet />}
        {sheet?.kind === "test" && <TestPlanSheet subjectId={sheet.subjectId ?? null} />}
      </div>
    </UiCtx.Provider>
  );
}

/** Rendered instead of the app when NEXT_PUBLIC_SUPABASE_* is missing (build/preview without env). */
export function NoConfig() {
  return (
    <div id="app">
      <div className="screen active">
        <div className="scroll errv">
          <div className="errart"><div className="errico a-shake"><Icon name="wifi" size={44} stroke={2.4} /><b>!</b></div></div>
          <div className="errtxt">
            <h1 className="a-up d1">Brak konfiguracji Supabase</h1>
            <p>Apka wymaga konta, a ta instancja nie ma ustawionych <b>NEXT_PUBLIC_SUPABASE_URL</b> i <b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b>. Uzupełnij <b>apps/web/.env.local</b> i uruchom ponownie.</p>
          </div>
          <div className="errfoot"><Link href="/" className="pill ghost">Strona główna</Link></div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- toast (legacy: one element, icon in a tone colour) ---------------- */
const TOAST_TONE: Record<string, string> = { check: "acid", flame: "flame", close: "red", "x-circle": "red", lock: "muted", info: "cyan", trophy: "gold", bolt: "gold", heart: "red", gem: "cyan", snow: "cyan", cards: "cyan", star: "gold", boss: "violet", calendar: "gold", map: "acid", clock: "cyan", alert: "red", refresh: "cyan", palette: "violet", chest: "gold", download: "cyan", bell: "cyan", moon: "violet", wifi: "amber", xp: "gold" };
function ToastView() {
  const { toasts } = useApp();
  const t = toasts[toasts.length - 1];
  return (
    <div className={cn("toast", t && "show")} id="toast" role="status" aria-live="polite">
      {t?.icon && <Icon name={t.icon === "xp" ? "bolt" : t.icon} size={16} className={cn("ic-" + (TOAST_TONE[t.icon] ?? "acid"), t.anim)} />}
      {t && <span>{t.text}</span>}
    </div>
  );
}

/** Badges / rank changes as legacy toasts ("Odznaka: …"). */
function AchievementToasts() {
  const { unlockedQueue, popUnlocked, levelUpQueue, popLevelUp, toast } = useApp();
  const sfx = useSfx();
  const a = unlockedQueue[0];
  const r = levelUpQueue[0];
  useEffect(() => {
    if (!a) return;
    sfx.play("chest");
    const t = setTimeout(() => {
      toast("Odznaka: " + a.title, a.icon, "a-pop");
      popUnlocked();
    }, 1200);
    return () => clearTimeout(t);
  }, [a, popUnlocked, toast, sfx]);
  useEffect(() => {
    if (!r) return;
    sfx.play("levelup");
    const t = setTimeout(() => {
      toast("Nowa ranga: " + r.name, "trophy", "a-pop");
      popLevelUp();
    }, 2600);
    return () => clearTimeout(t);
  }, [r, popLevelUp, toast, sfx]);
  return null;
}

/** Offline bar (ErrorState.html): navigator.onLine + events. */
function NetBar() {
  const [off, setOff] = useState(false);
  const { toast } = useApp();
  useEffect(() => {
    const upd = () => setOff(navigator.onLine === false);
    upd();
    const on = () => {
      upd();
      toast("Sieć wróciła", "wifi");
    };
    window.addEventListener("offline", upd);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", upd);
      window.removeEventListener("online", on);
    };
  }, [toast]);
  return (
    <div className={cn("netbar", off && "on a-up")} role="status">
      <Icon name="wifi" size={16} />
      <span>Brak sieci — działasz offline, postępy zapiszą się po powrocie połączenia</span>
    </div>
  );
}

/* ---------------- pills ---------------- */
export function StreakPill() {
  const { streak, ready } = useApp();
  return (
    <Link href="/app/streak" className="streak" aria-label="Seria dni">
      <Icon name="flame" size={16} className="ic-flame a-beat" />
      <span>{ready ? streak : 0}</span> <small>dni</small>
    </Link>
  );
}
export function XpPill() {
  const { totalXp, ready } = useApp();
  return (
    <div className="streak">
      <Icon name="bolt" size={16} className="ic-gold" />
      <span>{fmtNum(ready ? totalXp : 0)}</span> <small>xp</small>
    </div>
  );
}
export function GemPill({ cls }: { cls?: string }) {
  const { gems, ready } = useApp();
  return (
    <Link href="/app/shop" className={cn("streak gems", cls)} aria-label={`Gemy: ${gems}. Otwórz plecak`}>
      <Icon name="gem" size={16} className="ic-cyan" />
      <span>{fmtNum(ready ? gems : 0)}</span>
    </Link>
  );
}
export function HeartsPill({ iconBeat, size = 16 }: { iconBeat?: boolean; size?: number }) {
  const { hearts, toast, unlimitedHearts } = useApp();
  const n = hearts.hearts;
  return (
    <button type="button" className={cn("hearts", n === 0 && "zero")} aria-label={`Życia: ${n} z ${HEARTS_MAX}`} onClick={() => toast(unlimitedHearts ? "Pro: nieskończone życia" : hearts.nextInMs != null ? "Kolejne życie za " + etaText(hearts.nextInMs) : "Pełne życia", "heart")}>
      <Icon name="heart" size={size} className={iconBeat ? "a-beat" : undefined} />
      <span className="n">{unlimitedHearts ? "∞" : n}</span>
    </button>
  );
}
export function Pills() {
  return (
    <div className="pills">
      <StreakPill />
      <XpPill />
      <GemPill />
    </div>
  );
}

export function BackBtn({ href, onClick, label = "Wróć", sm, icon = "back" }: { href?: string; onClick?: () => void; label?: string; sm?: boolean; icon?: string }) {
  const router = useRouter();
  const cls = cn("backbtn", sm && "sm");
  const ic = <Icon name={icon} size={icon === "close" ? 18 : 20} stroke={3} />;
  if (href) return <Link href={href} className={cls} aria-label={label}>{ic}</Link>;
  return <button type="button" className={cls} aria-label={label} onClick={onClick ?? (() => router.back())}>{ic}</button>;
}

/** Bottom nav: Dziś · Powtórka · [+] · Fiszki · Profil (legacy renderNav). */
export function BottomNav() {
  const path = usePathname();
  const { openQuickAdd } = useUi();
  const sfx = useSfx();
  const items = NAV.map((it) => {
    const active = it.match(path);
    return (
      <Link key={it.key} href={it.href} className={cn(active && "active")} aria-current={active ? "page" : undefined} onClick={() => sfx.play("tap")}>
        <Icon name={it.ic} size={24} stroke={2.4} />
        <span>{it.label}</span>
      </Link>
    );
  });
  return (
    <nav className="nav" aria-label="Nawigacja">
      {items[0]}
      {items[1]}
      <button type="button" className="navplus a-pulse" aria-label="Dodaj materiał" onClick={() => { sfx.play("tap"); openQuickAdd(); }}>
        <Icon name="plus" size={30} stroke={3.2} />
      </button>
      {items[2]}
      {items[3]}
    </nav>
  );
}

/**
 * Screen shell (legacy shell()): topbar (back / brand or title / pills / right) + .screen > .scroll + optional nav.
 * `blob` = background circle class ("acid", "cyan", "gold", "amber", "pink", "mid", "th-<theme>" or true).
 */
export function Shell({ nav, title, back, backHref, pills = true, right, blob, cls, children, id }: { nav?: boolean; title?: ReactNode; back?: () => void; backHref?: string; pills?: boolean; right?: ReactNode; blob?: string | true; cls?: string; children: ReactNode; id?: string }) {
  return (
    <>
      {blob && <div className={cn("blob a-float", blob === true ? "" : blob)} aria-hidden="true" />}
      <div className="topbar">
        {(back || backHref) && <BackBtn href={backHref} onClick={back} />}
        <div className={cn("logo", title ? "ttl" : "brand")}>{title ?? <>Recall<span className="g">.</span></>}</div>
        {pills && <Pills />}
        {right}
      </div>
      <div className="screen active" id={id}>
        <div className={cn("scroll", cls)}>{children}</div>
      </div>
      {nav && <BottomNav />}
    </>
  );
}

/** Blob class for the Today screen from the active theme (Shop). */
export function useThemeBlob(): string {
  const { themes } = useApp();
  return themes.active && themes.active !== "violet" ? "th-" + themes.active : "";
}

/** Small link "Wszystkie ›" in section headers. */
export function SecLink({ href, children, onClick }: { href?: string; children: ReactNode; onClick?: () => void }) {
  const inner = <>{children} <Icon name="chevron-right" size={14} stroke={3} /></>;
  if (href) return <Link href={href} className="link">{inner}</Link>;
  return <button type="button" className="link" onClick={onClick}>{inner}</button>;
}

export const useCurrentPath = usePathname;
export { isFull as isFullScreenPath };

/** Toggle switch (legacy toggleBtn). */
export function Toggle({ on, label, onChange, sm }: { on: boolean; label: string; onChange: (v: boolean) => void; sm?: boolean }) {
  return (
    <button type="button" className={cn("toggle", on && "on", sm && "sm")} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <i />
    </button>
  );
}

/** Settings-style row helpers. */
export function SetSep() {
  return <div className="setsep" />;
}
export function useNavHidden() {
  const p = usePathname();
  return isFull(p);
}
