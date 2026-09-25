"use client";
import { useRef, useState } from "react";
import { chainBank, checkChain, type ChainTask } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { CheckBtn, ListBox, Title, useKeys, useTileDrag, type TaskApi } from "./common";

/** ŁAŃCUCH PRZYCZYN (CauseChain.html): column of steps with arrows; given visible, the rest are slots; bank = missing + distractors. */
export function ChainTaskView({ task, api }: { task: ChainTask; api: TaskApi }) {
  const steps = task.steps;
  const given = new Set(task.given.map(Number));
  const [tiles] = useState(() => chainBank(task));
  const [slots, setSlots] = useState<(number | null | -1)[]>(() => steps.map((_, k) => (given.has(k) ? -1 : null)));
  const [locked, setLocked] = useState(false);
  const [per, setPer] = useState<boolean[] | null>(null);
  const [first, setFirst] = useState(true);
  const poolRef = useRef<HTMLDivElement>(null);
  const put = (k: number, i: number) => { setSlots((s) => s.map((v, idx) => (idx === k ? i : v))); setFirst(false); };
  useTileDrag(poolRef, { targets: ".chslot.empty", locked: () => locked, onDrop: (i, z) => { if (z) put(+(z.dataset.s ?? 0), i); } });
  const firstEmpty = slots.indexOf(null);
  const check = () => {
    if (locked || slots.some((x) => x == null)) return;
    setLocked(true);
    const filled: Record<number, string> = {};
    slots.forEach((t, k) => { if (t != null && t !== -1) filled[k] = tiles[t]!; });
    const r = checkChain(task, filled);
    setPer(r.per);
    api.finish(r.ok, { e: r.ok ? task.e : <>{task.e ? <>{task.e}<br /><br /></> : null}<ListBox rows={steps.map((s, k) => <span key={k}><b>{k + 1}.</b> {s}</span>)} /></>, sub: r.ok ? "" : "Poprawny łańcuch niżej", src: task.src });
  };
  useKeys((e) => { if (e.key === "Enter") { e.preventDefault(); check(); } });
  return (
    <>
      <div><Title>{task.title || "Co się dzieje po kolei?"}</Title></div>
      <div className="chain">
        {steps.map((s, k) => {
          const t = slots[k];
          return (
            <div key={k} className="contents">
              {k > 0 && <div className="charrow"><Icon name="arrow-down" size={22} stroke={3} /></div>}
              {t === -1 ? (
                <div className={cn("chstep given", first && "a-up d" + Math.min(6, k + 1))}>{s}</div>
              ) : t != null ? (
                <button type="button" className={cn("chstep filled", !per && "a-pop", per && (per[k] ? "ok" : "bad a-shake"))} data-s={k} disabled={locked} aria-label={`${tiles[t]}, dotknij, żeby cofnąć`} onClick={() => { if (locked) return; setSlots((sl) => sl.map((v, idx) => (idx === k ? null : v))); }}>
                  <Icon name="check" size={16} stroke={3.4} /><span>{tiles[t]}</span>
                </button>
              ) : (
                <div className={cn("chslot empty", k === firstEmpty && "cur a-blink")} data-s={k} role="button" aria-label={`Krok ${k + 1}`}>{k === firstEmpty && <span>co dalej?</span>}</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="bank pool" ref={poolRef}>
        {tiles.map((w, i) => {
          const used = slots.includes(i);
          return <button key={i} type="button" className={cn("wordtile", used ? "used" : first ? "a-up d" + Math.min(6, i + 1) : "")} data-i={i} disabled={used || locked} onClick={() => { if (locked || used) return; const free = slots.indexOf(null); if (free >= 0) put(free, i); }}>{w}</button>;
        })}
      </div>
      <CheckBtn api={api} disabled={locked || slots.some((x) => x == null)} onClick={check} />
    </>
  );
}
