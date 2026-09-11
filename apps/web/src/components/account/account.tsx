"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PLANS, STAGES, type Plan, type Stage } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { TopBar } from "@/components/app/chrome";
import { cn } from "@/lib/utils";

interface Me {
  profile: { id: string; email: string | null; display_name: string | null; stage: Stage; plan: Plan } | null;
  plan: Plan;
  usage: { month: string; generations: number; tutorMessages: number };
  limits: (typeof PLANS)[Plan];
  subscription: { status: string | null; interval: string | null; current_period_end: string | null; cancel_at_period_end: boolean } | null;
}

export function Account() {
  const { user, session, supabase, signOut, stage, setStage, toast, ready, meta, totalXp, authHeaders } = useApp();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/me", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Me | null) => {
        if (!j) return;
        setMe(j);
        setName(j.profile?.display_name ?? "");
      })
      .catch(() => {});
  }, [session, authHeaders]);

  async function saveName() {
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() || null }).eq("id", user.id);
    if (error) setErr(error.message);
    else toast("Zapisane ✅");
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

  return (
    <>
      <TopBar back="/app" title={<>👤 <span className="g">Konto</span></>} />
      <div className="px-4 pb-8 space-y-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="subjemoji !w-14 !h-14 !text-3xl" aria-hidden="true">{stageLabel?.emoji ?? "🙂"}</div>
            <div className="min-w-0">
              <div className="font-black text-lg truncate">{me?.profile?.display_name || user.name || user.email}</div>
              <div className="text-muted text-sm truncate">{user.email}</div>
            </div>
          </div>
          <div className="specs mt-4 !justify-start">
            <div className="spec">🔥 {ready ? meta.streak : "·"}<small>seria</small></div>
            <div className="spec">🏆 {ready ? meta.best : "·"}<small>rekord</small></div>
            <div className="spec">⚡ {ready ? totalXp : "·"}<small>xp łącznie</small></div>
          </div>
        </div>

        <div className="card">
          <h3>Etap edukacji</h3>
          <div className="chips mt-2" role="radiogroup" aria-label="Etap">
            {STAGES.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={stage === s.id} className={cn("chip", stage === s.id && "active")} onClick={() => { setStage(s.id); toast("Zapisane ✅"); }}>{s.emoji} {s.label}</button>
            ))}
          </div>
          <div className="mt-3">
            <label className="label" htmlFor="name">Nazwa</label>
            <div className="flex gap-2">
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="jak mamy do Ciebie mówić?" maxLength={60} />
              <button type="button" className="pill sm" onClick={saveName}>zapisz</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <h3>Plan: {me ? PLANS[me.plan].label : "…"}</h3>
            {me?.subscription?.status && <span className="tag !mb-0">{me.subscription.status}{me.subscription.cancel_at_period_end ? " · wygasa" : ""}</span>}
          </div>
          {me && (
            <>
              <div className="text-sm text-muted mt-2 mb-1">Generacje w {me.usage.month}: <b className="text-txt">{me.usage.generations}/{me.limits.generationsPerMonth}</b></div>
              <div className="usagebar"><i style={{ width: `${Math.min(100, (me.usage.generations / me.limits.generationsPerMonth) * 100)}%` }} /></div>
              <div className="text-sm text-muted mt-2">Wiadomości do tutora w tym miesiącu: <b className="text-txt">{me.usage.tutorMessages}</b>{me.plan === "free" ? " (30/dzień)" : " (bez limitu)"}</div>
              {me.subscription?.current_period_end && <div className="text-sm text-muted mt-1">Okres do: {new Date(me.subscription.current_period_end).toLocaleDateString("pl-PL")}</div>}
            </>
          )}
          {me?.plan === "pro" ? (
            <button type="button" className="pill ghost mt-4" onClick={portal} disabled={busy !== null}>{busy === "portal" ? "chwila…" : "Zarządzaj subskrypcją"}</button>
          ) : (
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button type="button" className="pill" onClick={() => checkout("month")} disabled={busy !== null}>Pro · {PLANS.pro.priceMonthlyPln} zł/mies.</button>
              <button type="button" className="pill ghost" onClick={() => checkout("year")} disabled={busy !== null}>Pro · {PLANS.pro.priceYearlyPln} zł/rok</button>
            </div>
          )}
          <p className="text-[12px] mt-2">Pro: {PLANS.pro.generationsPerMonth} generacji/mies., {PLANS.pro.filesPerGeneration} plików po {PLANS.pro.maxFileMb} MB, tutor bez limitu. Karta, Apple Pay, Google Pay.</p>
        </div>

        {err && <div className="exfb bad" role="alert">{err}</div>}
        <button type="button" className="pill ghost" onClick={async () => { await signOut(); router.push("/login"); router.refresh(); }}>Wyloguj</button>
        <p className="text-[12px] text-muted text-center">Przedmioty usuwasz na stronie przedmiotu · <Link className="underline" href="/prywatnosc">prywatność</Link> · <Link className="underline" href="/regulamin">regulamin</Link></p>
      </div>
    </>
  );
}
