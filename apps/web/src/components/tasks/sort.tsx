"use client";
import { useRef, useState } from "react";
import { checkSort, shuffle, type SortTask } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { CheckBtn, ListBox, Title, useKeys, useTileDrag, type TaskApi } from "./common";

/** PRZYPISZ DO KATEGORII (TaskSort.html): 2–4 buckets as drop zones + pool; tap tile then bucket, or drag. */
export function SortTaskView({ task, api }: { task: SortTask; api: TaskApi }) {
  const buckets = task.buckets.slice(0, 4);
  const [items] = useState(() => { const out: { t: string; b: number }[] = []; buckets.forEach((b, bi) => b.items.forEach((t) => out.push({ t, b: bi }))); return out; });
  const [poolOrder] = useState(() => shuffle(items.map((_, i) => i)));
  const [at, setAt] = useState<(number | null)[]>(() => items.map(() => null));
  const [sel, setSel] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [wrong, setWrong] = useState<string[] | null>(null);
  const poolRef = useRef<HTMLDivElement>(null);
  const place = (i: number, bi: number | null) => setAt((a) => a.map((v, k) => (k === i ? bi : v)));
  useTileDrag(poolRef, { targets: ".bucket", locked: () => locked, onDrop: (i, z) => { if (z) place(i, +(z.dataset.b ?? 0)); setSel(null); } });
  const left = at.filter((x) => x == null).length;
  const check = () => {
    if (locked || left > 0) return;
    setLocked(true);
    const placement: Record<string, number> = {};
    items.forEach((it, i) => (placement[it.t] = at[i]!));
    const r = checkSort(task, placement);
    setWrong(r.wrong);
    api.finish(r.ok, { e: r.ok ? task.e : <>{task.e ? <>{task.e}<br /><br /></> : null}<ListBox rows={buckets.map((b, k) => <span key={k}><b>{b.name}:</b> {b.items.join(", ")}</span>)} /></>, sub: r.ok ? "" : "Poprawny podział niżej", src: task.src });
  };
  useKeys((e) => { if (e.key === "Enter") { e.preventDefault(); check(); } });
  return (
    <>
      <div><Title>{task.title || "Przypisz do kategorii"}</Title><div className="tsub">Wybierz kafelek, potem kategorię — albo przeciągnij.</div></div>
      <div className="buckets">
        {buckets.map((b, bi) => (
          <div key={bi} className={cn("bucket", sel != null && "hot")} data-b={bi} role="button" onClick={() => { if (locked || sel == null) return; place(sel, bi); setSel(null); }}>
            <div className="bhead">{b.name}</div>
            {items.map((it, i) => at[i] === bi && (
              <button key={i} type="button" className={cn("bitem", wrong && (wrong.includes(it.t) ? "bad a-shake" : "ok"))} disabled={locked} onClick={(e) => { e.stopPropagation(); if (locked) return; place(i, null); setSel(null); }}>{it.t}</button>
            ))}
            <div className="bdrop">{sel != null && <span>upuść tutaj</span>}</div>
          </div>
        ))}
      </div>
      <div className="tsep" />
      <div className="eyebrow">{left ? `Zostało ${left}` : "Wszystko przypisane"}</div>
      <div className="bank pool" ref={poolRef}>
        {poolOrder.map((i) => at[i] == null && (
          <button key={i} type="button" className={cn("wordtile", sel === i && "sel a-bob")} data-i={i} onClick={() => { if (locked) return; setSel(sel === i ? null : i); }}>{items[i]!.t}</button>
        ))}
      </div>
      <CheckBtn api={api} disabled={left > 0 || locked} onClick={check} label={left ? "PRZYPISZ WSZYSTKIE" : "SPRAWDŹ"} />
    </>
  );
}
