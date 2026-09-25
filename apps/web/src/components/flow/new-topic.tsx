"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { allFlashcards, allQuiz, isAcceptedMime, PLANS, SUBJECT_HUES, type Plan, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { invalidateLibrary } from "@/lib/client-data";
import { useUi, BackBtn, Toggle } from "@/components/app/chrome";
import { initial, noEmoji } from "@/lib/dates";
import { cn, extOf } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { themeStyle } from "@/components/ui/mono";

type Mode = "photo" | "file" | "text" | "prompt";
type Step = "add" | "scan" | "detected" | "generating" | "ready";
interface MeInfo { plan: Plan; usage: { generations: number } }
const STEPS_GEN = ["Odczytuję materiały", "Wyciągam pojęcia", "Układam poziomy", "Piszę pytania i zadania", "Dobieram mnemotechniki"];
const STEPS_PROMPT = ["Sprawdzam podstawę programową", "Wyciągam pojęcia", "Układam poziomy", "Piszę pytania i zadania", "Dobieram mnemotechniki"];
const fmtMb = (b: number) => (b >= 1024 * 1024 ? (b / 1024 / 1024).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");

function Steps({ n }: { n: 1 | 2 | 3 }) {
  return <div className="obsteps" aria-label={`Krok ${n} z 3`}>{[1, 2, 3].map((i) => <i key={i} className={i <= n ? "on" : ""} />)}</div>;
}
function Head({ title, sub, back, step }: { title: string; sub?: string; back: () => void; step?: 1 | 2 | 3 }) {
  return (
    <div className="topbar">
      <BackBtn onClick={back} />
      <div className="grow" style={{ minWidth: 0 }}><div className="logo ttl">{title}</div>{sub && <div className="ssub">{sub}</div>}</div>
      {step && <Steps n={step} />}
    </div>
  );
}
function Paper({ cls, src }: { cls?: string; src?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- local blob preview of the shot page
  if (src) return <div className={cn("paper shot", cls)}><img src={src} alt="" /></div>;
  return <div className={cn("paper", cls)}><i className="h" />{[92, 86, 95, 70, 90, 88, 60, 94, 80, 85, 76, 92].map((w, i) => <i key={i} style={{ width: `${w}%` }} />)}</div>;
}

/**
 * New topic flow (AddSubject.html → Scanner.html → Detected.html → Generating.html → SubjectReady.html), wired to the
 * real upload + POST /api/generate. `?mode=photo|file|text|prompt` preselects the source; `pick=1` = came from QuickAdd.
 */
export function NewTopicFlow({ subject }: { subject: Subject }) {
  const { user, supabase, stage, authHeaders, session, tests, setLevelHidden, isLevelHidden, toast } = useApp();
  const { openTestSheet } = useUi();
  const router = useRouter();
  const params = useSearchParams();
  const m0 = params.get("mode") as Mode | null;
  const [mode, setMode] = useState<Mode>(m0 && ["photo", "file", "text", "prompt"].includes(m0) ? m0 : "file");
  const [step, setStep] = useState<Step>(m0 === "photo" ? "scan" : "add");
  const [files, setFiles] = useState<File[]>([]);
  const [shots, setShots] = useState<{ file: File; url: string }[]>([]);
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");
  const [levels, setLevels] = useState(4);
  const [lang, setLang] = useState(subject.category === "angielski" || subject.category.includes("jezyk"));
  const [over, setOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [me, setMe] = useState<MeInfo | null>(null);
  const [prog, setProg] = useState<{ step: number; pct: number; detail?: string }>({ step: 0, pct: 0 });
  const [topic, setTopic] = useState<Topic | null>(null);
  const [name, setName] = useState(subject.name);
  const [color, setColor] = useState(subject.accent2);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const t0 = useRef(0);

  useEffect(() => {
    if (!session) return;
    fetch("/api/me", { headers: authHeaders() }).then((r) => (r.ok ? r.json() : null)).then((j) => j && setMe(j as MeInfo)).catch(() => {});
  }, [session, authHeaders]);
  const plan: Plan = me?.plan ?? "free";
  const limits = PLANS[plan];
  const left = me ? Math.max(0, limits.generationsPerMonth - me.usage.generations) : null;

  const addFiles = (list: FileList | File[], into: "files" | "shots" = "files") => {
    setErr(null);
    const next = into === "files" ? [...files] : shots.map((s) => s.file);
    for (const f of Array.from(list)) {
      const mime = f.type || (f.name.endsWith(".md") ? "text/markdown" : f.name.endsWith(".txt") ? "text/plain" : "");
      if (!isAcceptedMime(mime)) { setErr(`„${f.name}”: obsługujemy zdjęcia (jpg/png/webp/gif), PDF i txt/md.`); continue; }
      if (f.size > limits.maxFileMb * 1024 * 1024) { setErr(`„${f.name}” ma ponad ${limits.maxFileMb} MB (limit planu ${limits.label}).`); continue; }
      if (next.length >= limits.filesPerGeneration) { setErr(`Max ${limits.filesPerGeneration} plików na raz w planie ${limits.label}.`); break; }
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    if (into === "files") setFiles(next);
    else setShots(next.map((f) => shots.find((s) => s.file === f) ?? { file: f, url: URL.createObjectURL(f) }));
  };
  const allFiles = useMemo(() => [...shots.map((s) => s.file), ...files], [shots, files]);
  const canSubmit = mode === "prompt" ? hint.trim().length >= 3 : allFiles.length > 0 || text.trim().length >= 40;

  async function generate() {
    if (!canSubmit) return setErr(mode === "prompt" ? "Wpisz temat, np. „fotosynteza, klasa 7”." : "Dodaj chociaż jeden plik albo wklej więcej tekstu (min. 40 znaków).");
    setErr(null);
    setStep("generating");
    t0.current = Date.now();
    setProg({ step: 0, pct: 2 });
    try {
      const materialIds: string[] = [];
      if (mode !== "prompt") {
        for (const [i, f] of allFiles.entries()) {
          setProg({ step: 0, pct: Math.round(((i + 1) / (allFiles.length + 1)) * 20), detail: `${i + 1}/${allFiles.length}` });
          const mime = f.type || (f.name.endsWith(".md") ? "text/markdown" : "text/plain");
          const path = `${user.id}/${crypto.randomUUID()}.${extOf(f.name, mime)}`;
          const up = await supabase.storage.from("materials").upload(path, f, { contentType: mime, upsert: false });
          if (up.error) throw new Error(`Upload „${f.name}”: ${up.error.message}`);
          const ins = await supabase.from("materials").insert({ owner_id: user.id, storage_path: path, mime, size_bytes: f.size, name: f.name }).select("id").single();
          if (ins.error) throw new Error(`Zapis materiału: ${ins.error.message}`);
          materialIds.push((ins.data as { id: string }).id);
        }
      }
      setProg({ step: 1, pct: 22 });
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ subjectId: subject.id, materialIds, text: mode !== "prompt" && text.trim() ? text.trim() : undefined, options: { stage: stage ?? subject.stage, subjectName: subject.name, mode: mode === "prompt" ? "prompt" : "materials", hint: hint.trim() || undefined, levels, lang } }),
      });
      const j = (await res.json().catch(() => ({}))) as { topicId?: string; topic?: Topic; error?: string; code?: string; used?: number; limit?: number };
      if (!res.ok) {
        if (j.code === "limit_reached") throw new Error(`Limit generacji na ten miesiąc wyczerpany (${j.used}/${j.limit}). Pro zdejmuje limit — Ustawienia.`);
        throw new Error(j.error || `Błąd ${res.status}`);
      }
      invalidateLibrary();
      setProg({ step: 5, pct: 100 });
      setTopic(j.topic ?? null);
      setName(j.topic?.name ?? subject.name);
      setTimeout(() => setStep("ready"), 700);
    } catch (e) {
      setErr((e as Error).message);
      setStep(mode === "photo" ? "detected" : "add");
    }
  }
  // timed step animation while the API works (the route answers once, when the topic is stored)
  useEffect(() => {
    if (step !== "generating" || prog.step >= 5) return;
    const t = setInterval(() => {
      setProg((p) => {
        if (p.step === 0 || p.step >= 5) return p;
        const el = (Date.now() - t0.current) / 1000;
        const st = el < 25 ? 1 : el < 60 ? 2 : el < 110 ? 3 : 4;
        return { step: Math.max(p.step, st), pct: Math.min(94, Math.max(p.pct, Math.round(22 + Math.min(72, el * 0.55)))) };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [step, prog.step]);

  const back = () => router.push(`/app/s/${subject.id}`);
  const style = themeStyle(color);

  /* ---------- Scanner.html ---------- */
  if (step === "scan") {
    const last = shots[shots.length - 1];
    return (
      <div className="scanv">
        <div className="scantop">
          <button type="button" className="rb" aria-label="Zamknij aparat" onClick={() => (shots.length ? setStep("add") : back())}><Icon name="close" size={18} stroke={3} /></button>
          <div className="ttl">Strona {shots.length + 1}</div>
          <button type="button" className="rb" aria-label="Z galerii" onClick={() => gallery.current?.click()}><Icon name="image" size={19} stroke={2.4} /></button>
        </div>
        <div className="scanstage">
          <div className="scanpage">
            <Paper src={last?.url} />
            <div className="corner tl a-pulse" /><div className="corner tr a-pulse" /><div className="corner bl a-pulse" /><div className="corner br a-pulse" />
          </div>
          <div className="scanhint a-blink">{shots.length ? "Dodaj kolejną stronę albo kliknij Gotowe" : "Naciśnij spust — otworzy się aparat"}</div>
        </div>
        <div className="scanfoot">
          <div className="scanthumbs">
            {shots.map((s, i) => <div key={i} className="scanthumb a-pop"><Paper cls="thumb" src={s.url} /><span className="ok"><Icon name="check" size={12} stroke={3.4} /></span></div>)}
            <div className="scanthumb empty" />
          </div>
          <div className="scanctl">
            <button type="button" className="lnk" onClick={() => gallery.current?.click()}>Z galerii</button>
            <button type="button" className="shutter a-pulse" aria-label="Zrób zdjęcie" onClick={() => camera.current?.click()} />
            <button type="button" className="done" disabled={!shots.length} onClick={() => setStep("detected")}>Gotowe{shots.length ? ` · ${shots.length}` : ""}</button>
          </div>
          {err && <div className="filerow bad"><Icon name="alert" size={18} /><div className="grow"><div className="t">{err}</div></div></div>}
        </div>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hiddenfile" aria-label="Aparat" onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files, "shots"); e.target.value = ""; }} />
        <input ref={gallery} type="file" accept="image/*,application/pdf" multiple className="hiddenfile" aria-label="Galeria" onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files, "shots"); e.target.value = ""; }} />
      </div>
    );
  }

  /* ---------- Detected.html ---------- */
  if (step === "detected") {
    const n = shots.length, est = Math.max(6, n * 5);
    const test = tests.find((t) => t.subjectId === subject.id);
    return (
      <>
        <div className="blob a-float acid" aria-hidden="true" />
        <Head title="Rozpoznałem materiał" back={() => setStep("scan")} />
        <div className="screen active"><div className="scroll detv">
          <div className="dethero a-up">
            <div className="detpages"><div className="p1"><Paper src={shots[1]?.url} /></div><div className="p2"><Paper src={shots[0]?.url} /></div></div>
            <div><div className="t">{n} {n === 1 ? "strona" : n < 5 ? "strony" : "stron"}, ok. {est} pojęć</div><div className="s">Sprawdź, czy dobrze zgaduję — resztę zrobię sam.</div></div>
          </div>
          <div className="setcard detrows">
            <div className="detrow a-up d1"><span className="k">Przedmiot</span><span className="v">{noEmoji(subject.name)}</span><Link href="/app/catalog?add=1" className="lnk">zmień</Link></div>
            <div className="setsep" />
            <div className="detrow a-up d2"><span className="k">Dział</span><input className="v input" value={hint} placeholder="np. Oddychanie komórkowe (opcjonalnie)" aria-label="Dział" onChange={(e) => setHint(e.target.value)} /></div>
            <div className="setsep" />
            <div className="detrow a-up d3"><span className="k">Poziom</span><span className="v">{stage === "podstawowa" ? "Szkoła podstawowa" : stage === "liceum" ? "Liceum / technikum" : stage === "studia" ? "Studia" : "Inne"}</span><Link href="/app/levelpick?from=settings" className="lnk">zmień</Link></div>
          </div>
          <div className="eyebrow sec">Gdzie dodać?</div>
          <button type="button" className="where on a-pop"><div className="ico">{initial(subject.name)}</div><div className="grow"><div className="t">Do {noEmoji(subject.name)} — jako nowy temat</div><div className="s">pojawi się na liście tematów przedmiotu</div></div><span className="ck"><Icon name="check" size={14} stroke={3.4} /></span></button>
          <Link href="/app/catalog?add=1" className="where a-up d3"><div className="ico"><Icon name="plus" size={20} stroke={3} /></div><div className="grow"><div className="t">Inny przedmiot</div><div className="s">osobna ścieżka tylko z tych stron</div></div><span className="ck" /></Link>
          <button type="button" className="dettest a-up d4" onClick={() => (test ? router.push(`/app/testplan/${test.id}`) : openTestSheet(subject.id))}><Icon name="calendar" size={19} stroke={2.4} /><span>Mam z tego sprawdzian</span><Toggle on={!!test} sm label="Mam sprawdzian" onChange={() => (test ? router.push(`/app/testplan/${test.id}`) : openTestSheet(subject.id))} /></button>
          {err && <div className="filerow bad"><Icon name="alert" size={18} /><div className="grow"><div className="t">{err}</div></div></div>}
          <div className="addfoot"><button type="button" className="pill a-glow" onClick={generate}>TWÓRZ LEKCJĘ</button></div>
        </div></div>
      </>
    );
  }

  /* ---------- Generating.html ---------- */
  if (step === "generating") {
    const steps = mode === "prompt" ? STEPS_PROMPT : STEPS_GEN;
    return (
      <>
        <div className="blob a-float acid mid" aria-hidden="true" />
        <Head title="Nowy temat" back={() => { toast("Generowanie trwa w tle — temat pojawi się w przedmiocie", "bolt"); back(); }} step={2} />
        <div className="screen active"><div className="scroll genv">
          <div className="genring"><i className="a-spin" /><div className="in"><b>{prog.pct}%</b><span>gotowe</span></div></div>
          <div className="gentxt"><div className="t">Buduję temat</div><div className="s">Zwykle zajmuje to 1–3 minuty. Nie zamykaj karty.</div></div>
          <div className="gensteps">
            {steps.map((s, i) => (
              <div key={s} className={cn("genstep", i < prog.step && "done", i === prog.step && "cur")}>
                <div className={cn("dot", i === prog.step && "a-blink")}>{i < prog.step && <Icon name="check" size={15} stroke={3.6} />}</div>
                <span className="t">{i === 0 && prog.step === 0 && prog.detail ? `Wysyłam pliki ${prog.detail}` : s}</span>
                {i === 0 && allFiles.length > 0 && <span className="n">{allFiles.length} {allFiles.length === 1 ? "plik" : allFiles.length < 5 ? "pliki" : "plików"}</span>}
              </div>
            ))}
          </div>
          <div className="genstats">
            <div className="genstat a-pop d1"><b>{levels}</b><span>poziomów</span></div>
            <div className="genstat a-pop d2"><b>{topic ? allFlashcards(topic).length : "…"}</b><span>fiszki</span></div>
            <div className="genstat a-pop d3"><b>{topic ? allQuiz(topic).length : "…"}</b><span>pytania</span></div>
          </div>
          <div className="addfoot">
            {topic ? (
              <button type="button" className="genready a-pop" onClick={() => setStep("ready")}><div className="ico a-pulse"><Icon name="bolt" size={22} /></div><div className="grow"><div className="t">Temat gotowy</div><div className="s">sprawdź poziomy i zacznij</div></div><Icon name="chevron-right" size={20} className="chev" /></button>
            ) : (
              <button type="button" className="pill ghost" onClick={() => { toast("Generowanie trwa w tle — temat pojawi się w przedmiocie", "bolt"); back(); }}>DZIAŁAJ W TLE</button>
            )}
          </div>
        </div></div>
      </>
    );
  }

  /* ---------- SubjectReady.html ---------- */
  if (step === "ready" && topic) {
    const hues = SUBJECT_HUES.slice(0, 6);
    const saveColor = async (c: string) => {
      setColor(c);
      const { error } = await supabase.from("subjects").update({ accent2: c }).eq("id", subject.id);
      if (error) toast("Nie udało się zapisać koloru", "alert");
      else invalidateLibrary();
    };
    const saveName = async () => {
      const v = name.trim();
      if (!v || v === topic.name) return;
      const { error } = await supabase.from("topics").update({ name: v, content: { ...topic, name: v } as unknown as Record<string, unknown> }).eq("id", topic.id);
      if (error) toast("Nie udało się zapisać nazwy", "alert");
      else { setTopic({ ...topic, name: v }); invalidateLibrary(); }
    };
    return (
      <div className="contents" style={style}>
        <div className="blob a-float" aria-hidden="true" />
        <Head title="Sprawdź i nazwij" back={() => setStep("generating")} step={3} />
        <div className="screen active"><div className="scroll readyv">
          <div className="readycard">
            <div className="readyname">
              <div className="mono solid" aria-hidden="true">{initial(name)}</div>
              <div className="grow" style={{ minWidth: 0 }}><label className="label" htmlFor="subj-name">Nazwa</label><input id="subj-name" className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} /></div>
            </div>
            <div>
              <div className="label">Kolor</div>
              <div className="swatches">{hues.map((h) => <button key={h.color} type="button" className={cn("swatch", color.toLowerCase() === h.color.toLowerCase() && "on")} style={{ "--sw": h.color } as React.CSSProperties} aria-label={h.name} aria-pressed={color.toLowerCase() === h.color.toLowerCase()} onClick={() => saveColor(h.color)} />)}</div>
            </div>
          </div>
          <div className="sechdr"><span className="eyebrow sec">Wygenerowane poziomy</span><Link href={`/app/t/${topic.id}?tab=quiz`} className="link">Edytuj treść <Icon name="chevron-right" size={14} stroke={3} /></Link></div>
          <div className="lvrows">
            {topic.levels.map((l, i) => {
              const off = isLevelHidden(topic.id, l.id);
              const nt = (l.tasks ?? l.games ?? []).length;
              return (
                <div key={l.id} className={cn("lvrow a-up", "d" + Math.min(6, i + 1), off && "off")}>
                  <Icon name="grip" size={16} stroke={2.6} />
                  <div className="grow" style={{ minWidth: 0 }}><div className="t">{i + 1} · {noEmoji(l.title)}</div><div className="s">{off ? "wyłączony — nie było na zajęciach" : `${l.feed.length} dawek · ${l.flashcards.length} fiszek · ${l.quiz.length} pytań${nt ? ` · ${nt} zadań` : ""}`}</div></div>
                  <Toggle on={!off} sm label={`Poziom ${i + 1}`} onChange={(v) => setLevelHidden(topic.id, l.id, !v)} />
                </div>
              );
            })}
          </div>
          <div className="addfoot">
            <Link href={`/app/t/${topic.id}`} className="pill a-glow" onClick={() => router.refresh()}>ZACZNIJ NAUKĘ</Link>
            <Link href={`/app/share/${topic.id}`} className="pill text">UDOSTĘPNIJ KLASIE</Link>
          </div>
        </div></div>
      </div>
    );
  }

  /* ---------- AddSubject.html ---------- */
  const tiles: [Mode, string, string, string][] = [["text", "list", "Wklej tekst", "notatki, sylabus, konspekt"], ["photo", "camera", "Zdjęcia notatek", "tekst odczytany z fotek"], ["prompt", "bulb", "Samo hasło", "temat wg podstawy programowej"]];
  const added = allFiles.length + (text.trim() ? 1 : 0);
  return (
    <>
      <div className="blob a-float acid" aria-hidden="true" />
      <Head title="Nowy temat" sub={noEmoji(subject.name)} back={back} step={1} />
      <div className="screen active"><div className="scroll addv">
        <div className="addhead"><h1>{mode === "prompt" ? "Jaki temat?" : "Skąd wziąć materiał?"}</h1><p>{mode === "prompt" ? "Wpisz hasło, np. „fotosynteza” albo „tryby warunkowe”. Temat powstanie wg podstawy programowej dla Twojego etapu." : "Wrzuć prezentacje z zajęć, skrypt albo notatki. Z tego powstaną poziomy, fiszki i pytania."}</p>{me && <p>Plan <b>{limits.label}</b> · zostało <b>{left}</b> z {limits.generationsPerMonth} tematów w tym miesiącu</p>}</div>
        <button type="button" className={cn("addbig", mode !== "prompt" && "a-glow")} onClick={() => { setMode("file"); input.current?.click(); }}>
          <div className="ico"><Icon name="upload" size={24} stroke={2.8} /></div>
          <div className="grow"><div className="t">Wgraj pliki</div><div className="s">PDF, zdjęcia, txt — do {limits.filesPerGeneration} plików, {limits.maxFileMb} MB każdy</div></div>
        </button>
        <div className="addgrid">
          {tiles.map(([m, ic, t, s]) => (
            <button key={m} type="button" className={cn("addtile", mode === m && "on")} aria-pressed={mode === m} onClick={() => { setMode(m); if (m === "photo") setStep("scan"); }}>
              <div className="ico"><Icon name={ic} size={21} stroke={2.6} /></div>
              <div className="t">{t}</div>
              <div className="s">{s}</div>
            </button>
          ))}
        </div>
        {mode === "prompt" ? (
          <>
            <label className="label" htmlFor="hint">Temat</label>
            <input id="hint" className="input" value={hint} placeholder="np. fotosynteza, klasa 7" onChange={(e) => setHint(e.target.value)} />
          </>
        ) : (
          <>
            <div className={cn("dropzone", over && "over")} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e: DragEvent) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }} onClick={() => input.current?.click()} role="button" tabIndex={0}>
              przeciągnij pliki tutaj albo kliknij
            </div>
            {(mode === "text" || text) && (
              <>
                <label className="label" htmlFor="text">Tekst</label>
                <textarea id="text" className="input" rows={5} value={text} placeholder="wklej notatki, konspekt, zagadnienia (min. 40 znaków)" onChange={(e) => setText(e.target.value)} />
              </>
            )}
            <label className="label" htmlFor="hint2">Podpowiedź dla AI (opcjonalnie)</label>
            <input id="hint2" className="input" value={hint} placeholder="np. dział „Genetyka”, klasa 8" onChange={(e) => setHint(e.target.value)} />
          </>
        )}
        <div className="sechdr"><span className="eyebrow sec">Ustawienia</span></div>
        <div className="setcard">
          <div className="setrow"><div className="grow"><div className="t">Liczba poziomów</div><div className="s">od podstaw do trudniejszych</div></div><div className="egchips">{[3, 4, 5, 6].map((n) => <button key={n} type="button" className={cn("egchip", levels === n && "on")} onClick={() => setLevels(n)}>{n}</button>)}</div></div>
          <div className="setsep" />
          <div className="setrow"><div className="grow"><div className="t">Język obcy</div><div className="s">fiszki = słówka, quiz = tłumaczenia</div></div><Toggle on={lang} label="Język obcy" onChange={setLang} /></div>
        </div>
        {added > 0 && <div className="sechdr"><span className="eyebrow sec">Dodane ({added})</span></div>}
        {added > 0 && (
          <div className="filelist">
            {shots.map((s, i) => <div key={"s" + i} className={cn("filerow a-up", "d" + Math.min(6, i + 1))}><Icon name="camera" size={20} stroke={2.4} /><div className="grow"><div className="t">Zdjęcie {i + 1}</div><div className="s">{fmtMb(s.file.size)}</div></div><button type="button" className="x" aria-label={`Usuń zdjęcie ${i + 1}`} onClick={() => setShots(shots.filter((x) => x !== s))}><Icon name="close" size={14} stroke={3} /></button></div>)}
            {files.map((f, i) => <div key={f.name + f.size} className={cn("filerow a-up", "d" + Math.min(6, i + 1))}><Icon name={f.type.startsWith("image/") ? "image" : "file"} size={20} stroke={2.4} /><div className="grow"><div className="t">{f.name}</div><div className="s">{fmtMb(f.size)}</div></div><button type="button" className="x" aria-label={`Usuń plik ${f.name}`} onClick={() => setFiles(files.filter((x) => x !== f))}><Icon name="close" size={14} stroke={3} /></button></div>)}
            {text.trim() && <div className="filerow a-up d3"><Icon name="list" size={20} stroke={2.4} /><div className="grow"><div className="t">Wklejony tekst</div><div className="s">{text.trim().length.toLocaleString("pl-PL")} znaków</div></div><button type="button" className="x" aria-label="Usuń tekst" onClick={() => setText("")}><Icon name="close" size={14} stroke={3} /></button></div>}
          </div>
        )}
        {err && <div className="filerow bad"><Icon name="alert" size={18} /><div className="grow"><div className="t">{err}</div></div></div>}
        <div className="addfoot"><button type="button" className="pill a-glow" disabled={!canSubmit} onClick={generate}>UTWÓRZ TEMAT</button></div>
        <input ref={input} type="file" multiple accept="image/*,application/pdf,text/plain,text/markdown,.md,.txt" className="hiddenfile" aria-label="Pliki" onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
      </div></div>
    </>
  );
}
