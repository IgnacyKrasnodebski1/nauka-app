"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FREEZE_MAX, HEARTS_MAX, PLANS, pl, THEMES, todayStr, type Plan, type Subject } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { etaText, initial, noEmoji } from "@/lib/dates";
import { GOAL_NAME, LEVEL_NAME } from "@/components/screens/onboarding";
import { Shell, Toggle, useUi } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";
import { themeStyle } from "@/components/ui/mono";
import { cn } from "@/lib/utils";

const VERSION = "2.0";
const CHANGELOG: [string, string][] = [
  ["2.0", "Nowa skóra na tokenach, plan dnia, ścieżka ze skrzyniami i bossem, 16 typów zadań, powtórka na interwałach, egzamin z siatką, plan do sprawdzianu, gemy, misje, album, duch"],
  ["1.x", "Przedmioty i tematy z AI, roladka, fiszki, mini-gry, quiz, egzamin, tutor, Pro przez Stripe"],
];
interface MeInfo { plan: Plan; usage: { generations: number; tutorMessages: number }; subscription: { status: string; interval: string; current_period_end: string; cancel_at_period_end: boolean } | null }

function Row({ ic, t, s, v, href, onClick, id, cls }: { ic?: string; t: string; s?: string; v?: string; href?: string; onClick?: () => void; id?: string; cls?: string }) {
  const inner = <>{ic && <Icon name={ic} size={20} stroke={2.4} />}<div className="grow"><div className={cn("t", cls)}>{t}</div>{s && <div className="s">{s}</div>}</div>{v && <span className="v acid">{v}</span>}<Icon name="chevron-right" size={18} className="chev" /></>;
  return href ? <Link id={id} href={href} className="setrow">{inner}</Link> : <button id={id} type="button" className="setrow" onClick={onClick}>{inner}</button>;
}

/** Settings.html (2.0 sections) merged with the 1.x account: name, ranking, Pro/Stripe, export/import JSON, reset, logout. */
export function SettingsScreen({ subjects }: { subjects: Subject[] }) {
  const app = useApp();
  const { user, session, signOut, stage, goal, dailyGoal, themes, soundOn, setSoundOn, reduceMotion, setReduceMotion, hearts, unlimitedHearts, meta, reminder, setReminder, displayName, setDisplayName, showOnLeaderboard, setShowOnLeaderboard, authHeaders, plan, history, resetProgress, toast } = app;
  const { openQuickAdd } = useUi();
  const router = useRouter();
  const [me, setMe] = useState<MeInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState(displayName ?? "");
  const [seen, setSeen] = useState(displayName);
  const [log, setLog] = useState(false);
  const fileInp = useRef<HTMLInputElement>(null);
  if (seen !== displayName) { setSeen(displayName); setName(displayName ?? ""); }
  useEffect(() => {
    if (!session) return;
    fetch("/api/me", { headers: authHeaders() }).then((r) => (r.ok ? r.json() : null)).then((j) => j && setMe(j as MeInfo)).catch(() => {});
  }, [session, authHeaders]);
  const post = async (path: string, body?: unknown) => {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...authHeaders() }, body: body ? JSON.stringify(body) : undefined });
    const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!r.ok || !j.url) throw new Error(j.error || `Błąd ${r.status}`);
    window.location.href = j.url;
  };
  const checkout = async (interval: "month" | "year") => { setBusy(interval); try { await post("/api/stripe/checkout", { interval, platform: "web" }); } catch (e) { toast((e as Error).message, "alert"); setBusy(null); } };
  const portal = async () => { setBusy("portal"); try { await post("/api/stripe/portal"); } catch (e) { toast((e as Error).message, "alert"); setBusy(null); } };
  const th = THEMES.find((t) => t.id === themes.active) ?? THEMES[0]!;
  const eta = hearts.nextInMs ?? 0;
  const rem = reminder ?? { on: false, at: "19:30" };
  const nHist = Object.keys(history).length;
  const limits = PLANS[me?.plan ?? plan];

  const exportData = () => {
    const store = app.store;
    if (!store) return;
    const data = { app: "recall", version: VERSION, exportedAt: new Date().toISOString(), user: user.id, progress: store.allProgress(), weak: app.weak, srs: store.allSrs(), meta: store.getMeta(), extra: store.getExtra(), quests: store.getQuests(), achievements: [...store.getAchievements()] };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recall-postepy-" + todayStr() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast("Plik z postępami zapisany", "download");
  };
  const importData = (file: File) => {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const d = JSON.parse(String(r.result || "")) as { app?: string; progress?: Record<string, never>; srs?: Record<string, never>; meta?: never; extra?: never; weak?: never };
        if (!d || d.app !== "recall" || !d.progress) throw new Error("format");
        if (!confirm("Wczytać postępy z pliku? Obecne zostaną zastąpione.")) return;
        const store = app.store!;
        for (const [tid, p] of Object.entries(d.progress)) store.setProgress(tid, p);
        if (d.srs) for (const [tid, m] of Object.entries(d.srs)) store.setSrs(tid, m);
        if (d.weak) for (const tid of Object.keys(d.weak)) store.setWeak(d.weak, tid);
        if (d.meta) store.setMeta(d.meta);
        if (d.extra) store.setExtra(d.extra);
        toast("Postępy wczytane", "check");
        router.refresh();
      } catch {
        toast("To nie jest plik z postępami Recall", "alert");
      }
    };
    r.onerror = () => toast("Nie udało się odczytać pliku", "alert");
    r.readAsText(file);
  };
  const reset = async () => {
    if (!confirm("Na pewno? Skasuje XP, gwiazdki, gemy, album, odznaki, plan dnia, wyniki egzaminów i plany do sprawdzianów. Seria zostaje.")) return;
    await resetProgress();
    toast("Postępy wyzerowane", "refresh");
    router.refresh();
  };

  return (
    <Shell title="Ustawienia" backHref="/app/profile" pills={false} blob="acid" cls="settings">
      <div className="eyebrow sec">Profil</div>
      <div className="setcard a-up d1">
        <div className="setrow"><Icon name="user" size={20} stroke={2.4} /><div className="grow"><div className="t">Nazwa w rankingu</div><input className="input" style={{ marginTop: 6 }} value={name} placeholder={user.email ?? "Twoja nazwa"} maxLength={40} aria-label="Nazwa w rankingu" onChange={(e) => setName(e.target.value)} onBlur={() => { const v = name.trim() || null; if (v !== displayName) { setDisplayName(v); toast("Nazwa zapisana", "check"); } }} /></div></div>
        <div className="setsep" />
        <Row ic="cap" t="Etap i cel" s={(stage ? LEVEL_NAME[stage] : "nie wybrano") + (goal ? " · " + GOAL_NAME[goal] : "")} href="/app/levelpick?from=settings" id="set-level" />
        <div className="setsep" />
        <Row ic="bolt" t="Cel dzienny" v={dailyGoal + " XP"} s="plan dnia, pasek XP i misja XP" href="/app/onboarding?from=settings" id="set-goal" />
        <div className="setsep" />
        <Row ic="palette" t="Motyw" v={th.name} s={`${themes.owned.length} z ${THEMES.length} zestawów · kolejne w plecaku`} href="/app/shop" id="set-theme" />
        <div className="setsep" />
        <div className="setrow"><Icon name="trophy" size={20} stroke={2.4} /><div className="grow"><div className="t">Pokazuj mnie w lidze</div><div className="s">tygodniowy ranking XP</div></div><Toggle on={showOnLeaderboard} label="Pokazuj w lidze" onChange={setShowOnLeaderboard} /></div>
      </div>

      <div className="eyebrow sec">Nauka</div>
      <div className="setcard a-up d2">
        <div className="setrow"><div className="grow"><div className="t">Dźwięk</div><div className="s">krótkie efekty przy odpowiedziach i nagrodach</div></div><Toggle on={soundOn} label="Dźwięk" onChange={setSoundOn} /></div>
        <div className="setsep" />
        <div className="setrow"><div className="grow"><div className="t">Ogranicz animacje</div><div className="s">własny przełącznik, niezależny od ustawień telefonu</div></div><Toggle on={reduceMotion} label="Ogranicz animacje" onChange={setReduceMotion} /></div>
        <div className="setsep" />
        <button type="button" className="setrow" onClick={() => toast(unlimitedHearts ? "Pro: nieskończone życia" : eta ? "Kolejne życie za " + etaText(eta) : "Pełne życia", "heart")}><Icon name="heart" size={20} className="ic-red" /><div className="grow"><div className="t">Życia</div><div className="s">{unlimitedHearts ? "Pro — bez limitu" : `${hearts.hearts} z ${HEARTS_MAX} · jedno wraca co 30 min${eta ? " · następne za " + etaText(eta) : ""} · 10 fiszek = +1`}</div></div></button>
        <div className="setsep" />
        <Link href="/app/shop" className="setrow"><Icon name="snow" size={20} stroke={2.4} className="ic-cyan" /><div className="grow"><div className="t">Zamrożenia serii</div><div className="s">masz {meta.streakFreezes} z {FREEZE_MAX} · 100 gemów w plecaku</div></div><Icon name="chevron-right" size={18} className="chev" /></Link>
      </div>

      <div className="eyebrow sec">Powiadomienia</div>
      <div className="setcard a-up d3">
        <div className="setrow">
          <div className="grow"><div className="t">Przypomnienie o nauce</div><div className="s">codziennie o wybranej godzinie</div></div>
          <input type="time" className="settime" value={rem.at} aria-label="Godzina przypomnienia" onChange={(e) => setReminder({ on: rem.on, at: e.target.value || "19:30" })} />
          <Toggle on={rem.on} label="Przypomnienie o nauce" onChange={(v) => { setReminder({ on: v, at: rem.at }); if (v) toast("Godzina zapisana", "bell"); }} />
        </div>
        <div className="setsep" />
        <div className="setrow note"><Icon name="info" size={18} stroke={2.4} /><div className="grow"><div className="s">Powiadomienia wymagają aplikacji mobilnej. Web zapisuje tylko godzinę na koncie.</div></div></div>
      </div>

      <div className="eyebrow sec">Plan</div>
      <div className="setcard a-up d3">
        <div className="setrow"><Icon name="star" size={20} stroke={2.4} className="ic-gold" /><div className="grow"><div className="t">Plan {limits.label}</div><div className="s">{me ? `${me.usage.generations} z ${limits.generationsPerMonth} tematów w tym miesiącu · tutor ${me.plan === "pro" ? "bez limitu" : "30 wiadomości dziennie"}` : "…"}</div></div></div>
        <div className="setsep" />
        {plan === "pro" || me?.plan === "pro" ? (
          <Row ic="check" t="Pro aktywne" s={me?.subscription ? (me.subscription.cancel_at_period_end ? "wygasa " : "odnawia się ") + new Date(me.subscription.current_period_end).toLocaleDateString("pl-PL") : "nieskończone życia, większe pliki, tutor bez limitu"} onClick={portal} id="set-portal" />
        ) : (
          <>
            <button type="button" className="setrow acid" disabled={!!busy} onClick={() => checkout("month")}><Icon name="bolt" size={20} stroke={2.6} /><div className="grow"><div className="t">Przejdź na Pro · {PLANS.pro.priceMonthlyPln} zł/mies.</div><div className="s">{PLANS.pro.generationsPerMonth} tematów, nieskończone życia, tutor bez limitu</div></div><Icon name="chevron-right" size={18} className="chev" /></button>
            <div className="setsep" />
            <Row ic="calendar" t={`Pro rocznie · ${PLANS.pro.priceYearlyPln} zł/rok`} s="dwa miesiące gratis" onClick={() => checkout("year")} id="set-year" />
          </>
        )}
      </div>

      <div className="eyebrow sec">Przedmioty</div>
      <div className="setcard a-up d4">
        {subjects.map((s, i) => (
          <div key={s.id} className="contents">
            {i > 0 && <div className="setsep" />}
            <Link href={`/app/s/${s.id}`} className="setrow themed" style={themeStyle(s.accent2)}><div className="mono solid xs" aria-hidden="true">{initial(s.name)}</div><span className="t grow">{noEmoji(s.name)}</span><Icon name="chevron-right" size={18} className="chev" /></Link>
          </div>
        ))}
        {subjects.length > 0 && <div className="setsep" />}
        <Row ic="grid" t="Katalog przedmiotów" s="gotowe przedmioty według etapu" href="/app/catalog" id="set-catalog" />
        <div className="setsep" />
        <button type="button" className="setrow acid" onClick={openQuickAdd}><Icon name="plus" size={20} stroke={3} /><span className="t grow">Dodaj materiał</span></button>
      </div>

      <div className="eyebrow sec">Dane</div>
      <div className="setcard a-up d5">
        <Row ic="download" t="Eksportuj postępy" s="plik JSON: XP, poziomy, powtórki, plany, ustawienia" onClick={exportData} id="set-export" />
        <div className="setsep" />
        <Row ic="upload" t="Importuj z pliku" s="zastąpi obecne postępy tym z pliku" onClick={() => fileInp.current?.click()} id="set-import" />
        <input ref={fileInp} type="file" accept=".json,application/json" className="hiddenfile" aria-label="Plik z postępami" onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />
        <div className="setsep" />
        <button type="button" className="setrow" id="set-reset" onClick={reset}><Icon name="refresh" size={20} stroke={2.6} className="ic-red" /><div className="grow"><div className="t red">Wyzeruj postępy</div><div className="s">XP, gwiazdki, gemy, album, odznaki, plany{nHist ? ` · dziennik: ${nHist} ${pl(nHist, "dzień", "dni", "dni")}` : ""}. Seria zostaje.</div></div></button>
        <div className="setsep" />
        <button type="button" className="setrow" id="set-logout" onClick={async () => { await signOut(); router.push("/login"); router.refresh(); }}><Icon name="logout" size={20} stroke={2.4} /><div className="grow"><div className="t">Wyloguj</div><div className="s">{user.email}</div></div></button>
      </div>

      <div className="eyebrow sec">O aplikacji</div>
      <div className="setcard a-up d6">
        <div className="setrow"><Icon name="info" size={20} stroke={2.4} /><div className="grow"><div className="t">Recall {VERSION}</div><div className="s">wersja {VERSION} · konto w chmurze, postępy na wszystkich urządzeniach</div></div></div>
        <div className="setsep" />
        <button type="button" className="setrow" id="set-whatsnew" onClick={() => setLog((v) => !v)}><Icon name="list" size={20} stroke={2.4} /><div className="grow"><div className="t">Co nowego</div><div className="s">design 2.0</div></div><Icon name={log ? "chevron-up" : "chevron-down"} size={18} className="chev" /></button>
        {log && <div className="changelog">{CHANGELOG.map(([v, t]) => <div key={v} className="chrow"><b>{v}</b><span>{t}</span></div>)}</div>}
        <div className="setsep" />
        <div className="setrow"><div className="grow"><div className="s"><Link href="/regulamin" className="link">Regulamin</Link> · <Link href="/prywatnosc" className="link">Prywatność</Link></div></div></div>
      </div>
      <div className="version">Recall {VERSION} · web</div>
    </Shell>
  );
}
