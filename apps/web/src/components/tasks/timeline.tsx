"use client";
import { useRef, useState } from "react";
import { checkTimeline, leftText, shuffle, type TimelineTask } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { CheckBtn, ListBox, Title, useKeys, useTileDrag, type TaskApi } from "./common";

/** OŚ CZASU (Timeline.html): rows = years ascending, events shuffled in the pool; tap tile → slot, drag onto a slot. */
export function TimelineTaskView({ task, api }: { task: TimelineTask; api: TaskApi }) {
  const evs = task.events.map((e, k) => ({ ...e, k }));
  const rows = [...evs].sort((a, b) => a.year - b.year);
  const [poolOrder] = useState(() => shuffle(evs.map((e) => e.k)));
  const [slots, setSlots] = useState<(number | null)[]>(() => rows.map(() => null));
  const [sel, setSel] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [per, setPer] = useState<boolean[] | null>(null);
  const [first, setFirst] = useState(true);
  const poolRef = useRef<HTMLDivElement>(null);
  const put = (si: number, k: number) => { setSlots((s) => s.map((v, i) => (i === si ? k : v))); setSel(null); setFirst(false); };
  useTileDrag(poolRef, { targets: ".tlslot.empty", locked: () => locked, onDrop: (k, z) => { if (z) put(+(z.dataset.s ?? 0), k); } });
  const firstEmpty = slots.indexOf(null);
  const left = slots.filter((x) => x == null).length;
  const check = () => {
    if (locked || left > 0) return;
    setLocked(true);
    const r = checkTimeline(task, slots as number[]);
    setPer(r.per);
    api.finish(r.ok, { e: r.ok ? task.e : <>{task.e ? <>{task.e}<br /><br /></> : null}<ListBox rows={rows.map((x, i) => <span key={i}><b>{x.year}</b> — {x.label}</span>)} /></>, sub: r.ok ? "" : "Poprawna oś czasu niżej", src: task.src });
  };
  useKeys((e) => { if (e.key === "Enter") { e.preventDefault(); check(); } });
  return (
    <>
      <div><Title>{task.title || "Przypnij wydarzenia do dat"}</Title></div>
      <div className="tl">
        <i className="tlaxis" />
        {rows.map((r, si) => {
          const t = slots[si], cur = si === firstEmpty;
          return (
            <div key={si} className="tlrow">
              <span className="tlyear">{r.year}</span>
              <i className={cn("tldot", t != null && "on", t == null && cur && "cur a-pulse")} />
              {t != null ? (
                <button type="button" className={cn("tlev", !per && "a-pop", per && (per[si] ? "ok" : "bad a-shake"))} data-s={si} disabled={locked} aria-label={`${r.year}: ${evs[t]!.label}, dotknij, żeby cofnąć`} onClick={() => { if (locked) return; setSlots((s) => s.map((v, i) => (i === si ? null : v))); setSel(null); }}>
                  <Icon name="check" size={16} stroke={3.4} /><span>{evs[t]!.label}</span>
                </button>
              ) : (
                <div className={cn("tlslot empty", cur && "cur a-blink")} data-s={si} role="button" aria-label={`Miejsce na wydarzenie z roku ${r.year}`} onClick={() => { if (locked || sel == null) return; put(si, sel); }}>
                  {cur && <span>{sel != null ? "upuść tutaj" : "tu trafi wydarzenie"}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="tsep" />
      <div className="eyebrow">{left ? leftText(left) : "Wszystko przypięte"}</div>
      <div className="bank pool" ref={poolRef}>
        {poolOrder.map((k, pos) => !slots.includes(k) && (
          <button key={k} type="button" className={cn("wordtile", sel === k ? "sel a-bob" : first ? "a-up d" + Math.min(6, pos + 1) : "")} data-i={k} onClick={() => { if (locked) return; setSel(sel === k ? null : k); }}>{evs[k]!.label}</button>
        ))}
      </div>
      <CheckBtn api={api} disabled={left > 0 || locked} onClick={check} />
    </>
  );
}
