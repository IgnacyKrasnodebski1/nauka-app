"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { ACCEPTED_MIME, PLANS, STAGES, isAcceptedMime, type Plan, type Stage } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { TopBar } from "@/components/app/chrome";
import { cn, extOf } from "@/lib/utils";

const FUN = ["czytam Twoje notatki…", "rozszyfrowuję pismo z ostatniej ławki…", "układam poziomy…", "piszę wersję „po ludzku”…", "wymyślam pytania (bez podchwytliwych, no może parę)…", "robię fiszki i mini-gry…", "sprawdzam, czy nic nie zmyśliłem…", "jeszcze chwila, dopinam egzamin…"];

interface MeInfo {
  plan: Plan;
  usage: { generations: number };
  limits: (typeof PLANS)[Plan];
}

export function NewSubject() {
  const { user, session, supabase, stage: savedStage, ready } = useApp();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [stageOverride, setStage] = useState<Stage | null>(null);
  const stage: Stage = stageOverride ?? savedStage ?? "liceum";
  const [hint, setHint] = useState("");
  const [levels, setLevels] = useState(4);
  const [lang, setLang] = useState(false);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [funIdx, setFunIdx] = useState(0);
  const [me, setMe] = useState<MeInfo | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/me", { headers: { authorization: `Bearer ${session.access_token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setMe(j as MeInfo))
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setFunIdx((i) => (i + 1) % FUN.length), 2600);
    return () => clearInterval(t);
  }, [busy]);

  const plan: Plan = me?.plan ?? "free";
  const limits = PLANS[plan];
  const left = me ? Math.max(0, limits.generationsPerMonth - me.usage.generations) : null;

  const addFiles = (list: FileList | File[]) => {
    setErr(null);
    const next = [...files];
    for (const f of Array.from(list)) {
      const mime = f.type || (f.name.endsWith(".md") ? "text/markdown" : f.name.endsWith(".txt") ? "text/plain" : "");
      if (!isAcceptedMime(mime)) {
        setErr(`„${f.name}”: obsługujemy tylko zdjęcia (jpg/png/webp/gif), PDF i txt/md.`);
        continue;
      }
      if (f.size > limits.maxFileMb * 1024 * 1024) {
        setErr(`„${f.name}” ma ponad ${limits.maxFileMb} MB (limit planu ${limits.label}).`);
        continue;
      }
      if (next.length >= limits.filesPerGeneration) {
        setErr(`Max ${limits.filesPerGeneration} plików na raz w planie ${limits.label}.`);
        break;
      }
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    setFiles(next);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !user || !session) return;
    if (!files.length && text.trim().length < 40) return setErr("Wrzuć chociaż jeden plik albo wklej trochę więcej tekstu (min. 40 znaków).");
    setErr(null);
    setBusy("wysyłam pliki…");
    try {
      const materialIds: string[] = [];
      for (const [i, f] of files.entries()) {
        setBusy(`wysyłam ${i + 1}/${files.length}: ${f.name}`);
        const mime = f.type || (f.name.endsWith(".md") ? "text/markdown" : "text/plain");
        const path = `${user.id}/${crypto.randomUUID()}.${extOf(f.name, mime)}`;
        const up = await supabase.storage.from("materials").upload(path, f, { contentType: mime, upsert: false });
        if (up.error) throw new Error(`Upload „${f.name}”: ${up.error.message}`);
        const ins = await supabase.from("materials").insert({ owner_id: user.id, storage_path: path, mime, size_bytes: f.size, name: f.name }).select("id").single();
        if (ins.error) throw new Error(`Zapis materiału: ${ins.error.message}`);
        materialIds.push((ins.data as { id: string }).id);
      }
      setBusy(FUN[0]!);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ materialIds, text: text.trim() || undefined, options: { stage, hint: hint.trim() || undefined, levels, lang } }),
      });
      const j = (await res.json().catch(() => ({}))) as { subjectId?: string; error?: string; code?: string; used?: number; limit?: number };
      if (!res.ok) {
        if (j.code === "limit_reached") throw new Error(`Limit generacji na ten miesiąc wyczerpany (${j.used}/${j.limit}). Przejdź na Pro w zakładce Konto.`);
        throw new Error(j.error || `Błąd ${res.status}`);
      }
      router.push(`/app/s/${j.subjectId}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }

  const gate = ready && (!supabase || !user);

  return (
    <>
      <TopBar back="/app" title={<>✨ <span className="g">Nowy przedmiot</span></>} />
      <div className="px-4 pb-8">
        {gate ? (
          <div className="card mt-2">
            <div className="text-4xl mb-2">🔐</div>
            <h2 className="text-xl font-black">Generowanie wymaga konta</h2>
            <p className="text-muted text-sm mt-2 mb-4">
              {supabase
                ? `Żeby AI przeczytało Twoje materiały, musisz się zalogować — pliki lądują w Twoim prywatnym folderze. Konto Free ma ${PLANS.free.generationsPerMonth} generacje w miesiącu za darmo, bez karty.`
                : "Ta instancja działa w trybie demo (brak Supabase), więc wrzucanie materiałów jest wyłączone. Biblioteka i nauka działają normalnie."}
            </p>
            {supabase && <Link href="/login?next=/app/new" className="pill">Zaloguj się / załóż konto</Link>}
            <Link href="/app" className="pill ghost mt-2">Wróć do biblioteki</Link>
          </div>
        ) : busy ? (
          <div className="result mt-10" aria-live="polite">
            <div className="big"><span className="spinner !w-14 !h-14 !border-4" /></div>
            <h2>Robię z tego przedmiot</h2>
            <p className="pop" key={funIdx}>{busy.startsWith("wysyłam") ? busy : FUN[funIdx]}</p>
            <p className="!text-[13px]">To trwa zwykle 1–3 minuty. Nie zamykaj karty.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 mt-2">
            {me && (
              <div className="text-sm text-muted">Plan <b className="text-txt">{limits.label}</b> · zostało <b className="text-txt">{left}</b> z {limits.generationsPerMonth} generacji w tym miesiącu</div>
            )}
            <div
              className={cn("dropzone", over && "over")}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
              onClick={() => input.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
              aria-label="Dodaj pliki"
            >
              <div className="text-4xl mb-2">📸📄</div>
              <div className="font-black text-txt">Przeciągnij pliki albo kliknij</div>
              <div className="text-xs mt-1">zdjęcia, PDF, txt · max {limits.filesPerGeneration} plików · do {limits.maxFileMb} MB każdy</div>
              <input ref={input} type="file" multiple accept={ACCEPTED_MIME.join(",")} className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
            </div>
            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((f) => (
                  <li key={f.name + f.size} className="flex items-center gap-3 card !p-3 text-sm">
                    <span aria-hidden="true">{f.type.startsWith("image/") ? "🖼️" : f.type === "application/pdf" ? "📄" : "📝"}</span>
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-muted">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button type="button" className="text-muted" onClick={() => setFiles(files.filter((x) => x !== f))} aria-label={`Usuń ${f.name}`}>✕</button>
                  </li>
                ))}
              </ul>
            )}

            <div>
              <label className="label" htmlFor="text">Albo wklej tekst</label>
              <textarea id="text" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Notatki z wykładu, fragment podręcznika, lista słówek…" />
            </div>

            <div>
              <span className="label">Etap</span>
              <div className="chips" role="radiogroup" aria-label="Etap edukacji">
                {STAGES.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={stage === s.id} className={cn("chip", stage === s.id && "active")} onClick={() => setStage(s.id)}>{s.emoji} {s.label}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="hint">Co to za materiał? (opcjonalnie)</label>
              <input id="hint" className="input" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="np. biologia, fotosynteza, sprawdzian w piątek" maxLength={300} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="levels">Liczba poziomów: {levels}</label>
                <input id="levels" type="range" min={2} max={8} value={levels} onChange={(e) => setLevels(Number(e.target.value))} className="w-full accent-[var(--accent2)]" />
              </div>
              <label className="card !p-3 flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={lang} onChange={(e) => setLang(e.target.checked)} className="w-5 h-5 accent-[var(--accent2)]" />
                <span className="text-sm font-bold">🌍 Nauka języka<br /><span className="text-muted font-semibold text-xs">fiszki = słówka</span></span>
              </label>
            </div>

            {err && <div className="exfb bad" role="alert">{err}</div>}
            <button type="submit" className="pill" disabled={!files.length && text.trim().length < 40}>Generuj przedmiot 🚀</button>
            <p className="text-[12px] text-muted text-center">Wrzucaj tylko materiały, do których masz prawo. AI uczy wyłącznie z tego, co wrzucisz.</p>
          </form>
        )}
      </div>
    </>
  );
}
