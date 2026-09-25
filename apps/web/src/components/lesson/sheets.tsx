"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { foldAnswer, formatCountdown, HEART_REFILL_GEMS, HEARTS_MAX, type QuizQuestion, type TaskSource, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { KEYS, noEmoji } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Sheet, SheetHead } from "@/components/ui/sheet";
import { Icon } from "@/components/ui/icons";

const ORD = ["", "Pierwsza", "Druga", "Trzecia", "Czwarta", "Piąta", "Szósta", "Siódma", "Ósma", "Dziewiąta", "Dziesiąta"];
export const comboText = (c: number) => (c >= 2 ? (ORD[c] || c + ".") + " poprawna z rzędu" : "Tak trzymaj");

/** Question context for "Zgłoś / popraw" and SourceView. */
export interface QCtx {
  topic: Topic;
  levelId: string;
  qi: number | null;
}
export interface AnswerFb {
  /** explanation */
  e?: ReactNode;
  sub?: string;
  src?: TaskSource;
  /** the quiz question (enables "Wyjaśnij inaczej") */
  q?: QuizQuestion;
}

/** "Źródło" line (legacy srcLine) → SourceView. */
export function SrcLine({ src, onClick }: { src?: TaskSource; onClick: () => void }) {
  if (!src) return null;
  const parts = [src.material ? "materiał" : "", src.page ? "s. " + src.page : ""].filter(Boolean).join(" · ");
  return (
    <button type="button" className="rsrc" onClick={onClick}>
      <Icon name="file" size={14} />
      <span>{parts ? <><b>Źródło:</b> {parts}</> : <b>Źródło</b>}{src.quote ? ` — „${src.quote}”` : ""}</span>
      <Icon name="chevron-right" size={14} className="chev" />
    </button>
  );
}

type View = "main" | "explain" | "source" | "edit";

/**
 * Panel after an answer: ok (QuizCorrect.html) / bad (QuizWrong.html) with combo, XP chip, explanation, source line,
 * "Wyjaśnij inaczej" (Explain.html + AI tutor), "Zgłoś / popraw" (EditContent.html). One sheet, internal views.
 */
export function AnswerSheet({ ok, fb, xp, mult, combo, onNext, ctx, onCards }: { ok: boolean; fb: AnswerFb; xp?: number; mult?: number; combo?: number; onNext: () => void; ctx?: QCtx; onCards?: () => void }) {
  const [view, setView] = useState<View>("main");
  const [q, setQ] = useState<QuizQuestion | undefined>(fb.q);
  const fired = useRef(false);
  const next = () => {
    if (fired.current) return;
    fired.current = true;
    onNext();
  };
  const sub = fb.sub != null ? fb.sub : q && q.c != null ? "Poprawna: odpowiedź " + KEYS[q.c] : "";
  const canEdit = !!(ctx && ctx.qi != null && q);
  if (view === "source") return <SourceSheet src={fb.src ?? q?.src} ctx={canEdit ? ctx : undefined} onBack={() => setView("main")} onBad={canEdit ? () => setView("edit") : undefined} />;
  if (view === "edit" && ctx && ctx.qi != null) return <EditSheet topic={ctx.topic} levelId={ctx.levelId} qi={ctx.qi} onBack={() => setView("main")} onSaved={(nq) => { setQ((old) => ({ ...(old ?? nq), ...nq })); setView("main"); }} />;
  if (view === "explain" && q) return <ExplainSheet q={q} ctx={ctx} onBack={() => setView("main")} onCards={onCards} />;
  return (
    <Sheet kind={ok ? "ok" : "bad"} back={false} label={ok ? "Dobrze" : "Nie tym razem"}>
      <div className="srow">
        <div className={cn("sico", ok && "a-pop d2")}>{ok ? <Icon name="check" size={26} stroke={3.6} /> : <Icon name="close" size={24} stroke={3.6} />}</div>
        <div className="grow"><div className="st">{ok ? "Dobrze!" : "Nie tym razem"}</div>{(ok || sub) && <div className="ss">{ok ? comboText(combo ?? 0) : sub}</div>}</div>
        {ok && xp != null && <span className="xpchip a-pop d3">+{xp} XP{(mult ?? 1) > 1 ? " ×" + mult : ""}</span>}
      </div>
      {fb.e ? (
        <div className="sbox"><div className="lbl">{ok ? "Dlaczego" : "Zapamiętaj"}</div><div>{fb.e}</div><SrcLine src={fb.src ?? q?.src} onClick={() => setView("source")} /></div>
      ) : (
        <SrcLine src={fb.src ?? q?.src} onClick={() => setView("source")} />
      )}
      {ok ? (
        <button type="button" className="pill" data-primary onClick={next}>DALEJ</button>
      ) : (
        <div className="sbtns">
          {q && <button type="button" className="pill ghost red" onClick={() => setView("explain")}>WYJAŚNIJ INACZEJ</button>}
          <button type="button" className="pill red" data-primary onClick={next}>DALEJ</button>
        </div>
      )}
      {!ok && canEdit && <button type="button" className="pill text sm" onClick={() => setView("edit")}><Icon name="edit" size={15} /> Zgłoś / popraw pytanie</button>}
    </Sheet>
  );
}

/* ---------------- Explain.html: explanations from the material + a fresh one from the AI tutor ---------------- */
const STOP = new Set(["jest", "jak", "czym", "ktore", "ktory", "ktora", "jaki", "jaka", "jakie", "oraz", "albo", "lub", "nie", "tak", "dla", "sie", "przez", "tego", "tym", "ten", "czy", "ile", "kto", "gdzie", "kiedy", "moze", "jego", "jej", "ich", "tylko", "bardzo", "oznacza", "polega", "rozni", "przyklad", "wedlug", "miedzy", "pod", "nad", "przy", "bez", "jako", "tzw", "wobec", "ktorych", "ktorym", "czego", "czemu", "dlaczego", "zawsze", "nigdy", "wszystkie", "nazywa", "nazywamy", "byla", "byly", "beda", "bedzie", "jednak", "wtedy", "niz", "ktorego", "robi", "sa"]);
const words = (s: string) => foldAnswer(String(s || "").replace(/<[^>]+>/g, " ")).split(" ").filter((w) => w.length >= 4 && !STOP.has(w));
const stem = (w: string) => (w.length > 6 ? w.slice(0, -2) : w.length > 4 ? w.slice(0, -1) : w);
function overlap(qs: string[], txt: string | undefined): number {
  const t = new Set(words(txt ?? "").map(stem));
  let k = 0;
  for (const w of qs) if (t.has(w)) k++;
  return k;
}
export function explainFor(q: QuizQuestion, topic?: Topic, levelId?: string) {
  if (!topic) return { card: null, feed: null };
  const qs = [...new Set(words(q.q + " " + (q.a[q.c] ?? "")).map(stem))];
  const lv = topic.levels.find((l) => l.id === levelId);
  const lvOrder = lv ? [lv, ...topic.levels.filter((l) => l !== lv)] : topic.levels;
  let card: { t: string; d: string } | null = null, cs = 0;
  let feed: { title: string; real?: string; mnemo?: string; body: string } | null = null, fs = 0;
  for (const l of lvOrder) {
    for (const c of l.flashcards) { const sc = overlap(qs, c.t) * 3 + overlap(qs, c.d); if (sc > cs) { cs = sc; card = c; } }
    for (const f of l.feed.filter((x) => x.real || x.mnemo)) { const sc = overlap(qs, f.title) * 3 + overlap(qs, f.body) + overlap(qs, f.real) + overlap(qs, f.mnemo); if (sc > fs) { fs = sc; feed = f; } }
  }
  return { card, feed };
}

export function ExplainSheet({ q, ctx, onBack, onCards }: { q: QuizQuestion; ctx?: QCtx; onBack: () => void; onCards?: () => void }) {
  const { authHeaders } = useApp();
  const { card, feed } = useMemo(() => explainFor(q, ctx?.topic, ctx?.levelId), [q, ctx]);
  const [ai, setAi] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chips: string[] = [];
  const parts: ReactNode[] = [];
  parts.push(<span key="a"><span className="lbl">Poprawna odpowiedź</span><b>{q.a[q.c]}</b></span>);
  if (card) { parts.push(<span key="c"><span className="lbl">Fiszka</span><b>{card.t}</b> — <span dangerouslySetInnerHTML={{ __html: card.d }} /></span>); chips.push("Fiszka"); }
  if (feed?.real) { parts.push(<span key="r"><span className="lbl">Prościej</span><span dangerouslySetInnerHTML={{ __html: feed.real }} /></span>); chips.push("Prościej"); }
  if (feed?.mnemo) { parts.push(<span key="m"><span className="lbl">Zapamiętaj</span><span dangerouslySetInnerHTML={{ __html: feed.mnemo }} /></span>); chips.push("Zapamiętaj"); }
  if (!card && !feed) { parts.push(<span key="e"><span className="lbl">Innymi słowy</span>{q.e || "Zapamiętaj poprawną odpowiedź i wróć do fiszek z tego poziomu."}</span>); chips.push("Wyjaśnienie"); }
  if (ai != null) chips.push("AI");
  async function askAi() {
    if (!ctx || busy) return;
    setBusy(true);
    setAi("");
    try {
      const res = await fetch("/api/tutor", { method: "POST", headers: { "content-type": "application/json", ...authHeaders() }, body: JSON.stringify({ topicId: ctx.topic.id, levelId: ctx.levelId, question: `Wyjaśnij inaczej, prostym językiem i na przykładzie, dlaczego na pytanie „${q.q}” poprawna odpowiedź to „${q.a[q.c]}”. Krótko, 3–5 zdań.`, history: [] }) });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Błąd ${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setAi(acc);
      }
    } catch (e) {
      setAi("Nie udało się pobrać wyjaśnienia: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet kind="explain" onClose={onBack} label="Wyjaśnijmy inaczej">
      <div className="exhead"><div className="ico a-pop"><Icon name="bulb" size={24} stroke={2.6} /></div><div className="grow"><div className="st2">Wyjaśnijmy inaczej</div></div></div>
      <div className="exchips">{chips.map((c, i) => <span key={c} className={cn("exchip", i === 0 && "on")}>{c}</span>)}</div>
      <div className="exbox a-up d2">
        {parts.map((p, i) => <span key={i}>{i > 0 && <div className="exsep" />}{p}</span>)}
        {ai != null && <><div className="exsep" /><span className="lbl">AI — świeże wyjaśnienie</span>{ai || <span className="spinner" aria-label="piszę…" />}</>}
      </div>
      {ai == null && <div className="exnote a-up d3"><Icon name="bulb" size={15} /><span>To wyjaśnienia z materiałów. Nowe, dopasowane do tego pytania, napisze tutor AI.</span></div>}
      <div className="sbtns">
        {onCards && <button type="button" className="pill ghost" onClick={onCards}>Do fiszek</button>}
        <button type="button" className="pill cyan" data-primary onClick={onBack}>ROZUMIEM</button>
      </div>
      {ctx && ai == null && <button type="button" className="pill text sm" disabled={busy} onClick={askAi}><Icon name="bulb" size={15} /> Jeszcze inaczej — z AI</button>}
    </Sheet>
  );
}

/* ---------------- SourceView.html ---------------- */
export function SourceSheet({ src, ctx, onBack, onBad }: { src?: TaskSource; ctx?: QCtx; onBack: () => void; onBad?: () => void }) {
  const { supabase } = useApp();
  const s = src ?? {};
  const [img, setImg] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!s.material) return;
    let alive = true;
    supabase.from("materials").select("storage_path,mime,name").eq("id", s.material).maybeSingle().then(async ({ data }) => {
      const m = data as { storage_path: string; mime: string; name: string | null } | null;
      if (!alive || !m) return;
      setName(m.name);
      if (m.mime.startsWith("image/")) {
        const { data: u } = await supabase.storage.from("materials").createSignedUrl(m.storage_path, 600);
        if (alive && u?.signedUrl) setImg(u.signedUrl);
      }
    });
    return () => { alive = false; };
  }, [s.material, supabase]);
  const sub = [name ? name : s.material ? "materiał" : "", s.page ? "strona " + s.page : ""].filter(Boolean).join(" · ") || "materiał źródłowy";
  return (
    <Sheet kind="source" onClose={onBack} label="Skąd to pytanie?">
      <SheetHead title="Skąd to pytanie?" sub={sub} onClose={onBack} />
      <div className="srcpage a-up d1">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, not an optimizable asset */}
        {img ? <img src={img} alt={name ?? "strona materiału"} style={{ width: "100%", borderRadius: 12, display: "block" }} /> : (
          <div className="pg"><i className="h" />{[70, 58, 72, 46, 64, 60].map((w, i) => <i key={i} style={{ width: w + "%" }} />)}<i className="hl a-glow" style={{ width: "54%" }} />{[66, 52, 62, 50].map((w, i) => <i key={"b" + i} style={{ width: w + "%" }} />)}</div>
        )}
        {!img && <div className="srcnote"><Icon name={s.material ? "file" : "wifi"} size={15} /><span>{s.material ? "Podgląd dostępny dla zdjęć — dla PDF i tekstu tylko cytat" : ctx?.topic.source === "prompt" ? "Temat z hasła — bez pliku źródłowego" : "Brak odnośnika do pliku"}</span></div>}
      </div>
      <div className="srcquote a-up d2"><div className="eyebrow">Zaznaczony fragment</div><div className="qt">{s.quote ? `„${s.quote}”` : "Brak cytatu w danych — jest tylko odnośnik do materiału."}</div></div>
      <div className="sbtns">
        {onBad && <button type="button" className="pill ghost" onClick={onBad}>Pytanie jest złe</button>}
        <button type="button" className="pill gold" data-primary onClick={onBack}>WRACAM</button>
      </div>
    </Sheet>
  );
}

/* ---------------- EditContent.html ---------------- */
export function EditSheet({ topic, levelId, qi, onBack, onSaved }: { topic: Topic; levelId: string; qi: number; onBack: () => void; onSaved: (q: QuizQuestion) => void }) {
  const { overrides, setOverride, toast } = useApp();
  const level = topic.levels.find((l) => l.id === levelId)!;
  const base = level.quiz[qi]!;
  const key = `${topic.id}:${levelId}:${qi}`;
  const ov = overrides[key];
  const cur = ov && ov !== true ? ov : base;
  const [q, setQ] = useState(cur.q);
  const [a, setA] = useState([...cur.a]);
  const [c, setC] = useState(cur.c);
  const [e, setE] = useState(cur.e || "");
  const save = () => {
    if (!q.trim() || a.some((x) => !x.trim())) return toast("Uzupełnij pytanie i wszystkie odpowiedzi", "alert");
    const same = q.trim() === base.q && e.trim() === (base.e || "") && c === base.c && a.every((x, i) => x.trim() === base.a[i]);
    const nq: QuizQuestion = { q: q.trim(), a: a.map((x) => x.trim()), c, e: e.trim(), src: base.src };
    setOverride(topic.id, levelId, qi, same ? null : nq);
    toast(same ? "Bez zmian — oryginał" : "Poprawka zapisana", "check");
    onSaved(same ? base : nq);
  };
  return (
    <Sheet kind="edit" onClose={onBack} label="Popraw pytanie">
      <SheetHead title="Popraw pytanie" sub={`${noEmoji(topic.short || topic.name)} · ${noEmoji(level.title)} · pytanie ${qi + 1} z ${level.quiz.length}`} onClose={onBack} />
      <div className="infobox a-up"><Icon name="edit" size={18} /><span>{ov ? "To pytanie ma już twoją poprawkę." : "Poprawka zostanie zapisana na twoim koncie."} Zastąpi pytanie w lekcji, quizie, egzaminie i powtórce.</span></div>
      <label className="edlbl a-up d1" htmlFor="edq">Treść pytania</label>
      <textarea className="edta" id="edq" rows={2} value={q} onChange={(ev) => setQ(ev.target.value)} />
      <div className="edlbl a-up d2">Odpowiedzi — zaznacz poprawną</div>
      <div className="edopts a-up d2">
        {a.map((x, i) => (
          <div key={i} className={cn("edopt", i === c && "on")}>
            <button type="button" className="edradio" role="radio" aria-checked={i === c} aria-label={`Poprawna: ${KEYS[i]}`} onClick={() => setC(i)}><i /></button>
            <span className="k">{KEYS[i]}</span>
            <input className="edin" type="text" value={x} aria-label={`Odpowiedź ${KEYS[i]}`} onChange={(ev) => setA(a.map((y, k) => (k === i ? ev.target.value : y)))} />
          </div>
        ))}
      </div>
      <label className="edlbl a-up d3" htmlFor="ede">Wyjaśnienie</label>
      <textarea className="edta" id="ede" rows={2} value={e} onChange={(ev) => setE(ev.target.value)} />
      {ov && <button type="button" className="pill ghost sm" onClick={() => { setOverride(topic.id, levelId, qi, null); toast("Przywrócono oryginał", "refresh"); onSaved(base); }}><Icon name="refresh" size={16} stroke={2.8} /> Przywróć oryginał</button>}
      <button type="button" className="pill" onClick={save}>ZAPISZ ZMIANY</button>
    </Sheet>
  );
}

/* ---------------- NoHearts.html ---------------- */
export function NoHeartsSheet({ inLesson, onLeave, onResume, cardsHref }: { inLesson: boolean; onLeave: () => void; onResume?: () => void; cardsHref: string }) {
  const { hearts, gems, refillHearts, toast } = useApp();
  const [eta, setEta] = useState(hearts.nextInMs ?? 0);
  useEffect(() => {
    const t0 = Date.now(), base = hearts.nextInMs ?? 0;
    const t = setInterval(() => setEta(Math.max(0, base - (Date.now() - t0))), 1000);
    return () => clearInterval(t);
  }, [hearts.nextInMs]);
  useEffect(() => {
    if (hearts.hearts > 0 && onResume) {
      onResume();
      toast("Życie wróciło", "heart");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hearts.hearts]);
  const short = gems < HEART_REFILL_GEMS;
  return (
    <Sheet kind="nohearts" onClose={onLeave} label="Koniec żyć">
      <div className="nhh">{Array.from({ length: HEARTS_MAX }, (_, i) => <Icon key={i} name="heart" size={30} fill={false} stroke={2.2} />)}</div>
      <div className="nht"><div className="st a-pop d1">Koniec żyć</div><div className="ss">Kolejne życie wraca za <b className="a-blink">{formatCountdown(eta || 60000)}</b>. Możesz też odzyskać je od razu.</div></div>
      <Link href={cardsHref} className="nhcard a-glow" onClick={() => { try { sessionStorage.setItem("recall_heartquest", "10"); } catch { /* ignore */ } toast("Przejrzyj 10 fiszek — wraca życie", "heart"); }}>
        <div className="ico"><Icon name="refresh" size={24} stroke={2.8} /></div>
        <div className="grow"><div className="t">Powtórz 10 fiszek</div><div className="s">odzyskujesz jedno życie · za darmo</div></div>
        <Icon name="chevron-right" size={20} />
      </Link>
      <button type="button" className={cn("nhcard cyan", short && "short")} onClick={() => { if (short) return toast(`Brakuje ${HEART_REFILL_GEMS - gems} gemów`, "gem"); if (refillHearts()) { toast("Życia uzupełnione: −" + HEART_REFILL_GEMS + " gemów", "heart", "a-pop"); if (inLesson && onResume) onResume(); else onLeave(); } }}>
        <div className="ico"><Icon name="gem" size={24} /></div>
        <div className="grow"><div className="t">Uzupełnij wszystkie</div><div className="s">{HEART_REFILL_GEMS} gemów · {short ? `masz ${gems} — brakuje ${HEART_REFILL_GEMS - gems}` : `zostanie ${gems - HEART_REFILL_GEMS}`}</div></div>
        <Icon name="chevron-right" size={20} />
      </button>
      <button type="button" className="pill text" data-primary onClick={onLeave}>WRÓĆ PÓŹNIEJ</button>
    </Sheet>
  );
}
