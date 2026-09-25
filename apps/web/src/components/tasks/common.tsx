"use client";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { TaskSource } from "@nauka/shared";
import { Icon } from "@/components/ui/icons";
import { KEYS } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** What a task reports when it ends (legacy api.finish(ok, {e, sub})). */
export interface TaskFeedback {
  e?: ReactNode;
  sub?: string;
  src?: TaskSource;
}
export interface TaskApi {
  finish(ok: boolean, fb: TaskFeedback): void;
  /** where the foot buttons go (.lessonfoot) — null renders them inline */
  footEl: HTMLElement | null;
  /** typeterm hint: −2 XP through the store's addXp */
  onHintXp?(): void;
}

/** Foot buttons portalled into the lesson foot. */
export function Foot({ api, children }: { api: TaskApi; children: ReactNode }) {
  const node = <div className="tfoot">{children}</div>;
  return api.footEl ? createPortal(node, api.footEl) : node;
}

/** Keyboard handler while mounted (skipped inside inputs / textareas). */
export function useKeys(fn: ((e: KeyboardEvent) => void) | null) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (document.getElementById("sheet")) return;
      ref.current?.(e);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
}

export function ListBox({ rows }: { rows: ReactNode[] }) {
  return <div className="tflist">{rows.map((r, i) => <div key={i}>{r}</div>)}</div>;
}

export function Title({ children, sm, cls }: { children: ReactNode; sm?: boolean; cls?: string }) {
  return <div className={cn("ttitle", sm && "sm", cls)}>{children}</div>;
}

/**
 * Single choice + SPRAWDŹ (thesis, scenario, chart): legacy chooser(). Renders the check button in the foot; after the
 * check every option gets .correct / .wrong.a-shake / .dim and the letter turns into check/close.
 */
export function useChooser(n: number, correct: number, onDone: (sel: number, ok: boolean) => void) {
  const [sel, setSel] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const select = (i: number) => {
    if (done || i < 0 || i >= n) return;
    setSel(i);
  };
  const check = () => {
    if (done || sel == null) return;
    setDone(true);
    onDone(sel, sel === correct);
  };
  useKeys((e) => {
    const k = (e.key || "").toLowerCase();
    const m = /^[1-5]$/.test(k) ? +k - 1 : "abcde".indexOf(k);
    if (k.length === 1 && m >= 0 && m < n) select(m);
    else if (e.key === "Enter" && sel != null) {
      e.preventDefault();
      check();
    }
  });
  const stateOf = (i: number): "" | "sel" | "correct" | "wrong" | "dim" => (!done ? (sel === i ? "sel" : "") : i === correct ? "correct" : i === sel ? "wrong" : "dim");
  const animOf = (i: number): string => (!done ? "" : i === correct ? (sel === correct ? "a-pop" : "a-glow") : i === sel ? "a-shake" : "");
  return { sel, done, select, check, stateOf, animOf };
}

/** Letter key inside an option, swapped for check/close after the check. */
export function OptKey({ i, state }: { i: number; state: string }) {
  return <span className="k">{state === "correct" ? <Icon name="check" size={18} stroke={3.6} /> : state === "wrong" ? <Icon name="close" size={17} stroke={3.6} /> : KEYS[i]}</span>;
}

export function CheckBtn({ api, disabled, onClick, label = "SPRAWDŹ", ghost }: { api: TaskApi; disabled?: boolean; onClick: () => void; label?: string; ghost?: boolean }) {
  return (
    <Foot api={api}>
      <button type="button" className={cn("pill", ghost && "ghost")} disabled={disabled} onClick={onClick}>{label}</button>
    </Foot>
  );
}

/* ---------------- pointer drag of .wordtile from a pool onto drop zones (sort, timeline, chain) ---------------- */
export interface DragOpts {
  /** selector for the drop zones (get .hot while dragging, .over under the pointer) */
  targets: string;
  onDrop(i: number, zone: HTMLElement | null): void;
  locked(): boolean;
}
/**
 * Legacy tileDrag(): pointer events, the tile follows the finger, zone under the pointer via elementFromPoint,
 * auto-scroll near the edge of the scrolling container. A plain tap (< 8 px) leaves the tile's onClick alone.
 */
export function useTileDrag(poolRef: RefObject<HTMLElement | null>, opts: DragOpts) {
  const o = useRef(opts);
  useEffect(() => {
    o.current = opts;
  });
  useEffect(() => {
    const pool = poolRef.current;
    if (!pool) return;
    const down = (e: PointerEvent) => {
      const t = (e.target as HTMLElement).closest<HTMLButtonElement>(".wordtile");
      if (!t || t.disabled || o.current.locked()) return;
      const i = +(t.dataset.i ?? -1);
      const r = t.getBoundingClientRect();
      const gx = e.clientX - r.left, gy = e.clientY - r.top;
      let moved = false;
      const sc = [pool.closest<HTMLElement>(".task"), pool.closest<HTMLElement>(".scroll")].find((x) => x && x.scrollHeight > x.clientHeight + 2) ?? null;
      const st0 = sc ? sc.scrollTop : 0;
      let lx = e.clientX, ly = e.clientY, autoInt: ReturnType<typeof setInterval> | null = null;
      const zones = () => [...document.querySelectorAll<HTMLElement>(o.current.targets)];
      const zoneAt = (x: number, y: number) => {
        const u = document.elementFromPoint(x, y);
        return u ? u.closest<HTMLElement>(o.current.targets) : null;
      };
      const place = () => {
        const ds = sc ? sc.scrollTop - st0 : 0;
        t.style.transform = `translate(${lx - (r.left + gx)}px,${ly - (r.top + gy) + ds}px)`;
        const z = zoneAt(lx, ly);
        zones().forEach((b) => b.classList.toggle("over", b === z));
      };
      const onMove = (ev: PointerEvent) => {
        lx = ev.clientX;
        ly = ev.clientY;
        const dx = lx - (r.left + gx), dy = ly - (r.top + gy);
        if (!moved && Math.hypot(dx, dy) < 8) return;
        if (!moved) {
          moved = true;
          t.classList.add("drag");
          t.classList.remove("a-bob");
          t.style.pointerEvents = "none";
          zones().forEach((z) => z.classList.add("hot"));
          try {
            pool.setPointerCapture(ev.pointerId);
          } catch {
            /* ignore */
          }
          if (sc) autoInt = setInterval(() => { const cr = sc.getBoundingClientRect(); const d = ly < cr.top + 70 ? -10 : ly > cr.bottom - 70 ? 10 : 0; if (d) { sc.scrollTop += d; place(); } }, 16);
        }
        place();
      };
      const onUp = (ev: PointerEvent) => {
        pool.removeEventListener("pointermove", onMove);
        pool.removeEventListener("pointerup", onUp);
        pool.removeEventListener("pointercancel", onUp);
        if (autoInt) clearInterval(autoInt);
        if (!moved) return;
        const z = zoneAt(ev.clientX, ev.clientY);
        t.style.transform = "";
        t.style.pointerEvents = "";
        t.classList.remove("drag");
        zones().forEach((b) => b.classList.remove("hot", "over"));
        o.current.onDrop(i, z);
      };
      pool.addEventListener("pointermove", onMove);
      pool.addEventListener("pointerup", onUp);
      pool.addEventListener("pointercancel", onUp);
    };
    pool.addEventListener("pointerdown", down);
    return () => pool.removeEventListener("pointerdown", down);
  }, [poolRef]);
}

/** Bar / line chart as inline SVG (ChartRead.html): one series, colours by class, values above marks, x labels below. */
export function ChartSvg({ kind, xs, ys }: { kind: "bar" | "line"; xs: string[]; ys: number[] }) {
  const W = 330, H = 178, top = 22, base = 150, left = 14, right = 320;
  const n = Math.max(1, xs.length);
  const max = Math.max(1e-9, ...ys);
  const step = (right - left) / n;
  const yOf = (v: number) => base - (Math.max(0, v) / max) * (base - top);
  const xOf = (i: number) => left + step * i + step / 2;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const fmtV = (v: number) => String(v).replace(".", ",");
  const bw = Math.min(34, step * 0.66);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${kind === "line" ? "Wykres liniowy" : "Wykres słupkowy"}: ${xs.map((x, i) => x + ": " + fmtV(ys[i] ?? 0)).join(", ")}`}>
      {[0.5, 1].map((f) => <line key={f} className="cgrid" x1={left - 4} y1={r1(yOf(max * f))} x2={right + 5} y2={r1(yOf(max * f))} />)}
      <line className="caxis" x1={left - 4} y1={base} x2={right + 5} y2={base} />
      {kind === "line" ? (
        <>
          <polyline className="cline" points={ys.map((v, i) => r1(xOf(i)) + "," + r1(yOf(v))).join(" ")} />
          {ys.map((v, i) => (
            <g key={i}><circle className="cdot" cx={r1(xOf(i))} cy={r1(yOf(v))} r="5" /><text className="cval" x={r1(xOf(i))} y={r1(yOf(v)) - 11} textAnchor="middle">{fmtV(v)}</text></g>
          ))}
        </>
      ) : (
        ys.map((v, i) => (
          <g key={i}><rect className="cbar" x={r1(xOf(i) - bw / 2)} y={r1(yOf(v))} width={r1(bw)} height={r1(base - yOf(v))} rx="7" /><text className="cval" x={r1(xOf(i))} y={r1(yOf(v)) - 7} textAnchor="middle">{fmtV(v)}</text></g>
        ))
      )}
      {xs.map((x, i) => <text key={i} className="clab" x={r1(xOf(i))} y={base + 20} textAnchor="middle">{x}</text>)}
    </svg>
  );
}

/** Boss monster in the subject colour (classes b1…b6 → tokens). */
export function BossSvg({ size, cls }: { size: number; cls?: string }) {
  return (
    <svg className={cn("boss", cls)} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <polygon className="b1" points="60,6 108,33 108,87 60,114 12,87 12,33" />
      <polygon className="b2" points="60,22 94,41 94,79 60,98 26,79 26,41" />
      <path className="b3" d="M34 44l18 8M86 44l-18 8" />
      <circle className="b4" cx="45" cy="60" r="10" /><circle className="b4" cx="75" cy="60" r="10" />
      <circle className="b6" cx="47" cy="62" r="5" /><circle className="b6" cx="73" cy="62" r="5" />
      <path className="b5" d="M46 84q14-10 28 0" />
    </svg>
  );
}
