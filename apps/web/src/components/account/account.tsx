"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DAILY_GOALS, DAILY_GOAL_LABEL, GEM_COSTS, PLANS, STAGES, type Plan, type Stage } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { useSfx } from "@/lib/sfx";
import { TopBar } from "@/components/app/chrome";
import { BadgesGrid } from "@/components/ui/badges-grid";
import { Btn3d } from "@/components/ui/btn3d";
import { Icon } from "@/components/ui/icons";
import { RankCard } from "@/components/ui/rank-card";
import { StatCard } from "@/components/ui/stat-card";
import { StreakCalendar } from "@/components/ui/streak-calendar";
import { cn } from "@/lib/utils";

interface Me {
  profile: { id: string; email: string | null; display_name: string | null; stage: Stage; plan: Plan } | null;
  plan: Plan;
  usage: { month: string; generations: number; tutorMessages: number };
  limits: (typeof PLANS)[Plan];
  subscription: { status: string | null; interval: string | null; current_period_end: string | null; cancel_at_period_end: boolean } | null;
}

export function Account() {
  const { user, session, signOut, stage, setStage, toast, ready, meta, totalXp, authHeaders, rank, streak, gems, achievements, dailyGoal, setDailyGoal, soundOn, setSoundOn, showOnLeaderboard, setShowOnLeaderboard, displayName, setDisplayName, myWeeklyRank, buyStreakFreeze, activity, plan } = useApp();
  const sfx = useSfx();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [weekly, setWeekly] = useState<{ rank: number; xp: number; total: number } | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/me", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Me | null) => j && setMe(j))
      .catch(() => {});
  }, [session, authHeaders]);
  // adopt the stored display name once the store has it (adjust-state-during-render pattern)
  const [seenName, setSeenName] = useState(displayName);
  if (seenName !== displayName) {
    setSeenName(displayName);
    setName(displayName ?? "");
  }
  useEffect(() => {
    if (ready) myWeeklyRank().then(setWeekly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function saveName() {
    setDisplayName(name.trim() || null);
    toast("Zapisane");
  }
  async function post(path: string, body?: unknown) {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...authHeaders() }, body: body ? JSON.stringify(body) : undefined });
    const j = (await r.json()) as { url?: string; error?: string };
    if (!r.ok || !j.url) throw new Error(j.error || "Coś poszło nie tak.");
    window.location.href = j.url;
  }
  async function checkout(interval: "month" | "year") {
    setBusy(interval);
    setErr(null);
    try {
      await post("/api/stripe/checkout", { interval, platform: "web" });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }
  async function portal() {
    setBusy("portal");
    setErr(null);
    try {
      await post("/api/stripe/portal");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }
  const stageLabel = STAGES.find((s) => s.id === stage);
  const currentPlan: Plan = me?.plan ?? plan;
  const s = meta.stats;

  return (
    <>
      <TopBar back="/app" title="Konto" />
      <div className="px-4 pb-8 space-y-4 pt-3">
        <RankCard rank={rank} totalXp={totalXp} name={displayName || user.name || user.email || "Ty"} email={user.email} avatar={stageLabel?.emoji} />

        <div className="statgrid">
          <StatCard icon="flame" label="Seria" value={ready ? streak : 0} suffix="dni" tone="orange" delay={0.05} />
          <StatCard icon="medal" label="Rekord serii" value={ready ? meta.best : 0} suffix="dni" tone="gold" delay={0.1} />
          <StatCard icon="gem" label="Klejnoty" value={ready ? gems : 0} tone="gem" delay={0.15} />
          <StatCard icon="cards" label="Fiszki" value={s.cardsReviewed} tone="blue" delay={0.2} />
          <StatCard icon="flag" label="Poziomy" value={s.levelsDone} tone="green" delay={0.25} />
          <StatCard icon="zap" label="Najlepsze combo" value={s.comboBest} tone="purple" delay={0.3} />
        </div>

        <div className="card3d soft-gold">
          <div className="flex items-center justify-between mb-1">
            <h3 className="flex items-center gap-2"><Icon name="trophy" size={18} style={{ color: "var(--play-yellow)" }} />Ranking tygodnia</h3>
            <Btn3d variant="gold" size="sm" href="/app/leaderboard">Zobacz</Btn3d>
          </div>
          {weekly ? (
            <div className="flex items-baseline gap-2"><span className="display font-extrabold text-txt" style={{ fontSize: 34, lineHeight: 1 }}>#{weekly.rank}</span><span className="text-muted font-bold text-sm">z {weekly.total} · {weekly.xp} XP w tym tygodniu</span></div>
          ) : (
            <p className="text-sm">Zdobądź XP w tym tygodniu, żeby pojawić się w rankingu.</p>
          )}
        </div>

        <div className="card3d">
          <h3 className="flex items-center gap-2 mb-3"><Icon name="medal" size={18} style={{ color: "var(--play-purple)" }} />Odznaki · {achievements.size}/16</h3>
          <BadgesGrid unlocked={achievements} />
        </div>

        <div className="card3d soft-orange">
          <h3 className="flex items-center gap-2 mb-3"><Icon name="flame" size={18} style={{ color: "var(--play-orange)" }} />Kalendarz serii</h3>
          <StreakCalendar activity={activity} />
          <div className="flex items-center justify-between mt-3 gap-3">
            <div className="text-sm font-bold text-muted"><Icon name="snow" size={14} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />Zamrożenia serii: <b>{meta.streakFreezes}</b>/5</div>
            <Btn3d variant="blue" size="sm" disabled={gems < GEM_COSTS.streakFreeze || meta.streakFreezes >= 5} onClick={() => (buyStreakFreeze() ? toast("Zamrożenie kupione", "gem") : toast("Za mało klejnotów"))}>
              <Icon name="gem" size={14} />{GEM_COSTS.streakFreeze}
            </Btn3d>
          </div>
        </div>

        <div className="card3d">
          <h3 className="mb-1">Ustawienia</h3>
          <div className="setrow flex-col !items-stretch">
            <div className="t">Cel dzienny</div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {DAILY_GOALS.map((g) => (
                <button key={g} type="button" className={cn("card3d press text-center !p-3", dailyGoal === g ? "soft-green" : "glass")} aria-pressed={dailyGoal === g} onClick={() => { sfx.play("tap"); setDailyGoal(g); }}>
                  <div className="display font-extrabold text-txt text-[20px]">{g} XP</div>
                  <div className="text-[11px] font-bold text-muted uppercase tracking-wider">{DAILY_GOAL_LABEL[g]}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="setrow">
            <div className="flex-1"><div className="t">Dźwięki</div><div className="d">Tap, poprawna, combo, level-up.</div></div>
            <button type="button" role="switch" aria-checked={soundOn} className="switch" aria-label="Dźwięki" onClick={() => setSoundOn(!soundOn)} />
          </div>
          <div className="setrow">
            <div className="flex-1"><div className="t">Pokazuj mnie w rankingu</div><div className="d">Tylko nazwa i XP z tego tygodnia.</div></div>
            <button type="button" role="switch" aria-checked={showOnLeaderboard} className="switch" aria-label="Ranking" onClick={() => { sfx.play("tap"); setShowOnLeaderboard(!showOnLeaderboard); }} />
          </div>
          <div className="setrow flex-col !items-stretch">
            <div className="t">Etap edukacji</div>
            <div className="chips mt-2 !pb-0" role="radiogroup" aria-label="Etap">
              {STAGES.map((st) => (
                <button key={st.id} type="button" role="radio" aria-checked={stage === st.id} className={cn("chip", stage === st.id && "active")} onClick={() => { setStage(st.id); toast("Zapisane"); }}>{st.emoji} {st.label}</button>
              ))}
            </div>
          </div>
          <div className="setrow flex-col !items-stretch">
            <label className="t" htmlFor="name">Nazwa w rankingu</label>
            <div className="flex gap-2 mt-2">
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="jak mamy do Ciebie mówić?" maxLength={60} />
              <Btn3d variant="ghost" size="sm" onClick={saveName}>Zapisz</Btn3d>
            </div>
          </div>
        </div>

        <div className={cn("card3d", currentPlan === "pro" ? "soft-purple" : "")}>
          <div className="flex items-center justify-between">
            <div><span className="tag">Plan</span><h3>{me ? PLANS[me.plan].label : PLANS[currentPlan].label}</h3></div>
            {me?.subscription?.status && <span className="tag badge !mb-0">{me.subscription.status}{me.subscription.cancel_at_period_end ? " · wygasa" : ""}</span>}
          </div>
          <div className="flex items-center gap-2 mt-2 text-sm font-bold" style={{ color: "var(--play-red)" }}><Icon name="heart" size={16} />{currentPlan === "pro" ? "Pro = nieskończone serca" : "Free = 5 serc, +1 co 30 min"}</div>
          {me && (
            <>
              <div className="text-sm text-muted mt-2 mb-1">Tematy w {me.usage.month}: <b>{me.usage.generations}/{me.limits.generationsPerMonth}</b></div>
              <div className="usagebar"><i style={{ width: `${Math.min(100, (me.usage.generations / me.limits.generationsPerMonth) * 100)}%` }} /></div>
              <div className="text-sm text-muted mt-2">Wiadomości do tutora w tym miesiącu: <b>{me.usage.tutorMessages}</b>{me.plan === "free" ? " (30/dzień)" : " (bez limitu)"}</div>
              {me.subscription?.current_period_end && <div className="text-sm text-muted mt-1">Okres do: {new Date(me.subscription.current_period_end).toLocaleDateString("pl-PL")}</div>}
            </>
          )}
          {currentPlan === "pro" ? (
            <Btn3d variant="ghost" className="mt-4" onClick={portal} disabled={busy !== null}>{busy === "portal" ? "chwila…" : "Zarządzaj subskrypcją"}</Btn3d>
          ) : (
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Btn3d variant="purple" onClick={() => checkout("month")} disabled={busy !== null}>Pro · {PLANS.pro.priceMonthlyPln} zł/mies.</Btn3d>
              <Btn3d variant="ghost" onClick={() => checkout("year")} disabled={busy !== null}>{PLANS.pro.priceYearlyPln} zł/rok</Btn3d>
            </div>
          )}
          <p className="!text-[12.5px] mt-3">Pro: nieskończone serca, {PLANS.pro.generationsPerMonth} tematów/mies., {PLANS.pro.filesPerGeneration} plików po {PLANS.pro.maxFileMb} MB, tutor bez limitu. Karta, Apple Pay, Google Pay.</p>
        </div>

        {err && <div className="exfb bad" role="alert">{err}</div>}
        <Btn3d variant="ghost" onClick={async () => { await signOut(); router.push("/login"); router.refresh(); }}>Wyloguj</Btn3d>
        <p className="text-[12px] text-muted text-center">Przedmioty usuwasz na stronie przedmiotu · <Link className="underline" href="/prywatnosc">prywatność</Link> · <Link className="underline" href="/regulamin">regulamin</Link></p>
      </div>
    </>
  );
}
