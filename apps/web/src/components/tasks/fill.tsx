"use client";
import { useState } from "react";
import { checkFill, fillBank, type FillTask } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { CheckBtn, Title, useKeys, type TaskApi } from "./common";

/** UZUPEŁNIJ ZDANIE (TaskFill.html): {0},{1} slots, bank = blanks + distractors; tap tile → first free slot, tap slot → back. */
export function FillTaskView({ task, api }: { task: FillTask; api: TaskApi }) {
  const parts = String(task.text).split(/\{(\d+)\}/);
  const [tiles] = useState(() => fillBank(task).map((w, k) => ({ w, k })));
  const [slots, setSlots] = useState<(number | null)[]>(() => task.blanks.map(() => null));
  const [last, setLast] = useState(-1);
  const [locked, setLocked] = useState(false);
  const [per, setPer] = useState<boolean[] | null>(null);
  const [first, setFirst] = useState(true);
  const used = new Set(slots.filter((x): x is number => x != null));
  const firstEmpty = slots.indexOf(null);
  const put = (k: number) => {
    if (locked || used.has(k)) return;
    const free = slots.indexOf(null);
    if (free < 0) return;
    const next = [...slots];
    next[free] = k;
    setSlots(next);
    setLast(free);
    setFirst(false);
  };
  const take = (si: number) => {
    if (locked || slots[si] == null) return;
    const next = [...slots];
    next[si] = null;
    setSlots(next);
    setLast(-1);
  };
  const check = () => {
    if (locked || slots.some((x) => x == null)) return;
    setLocked(true);
    const r = checkFill(task, slots.map((k) => tiles[k!]!.w));
    setPer(r.per);
    const full = parts.map((p, idx) => (idx % 2 === 0 ? <span key={idx}>{p}</span> : <b key={idx}>{task.blanks[+p]}</b>));
    api.finish(r.ok, { e: r.ok ? task.e : <>{task.e ? <>{task.e}<br /><br /></> : null}{full}</>, sub: r.ok ? "" : "Poprawne zdanie niżej", src: task.src });
  };
  useKeys((e) => { if (e.key === "Enter") { e.preventDefault(); check(); } });
  return (
    <>
      <div><Title>{task.title || "Wstaw brakujące słowa"}</Title></div>
      <div className="fillcard a-up d1">
        <div className="filltxt">
          {parts.map((p, idx) => {
            if (idx % 2 === 0) return <span key={idx}>{p}</span>;
            const si = +p, t = slots[si];
            const cls = cn("slot", t != null && "filled", t != null && si === last && !locked && "a-pop", t == null && si === firstEmpty && "a-blink", per && (per[si] ? "ok" : "bad a-shake"));
            return <button key={idx} type="button" className={cls} data-s={si} aria-label={`Luka ${si + 1}`} disabled={locked} onClick={() => take(si)}>{t != null ? tiles[t]!.w : "?"}</button>;
          })}
        </div>
      </div>
      <div className="eyebrow">Do wyboru</div>
      <div className="bank">
        {tiles.map((t, k) => (
          <button key={k} type="button" className={cn("wordtile", first && "a-up d" + Math.min(6, k + 1), used.has(k) && "used")} disabled={used.has(k) || locked} onClick={() => put(k)}>{t.w}</button>
        ))}
      </div>
      {task.hint && <div className="hintbox a-up d3"><Icon name="bookmark" size={18} /><span>Podpowiedź: {task.hint}</span></div>}
      <CheckBtn api={api} disabled={locked || slots.some((x) => x == null)} onClick={check} />
    </>
  );
}
