"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

interface OwnSubject {
  id: string;
  name: string;
  content: { emoji: string };
  created_at: string;
}

export function Account() {
  const { user, session, supabase, signOut, stage, setStage, toast, ready, meta, totalXp, store } = useApp();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [own, setOwn] = useState<OwnSubject[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const auth = useCallback(() => ({ authorization: `Bearer ${session?.access_token ?? ""}`, "content-type": "application/json" }), [session]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/me", { headers: auth() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Me | null) => {
        if (!j) return;
        setMe(j);
        setName(j.profile?.display_name ?? "");
      })
      .catch(() => {});
  }, [session, auth]);

  const [ownVersion, setOwnVersion] = useState(0);
  useEffect(() => {
    if (!supabase || !user) return;
    let alive = true;
    supabase
      .from("subjects")
      .select("id,name,content,created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => alive && setOwn((data ?? []) as OwnSubject[]));
    return () => {
      alive = false;
    };
  }, [supabase, user, ownVersion]);

  async function saveName() {
    if (!supabase || !user) return;
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() || null }).eq("id", user.id);
    if (error) setErr(error.message);
    else toast("Zapisane ✅");
  }

  async function checkout(interval: "month" | "year") {
    setBusy(interval);
    setErr(null);
    try {
      const r = await fetch("/api/stripe/checkout", { method: "POST", headers: auth(), body: JSON.stringify({ interval, platform: "web" }) });
      const j = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || "Nie udało się otworzyć płatności.");
      window.location.href = j.url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }
  async function portal() {
    setBusy("portal");
    setErr(null);
    try {
      const r = await fetch("/api/stripe/portal", { method: "POST", headers: auth() });
      const j = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || "Nie udało się otworzyć panelu.");
      window.location.href = j.url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }
  async function del(id: string) {
    if (!supabase || !confirm("Usunąć ten przedmiot razem z postępami? Tego nie da się cofnąć.")) return;
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) return setErr(error.message);
    toast("Usunięte 🗑️");
    setOwnVersion((v) => v + 1);
    router.refresh();
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
              <div className="font-black text-lg truncate">{user ? (me?.profile?.display_name || user.email) : "Gość"}</div>
              <div className="text-muted text-sm truncate">{user ? user.email : "postępy tylko w tej przeglądarce"}</div>
            </div>
          </div>
          <div className="specs mt-4 !justify-start">
            <div className="spec">🔥 {ready ? meta.streak : "·"}<small>seria</small></div>
            <div className="spec">🏆 {ready ? meta.best : "·"}<small>rekord</small></div>
            <div className="spec">⚡ {ready ? totalXp : "·"}<small>xp łącznie</small></div>
          </div>
        </div>

        {!user && (
          <div className="card">
            <h3>Załóż konto</h3>
            <p className="mb-3">Własne przedmioty z AI, postępy w chmurze, tutor. Twoje obecne postępy przeniosą się automatycznie.</p>
            {supabase ? <Link href="/login?next=/app/account" className="pill">Zaloguj / zarejestruj</Link> : <div className="exfb bad">Tryb demo — brak konfiguracji Supabase.</div>}
          </div>
        )}

        <div className="card">
          <h3>Etap edukacji</h3>
          <div className="chips mt-2" role="radiogroup" aria-label="Etap">
            {STAGES.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={stage === s.id} className={cn("chip", stage === s.id && "active")} onClick={() => { setStage(s.id); toast("Zapisane ✅"); }}>{s.emoji} {s.label}</button>
            ))}
          </div>
          {user && (
            <div className="mt-3">
              <label className="label" htmlFor="name">Nazwa</label>
              <div className="flex gap-2">
                <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="jak mamy do Ciebie mówić?" maxLength={60} />
                <button type="button" className="pill sm" onClick={saveName}>zapisz</button>
              </div>
            </div>
          )}
        </div>

        {user && (
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
            <p className="text-[12px] mt-2">Pro: {PLANS.pro.generationsPerMonth} generacji/mies., {PLANS.pro.filesPerGeneration} plików po {PLANS.pro.maxFileMb} MB, tutor bez limitu. BLIK i karta.</p>
          </div>
        )}

        {user && (
          <div className="card">
            <h3>Twoje przedmioty ({own.length})</h3>
            {own.length === 0 ? (
              <p>Jeszcze nic nie wygenerowałeś. <Link className="underline" href="/app/new">Dodaj materiały →</Link></p>
            ) : (
              <ul className="mt-2 space-y-2">
                {own.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 text-sm">
                    <span aria-hidden="true">{s.content?.emoji ?? "📘"}</span>
                    <Link href={`/app/s/${s.id}`} className="flex-1 truncate font-bold">{s.name}</Link>
                    <button type="button" className="text-red font-bold" onClick={() => del(s.id)} aria-label={`Usuń ${s.name}`}>usuń</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {err && <div className="exfb bad" role="alert">{err}</div>}

        {user && (
          <button type="button" className="pill ghost" onClick={async () => { await signOut(); router.push("/app"); router.refresh(); }}>Wyloguj</button>
        )}
        <p className="text-[12px] text-muted text-center">Dane: {store.kind === "supabase" ? "konto (Supabase)" : "ta przeglądarka"} · <Link className="underline" href="/prywatnosc">prywatność</Link> · <Link className="underline" href="/regulamin">regulamin</Link></p>
      </div>
    </>
  );
}
