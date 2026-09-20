"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Btn3d } from "@/components/ui/btn3d";
import { cn } from "@/lib/utils";

type Mode = "magic" | "password" | "signup";

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") || "/app";
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(() => {
    const err = params.get("error");
    if (!err) return null;
    return { kind: "err", text: err === "config" ? "Brak konfiguracji Supabase — logowanie wyłączone." : `Nie udało się zalogować: ${err}` };
  });
  const supabase = getBrowserSupabase();

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(next);
    });
  }, [supabase, router, next]);

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return setMsg({ kind: "err", text: "Brak konfiguracji Supabase." });
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback() } });
        if (error) throw error;
        setMsg({ kind: "ok", text: "Wysłane! Sprawdź skrzynkę (i spam) — klik w link loguje Cię automatycznie." });
      } else if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback() } });
        if (error) throw error;
        if (data.session) router.replace(next);
        else setMsg({ kind: "ok", text: "Konto założone. Potwierdź e-mail klikając w link, potem wróć tutaj." });
      }
    } catch (err) {
      setMsg({ kind: "err", text: (err as Error).message || "Coś poszło nie tak." });
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (!supabase) return setMsg({ kind: "err", text: "Brak konfiguracji Supabase." });
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
    if (error) {
      setMsg({ kind: "err", text: error.message });
      setBusy(false);
    }
  }

  return (
    <div className="w-full card3d !p-6">
      <span className="tag" style={{ color: "var(--play-green)" }}>{mode === "signup" ? "Nowe konto" : "Logowanie"}</span>
      <h1 style={{ fontSize: 28 }}>{mode === "signup" ? "Załóż konto" : "Zaloguj się"}</h1>
      <p className="text-muted text-[14.5px] mt-2 mb-6 font-semibold">Własne przedmioty, tematy z AI i postępy w chmurze. <b>3 tematy w miesiącu za darmo.</b></p>

      {!supabase && (
        <div className="exfb bad mb-4">Brak konfiguracji Supabase (NEXT_PUBLIC_SUPABASE_URL) — logowanie jest wyłączone na tej instancji.</div>
      )}

      <Btn3d variant="ghost" onClick={google} disabled={busy || !supabase} className="!text-[14px] !normal-case !tracking-normal">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.5 5.8c4.4-4 7-10 7-17.5z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.2 0 11.6-2 15.5-5.6l-7.5-5.8c-2.1 1.4-4.8 2.3-8 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6C6.5 42.6 14.6 48 24 48z"/></svg>
        Kontynuuj z Google
      </Btn3d>

      <div className="flex items-center gap-3 my-5 eyebrow"><span className="flex-1 divider" />albo e-mail<span className="flex-1 divider" /></div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ty@uczelnia.pl" />
        </div>
        {mode !== "magic" && (
          <div>
            <label className="label" htmlFor="password">Hasło</label>
            <input id="password" className="input" type="password" required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 6 znaków" />
          </div>
        )}
        <button type="submit" className="btn3d green lg" disabled={busy || !supabase}>
          {busy ? "Chwila…" : mode === "magic" ? "Wyślij magiczny link" : mode === "password" ? "Zaloguj" : "Załóż konto"}
        </button>
      </form>

      {msg && <div className={cn("exfb", msg.kind === "ok" ? "ok" : "bad")} role="status">{msg.text}</div>}

      <div className="text-sm text-muted mt-5 flex flex-wrap gap-2">
        {mode !== "magic" && <button type="button" className="chip" onClick={() => setMode("magic")}>magiczny link</button>}
        {mode !== "password" && <button type="button" className="chip" onClick={() => setMode("password")}>hasło</button>}
        {mode !== "signup" && <button type="button" className="chip" onClick={() => setMode("signup")}>nowe konto z hasłem</button>}
      </div>
      <p className="text-[12px] text-muted mt-5">Logując się akceptujesz <a className="underline" href="/regulamin">regulamin</a> i <a className="underline" href="/prywatnosc">politykę prywatności</a>.</p>
    </div>
  );
}
