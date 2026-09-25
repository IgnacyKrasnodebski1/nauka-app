"use client";
import { useRef, useState } from "react";
import { hotspotHit, pl, type HotspotTask } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { Foot, Title, type TaskApi } from "./common";

interface Pin { x: number; y: number; r: number; cls: string; label?: string; id: number }

/** WSKAŻ NA SCHEMACIE (Hotspot.html): image + touch layer; targets asked in order; hit = ring + label, miss = red dot + shake. */
export function HotspotTaskView({ task, api }: { task: HotspotTask; api: TaskApi }) {
  const tg = task.targets, n = tg.length;
  const [i, setI] = useState(0);
  const [pins, setPins] = useState<Pin[]>([]);
  const [shake, setShake] = useState(false);
  const mistakes = useRef(0);
  const busy = useRef(false);
  const locked = useRef(false);
  const img = useRef<HTMLDivElement>(null);
  const idc = useRef(0);
  const isSvg = /^\s*<svg/i.test(task.image);
  const end = () => {
    locked.current = true;
    api.finish(mistakes.current === 0, { e: task.e, sub: mistakes.current ? `${mistakes.current} ${pl(mistakes.current, "pomyłka", "pomyłki", "pomyłek")} po drodze` : "", src: task.src });
  };
  const hit = (t: HotspotTask["targets"][number]) => {
    setPins((p) => [...p, { x: t.x, y: t.y, r: t.r, cls: "ok a-pop", label: t.name, id: idc.current++ }]);
    const ni = i + 1;
    setI(ni);
    if (ni >= n) setTimeout(end, 500);
  };
  const onClick = (e: React.MouseEvent) => {
    if (locked.current || busy.current || i >= n || !img.current) return;
    const r = img.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100, y = ((e.clientY - r.top) / r.height) * 100;
    const t = tg[i]!;
    if (hotspotHit(t, x, y, r.height / r.width)) hit(t);
    else {
      mistakes.current++;
      busy.current = true;
      setShake(true);
      const id = idc.current++;
      setPins((p) => [...p, { x, y, r: 4, cls: "miss a-pop", id }]);
      setTimeout(() => { setPins((p) => p.filter((q) => q.id !== id)); setShake(false); busy.current = false; }, 700);
    }
  };
  const reveal = () => {
    if (locked.current || busy.current || i >= n) return;
    mistakes.current++;
    busy.current = true;
    const t = tg[i]!;
    const id = idc.current++;
    setPins((p) => [...p, { x: t.x, y: t.y, r: t.r, cls: "reveal a-blink", label: t.name, id }]);
    setTimeout(() => {
      setPins((p) => p.map((q) => (q.id === id ? { ...q, cls: "reveal" } : q)));
      busy.current = false;
      const ni = i + 1;
      setI(ni);
      if (ni >= n) end();
    }, 1100);
  };
  return (
    <>
      <Title>{i < n ? "Dotknij: " + tg[i]!.name : "Wszystko wskazane"}</Title>
      <div className={cn("hotcard a-up d1", shake && "a-shake")}>
        <div className="hotimg" ref={img}>
          {/* eslint-disable-next-line @next/next/no-img-element -- task image is inline content (data URI or external) */}
          {isSvg ? <div dangerouslySetInnerHTML={{ __html: task.image }} /> : <img src={task.image} alt={task.alt || ""} draggable={false} />}
          <div className="hotlayer" aria-label="Dotknij właściwego miejsca na schemacie" onClick={onClick}>
            {pins.map((p) => (
              <div key={p.id} className="hotpin" style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.r * 2}%` }}>
                <i className={`hotring ${p.cls}`} />{p.label && <b className={`hottag ${p.cls.split(" ")[0]}`}>{p.label}</b>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="hotchips a-up d2">
        {tg.map((t, k) => <span key={k} className={cn("hotchip", k < i && "done", k === i && "cur")}>{k < i && <Icon name="check" size={13} stroke={3.4} />}{k === i + 1 ? "Kolejne: " : ""}{t.name}</span>)}
      </div>
      <Foot api={api}><button type="button" className="pill ghost" onClick={reveal}>POKAŻ, GDZIE TO JEST</button></Foot>
    </>
  );
}
