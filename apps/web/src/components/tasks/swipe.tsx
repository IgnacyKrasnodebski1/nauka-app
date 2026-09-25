"use client";
import { useRef, useState } from "react";
import { shuffle, type SwipeTask } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { Foot, ListBox, Title, useKeys, type TaskApi } from "./common";

/** DWIE KATEGORIE (Swipe.html): zones left/right, card stack, drag with tilt (dx/14°), stamp from 30 px, answer from 80 px. */
export function SwipeTaskView({ task, api }: { task: SwipeTask; api: TaskApi }) {
  const [cards] = useState(() => shuffle(task.cards));
  const n = cards.length, L = task.left || "Lewo", R = task.right || "Prawo";
  const [i, setI] = useState(0);
  const [results, setResults] = useState<(boolean | undefined)[]>([]);
  const [fly, setFly] = useState<{ side: "l" | "r"; ok: boolean } | null>(null);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [zone, setZone] = useState<{ side: "l" | "r"; ok: boolean } | null>(null);
  const wrong = useRef<SwipeTask["cards"]>([]);
  const busy = useRef(false);
  const end = () => {
    const bad = wrong.current.length;
    api.finish(bad === 0, { e: bad ? <ListBox rows={wrong.current.map((c, k) => <span key={k}><b>{c.front}</b> — {c.side === "left" ? L : R}{c.e ? ". " + c.e : ""}</span>)} /> : task.e, sub: bad ? `Nietrafione: ${bad} z ${n}` : "", src: task.src });
  };
  const answer = (side: "left" | "right") => {
    if (busy.current || i >= n) return;
    busy.current = true;
    const c = cards[i]!;
    const ok = (c.side === "right") === (side === "right");
    setResults((r) => { const nr = [...r]; nr[i] = ok; return nr; });
    if (!ok) wrong.current.push(c);
    const s = side === "left" ? "l" : "r";
    setZone({ side: s, ok });
    setFly({ side: s, ok });
    setDrag(null);
    setTimeout(() => {
      setZone(null);
      setFly(null);
      busy.current = false;
      if (i + 1 >= n) end();
      else setI(i + 1);
    }, ok ? 420 : 800);
  };
  const onDown = (e: React.PointerEvent) => {
    if (busy.current) return;
    const x0 = e.clientX, y0 = e.clientY;
    const card = e.currentTarget as HTMLElement;
    let dx = 0;
    try { card.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const onMove = (ev: PointerEvent) => { dx = ev.clientX - x0; setDrag({ dx, dy: (ev.clientY - y0) * 0.25 }); };
    const onUp = () => {
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerup", onUp);
      card.removeEventListener("pointercancel", onUp);
      if (Math.abs(dx) > 80) answer(dx < 0 ? "left" : "right");
      else setDrag(null);
    };
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerup", onUp);
    card.addEventListener("pointercancel", onUp);
  };
  useKeys((e) => { if (e.key === "ArrowLeft" || e.key === "1") answer("left"); else if (e.key === "ArrowRight" || e.key === "2") answer("right"); });
  const c = cards[i];
  const toL = drag ? drag.dx < -30 : false, toR = drag ? drag.dx > 30 : false;
  return (
    <>
      <div className="trow"><Title>{task.title || `${L} czy ${R}?`}</Title><span className="tcount">{Math.min(i + 1, n)} / {n}</span></div>
      <div className="swipestage">
        <div className={cn("szone l", toL && "near", zone?.side === "l" && (zone.ok ? "okk" : "badd"))}><span>{L}</span></div>
        <div className={cn("szone r", toR && "near", zone?.side === "r" && (zone.ok ? "okk" : "badd"))}><span>{R}</span></div>
        <div className="scard back" style={{ visibility: i + 1 < n ? undefined : "hidden" }} />
        {c && (
          <div key={i} className={cn("scard front", !drag && !fly && "a-pop", drag && "grab", toL && "to-l", toR && "to-r", fly && (fly.ok ? "okk" : "badd"), fly && "fly-" + fly.side)} style={drag ? { transform: `translate(${drag.dx}px,${drag.dy}px) rotate(${drag.dx / 14}deg)` } : undefined} onPointerDown={onDown}>
            <div className="stamp l">{L}</div><div className="stamp r">{R}</div>
            <div className={cn("sfront", String(c.front).length > 14 && "long")}>{c.front}</div>
            <div className="ssub">{c.sub || ""}</div>
          </div>
        )}
        <div className="dots" aria-hidden="true">{cards.map((_, k) => <i key={k} className={results[k] === true ? "ok" : results[k] === false ? "bad" : k === i ? "cur a-blink" : ""} />)}</div>
      </div>
      <Foot api={api}>
        <div className="swbtns">
          <button type="button" className="swbtn l" aria-label={L} onClick={() => answer("left")}><Icon name="back" size={18} stroke={3} /><span>{L}</span></button>
          <button type="button" className="swbtn r" aria-label={R} onClick={() => answer("right")}><span>{R}</span><Icon name="chevron-right" size={18} stroke={3} /></button>
        </div>
      </Foot>
    </>
  );
}
