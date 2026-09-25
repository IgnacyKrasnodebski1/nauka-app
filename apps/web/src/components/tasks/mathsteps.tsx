"use client";
import { useState } from "react";
import { pl, shuffle, type MathStepsTask } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { Foot, Title, useKeys, type TaskApi } from "./common";

interface Hist { ok: boolean; expr: string; note: string }

/** KROK PO KROKU (MathSteps.html): start expression + steps; each = pick the transformation from shuffled options + check. */
export function MathStepsTaskView({ task, api }: { task: MathStepsTask; api: TaskApi }) {
  const steps = task.steps;
  const [i, setI] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);
  const [tried, setTried] = useState<Set<number>>(new Set());
  const [order, setOrder] = useState<number[]>(() => shuffle((steps[0]?.options ?? []).map((_, k) => k)));
  const [locked, setLocked] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const s = steps[i];
  const check = () => {
    if (locked || sel == null || !s) return;
    const ok = sel === s.c;
    if (ok) {
      const nh = [...hist, { ok: true, expr: s.expr || s.options[s.c]!, note: s.note || "" }];
      setHist(nh);
      setTried(new Set());
      const ni = i + 1;
      setI(ni);
      setSel(null);
      if (ni >= steps.length) {
        setLocked(true);
        api.finish(mistakes === 0, { e: task.e, sub: mistakes ? `${mistakes} ${pl(mistakes, "pomyłka", "pomyłki", "pomyłek")} po drodze` : "", src: task.src });
        return;
      }
      setOrder(shuffle(steps[ni]!.options.map((_, k) => k)));
    } else {
      setMistakes((m) => m + 1);
      setTried(new Set([...tried, sel]));
      setHist([...hist, { ok: false, expr: s.options[sel]!, note: s.note || "Spróbuj inaczej." }]);
      setSel(null);
      setOrder(shuffle(s.options.map((_, k) => k)));
    }
  };
  useKeys((e) => {
    const k = e.key || "";
    const m = /^[1-5]$/.test(k) ? +k - 1 : -1;
    if (m >= 0 && s) { const opt = order[m]; if (opt != null && !tried.has(opt)) setSel(opt); }
    else if (k === "Enter" && sel != null) { e.preventDefault(); check(); }
  });
  const last = hist[hist.length - 1];
  return (
    <>
      <div><Title>{task.title || "Rozwiąż krok po kroku"}</Title></div>
      <div className="mathcard">
        <div className="mrow start"><span className="mexpr">{task.start}</span><span className="mnote">zadanie</span></div>
        {hist.map((h, k) => (
          <div key={k} className={cn("mrow", h.ok ? "ok" : "bad", k === hist.length - 1 && (h.ok ? "a-pop" : "a-shake"))}><span className="mexpr">{h.expr}</span><span className="mnote">{h.ok ? h.note : "nie tak"}</span><Icon name={h.ok ? "check" : "close"} size={16} stroke={3.4} /></div>
        ))}
        {last && !last.ok && <div className="mexp"><Icon name="bulb" size={16} /><span>{last.note}</span></div>}
        {i < steps.length && <div className="mrow next a-blink"><span>następny krok?</span></div>}
      </div>
      <div className="eyebrow">{i < steps.length ? "Wybierz następny krok" : "Rozwiązane"}</div>
      <div className="mgrid">
        {s && order.map((k, pos) => (
          <button key={`${i}-${k}`} type="button" className={cn("mopt a-up d" + Math.min(6, pos + 1), sel === k && "sel", tried.has(k) && "dim")} disabled={locked || tried.has(k)} onClick={() => setSel(k)}>{s.options[k]}</button>
        ))}
      </div>
      <Foot api={api}><button type="button" className="pill" disabled={sel == null || locked} onClick={check}>SPRAWDŹ</button></Foot>
    </>
  );
}
