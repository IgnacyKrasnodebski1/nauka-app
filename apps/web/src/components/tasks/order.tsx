"use client";
import { useRef, useState } from "react";
import { checkOrder, shuffledOrder, type OrderTask } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { CheckBtn, ListBox, Title, useKeys, type TaskApi } from "./common";

/** USTAW KOLEJNOŚĆ (TaskOrder.html): drag by the handle (pointer events) or ▲▼ arrows; exact order passes. */
export function OrderTaskView({ task, api }: { task: OrderTask; api: TaskApi }) {
  const items = task.items;
  const n = items.length;
  const [order, setOrder] = useState<number[]>(() => shuffledOrder(n));
  const [locked, setLocked] = useState(false);
  const [per, setPer] = useState<boolean[] | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const move = (from: number, to: number) => {
    if (locked || to < 0 || to >= n) return;
    const o = [...order];
    const [x] = o.splice(from, 1);
    o.splice(to, 0, x!);
    setOrder(o);
  };
  const onDown = (e: React.PointerEvent, pos: number) => {
    if (locked) return;
    e.preventDefault();
    const list = listRef.current!;
    const row = (e.currentTarget as HTMLElement).closest<HTMLElement>(".orderitem")!;
    const grab = e.clientY - row.getBoundingClientRect().top;
    setDrag(order[pos]!);
    try { list.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    let cur = pos;
    const rows = () => [...list.children] as HTMLElement[];
    const onMove = (ev: PointerEvent) => {
      const top = ev.clientY - grab;
      const r = rows()[cur]!;
      r.style.transform = "";
      const nat = r.getBoundingClientRect();
      r.style.transform = `translateY(${top - nat.top}px)`;
      const mid = top + nat.height / 2;
      const others = rows().filter((x) => x !== r);
      let idx = others.findIndex((x) => { const rc = x.getBoundingClientRect(); return mid < rc.top + rc.height / 2; });
      if (idx < 0) idx = others.length;
      if (idx !== cur) {
        r.style.transform = "";
        setOrder((o) => { const c = [...o]; const [x] = c.splice(cur, 1); c.splice(idx, 0, x!); return c; });
        cur = idx;
      }
    };
    const onUp = () => {
      list.removeEventListener("pointermove", onMove);
      list.removeEventListener("pointerup", onUp);
      list.removeEventListener("pointercancel", onUp);
      rows().forEach((x) => (x.style.transform = ""));
      setDrag(null);
    };
    list.addEventListener("pointermove", onMove);
    list.addEventListener("pointerup", onUp);
    list.addEventListener("pointercancel", onUp);
  };
  const check = () => {
    if (locked) return;
    setLocked(true);
    const r = checkOrder(task, order);
    setPer(order.map((it, pos) => it === pos));
    api.finish(r.ok, { e: r.ok ? task.e : <>{task.e ? <>{task.e}<br /><br /></> : null}<ListBox rows={items.map((t, i) => <span key={i}><b>{i + 1}.</b> {t}</span>)} /></>, sub: r.ok ? "" : "Poprawna kolejność niżej", src: task.src });
  };
  useKeys((e) => { if (e.key === "Enter") { e.preventDefault(); check(); } });
  return (
    <>
      <div><Title>{task.title || "Ustaw kolejność"}</Title><div className="tsub">Przeciągnij za uchwyt albo użyj strzałek, żeby ułożyć od pierwszego do ostatniego.</div></div>
      <div className="orderlist" ref={listRef}>
        {order.map((it, pos) => (
          <div key={it} className={cn("orderitem", drag === it && "drag", per && (per[pos] ? "ok" : "bad"))} data-i={it}>
            <span className="onum">{pos + 1}</span>
            <span className="otxt">{items[it]}</span>
            <button type="button" className="ud" aria-label="Przesuń wyżej" disabled={pos === 0 || locked} onClick={() => move(pos, pos - 1)}><Icon name="chevron-up" size={18} /></button>
            <button type="button" className="ud" aria-label="Przesuń niżej" disabled={pos === n - 1 || locked} onClick={() => move(pos, pos + 1)}><Icon name="chevron-down" size={18} /></button>
            <span className="handle" aria-hidden="true" onPointerDown={(e) => onDown(e, pos)}><Icon name="grip" size={18} /></span>
          </div>
        ))}
      </div>
      <CheckBtn api={api} disabled={locked} onClick={check} label="SPRAWDŹ KOLEJNOŚĆ" />
    </>
  );
}
