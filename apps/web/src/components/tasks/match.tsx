"use client";
import { useRef, useState } from "react";
import { pl, shuffle, type MatchTask } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { Foot, ListBox, Title, type TaskApi } from "./common";

/** POŁĄCZ W PARY (TaskMatch.html): two shuffled columns, tap-tap; hit fades, miss shakes; mistakes = one "wrong". */
export function MatchTaskView({ task, api }: { task: MatchTask; api: TaskApi }) {
  const pairs = task.pairs.filter((p) => p && p.length >= 2);
  const n = pairs.length;
  const [L] = useState(() => shuffle(pairs.map((p, i) => ({ i, t: p[0] }))));
  const [R] = useState(() => shuffle(pairs.map((p, i) => ({ i, t: p[1] }))));
  const [selL, setSelL] = useState<number | null>(null);
  const [selR, setSelR] = useState<number | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [bad, setBad] = useState<number[] | null>(null);
  const mistakes = useRef(0);
  const busy = useRef(false);
  const finished = useRef(false);
  const tryPair = (l: number | null, r: number | null) => {
    if (l == null || r == null) return;
    if (l === r) {
      const nd = [...done, l];
      setDone(nd);
      setSelL(null);
      setSelR(null);
      if (nd.length >= n && !finished.current) {
        finished.current = true;
        setTimeout(() => api.finish(mistakes.current === 0, { e: mistakes.current ? <ListBox rows={pairs.map((p, k) => <span key={k}><b>{p[0]}</b> — {p[1]}</span>)} /> : task.e, sub: mistakes.current ? `${mistakes.current} ${pl(mistakes.current, "pomyłka", "pomyłki", "pomyłek")} po drodze` : "", src: task.src }), 500);
      }
    } else {
      mistakes.current++;
      busy.current = true;
      setBad([l, r]);
      setTimeout(() => {
        setBad(null);
        setSelL(null);
        setSelR(null);
        busy.current = false;
      }, 900);
    }
  };
  const pick = (side: "l" | "r", i: number) => {
    if (busy.current || done.includes(i)) return;
    if (side === "l") {
      const v = selL === i ? null : i;
      setSelL(v);
      tryPair(v, selR);
    } else {
      const v = selR === i ? null : i;
      setSelR(v);
      tryPair(selL, v);
    }
  };
  const left = n - done.length;
  const btn = (o: { i: number; t: string }, side: "l" | "r", k: number) => {
    const isDone = done.includes(o.i);
    const isBad = bad && ((side === "l" && bad[0] === o.i) || (side === "r" && bad[1] === o.i));
    const sel = (side === "l" && selL === o.i) || (side === "r" && selR === o.i);
    return (
      <button key={side + o.i} type="button" className={cn("mbtn", side, isDone ? "done a-pop" : "a-up d" + Math.min(6, k + 1), sel && "sel", isBad && "bad a-shake")} disabled={isDone} onClick={() => pick(side, o.i)}>
        {isDone && <Icon name="check" size={16} stroke={3.4} />}<span>{o.t}</span>
      </button>
    );
  };
  return (
    <>
      <div><Title>{task.title || "Połącz w pary"}</Title><div className="tsub">{left ? `${left === 1 ? "Została" : "Zostały"} ${left} ${pl(left, "para", "pary", "par")} z ${n}.` : "Wszystkie pary połączone."}</div></div>
      <div className="matchcols">
        <div className="mcol">{L.map((o, k) => btn(o, "l", k))}</div>
        <div className="mcol">{R.map((o, k) => btn(o, "r", k))}</div>
      </div>
      <Foot api={api}><button type="button" className="pill" disabled>{left ? "POŁĄCZ WSZYSTKIE PARY" : "GOTOWE"}</button></Foot>
    </>
  );
}
