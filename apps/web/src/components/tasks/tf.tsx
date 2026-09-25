"use client";
import { useEffect, useRef, useState } from "react";
import { shuffle, type TfTask } from "@nauka/shared";
import { fmtSecs } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { Foot, ListBox, useKeys, type TaskApi } from "./common";

/** PRAWDA / FAŁSZ (TaskTrueFalse.html): statement by statement, dots, optional timed round; passed when all are right. */
export function TfTaskView({ task, api }: { task: TfTask; api: TaskApi }) {
  const [sts] = useState(() => shuffle(task.statements));
  const n = sts.length, total = task.seconds || 0;
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(total);
  const [results, setResults] = useState<(boolean | undefined)[]>([]);
  const [exp, setExp] = useState<{ ok: boolean; text: string } | null>(null);
  const busy = useRef(false), ended = useRef(false);
  const wrong = useRef<TfTask["statements"]>([]);
  const resRef = useRef<(boolean | undefined)[]>([]);
  const end = () => {
    if (ended.current) return;
    ended.current = true;
    const bad = wrong.current.length;
    api.finish(bad === 0, { e: bad ? <ListBox rows={wrong.current.map((w, k) => <span key={k}><b>{w.s}</b> — {w.v ? "prawda" : "fałsz"}{w.e ? ". " + w.e : ""}</span>)} /> : task.e, sub: bad ? `Nietrafione: ${bad} z ${n}` : "", src: task.src });
  };
  const answer = (v: boolean) => {
    if (busy.current || ended.current || i >= n) return;
    const s = sts[i]!;
    const ok = !!s.v === v;
    resRef.current[i] = ok;
    setResults([...resRef.current]);
    if (!ok) wrong.current.push(s);
    setExp({ ok, text: (ok ? "Zgadza się" : "Nie — to " + (s.v ? "prawda" : "fałsz")) + (s.e ? ". " + s.e : ".") });
    busy.current = true;
    setTimeout(() => {
      busy.current = false;
      setExp(null);
      if (i + 1 >= n) end();
      else setI(i + 1);
    }, s.e ? 1700 : 800);
  };
  useEffect(() => {
    if (!total) return;
    const t = setInterval(() => {
      setLeft((l) => {
        const nl = l - 1;
        if (nl <= 0) {
          clearInterval(t);
          for (let k = 0; k < n; k++) if (resRef.current[k] == null) { resRef.current[k] = false; wrong.current.push(sts[k]!); }
          setResults([...resRef.current]);
          setTimeout(end, 0);
        }
        return Math.max(0, nl);
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useKeys((e) => {
    const k = (e.key || "").toLowerCase();
    if (k === "p" || k === "1" || k === "arrowleft") answer(true);
    else if (k === "f" || k === "2" || k === "arrowright") answer(false);
  });
  const s = sts[i];
  return (
    <>
      {total > 0 && (
        <div className="timerbar">
          <div className="grow"><div className="eyebrow">Runda na czas</div><div className="bar"><i style={{ width: `${Math.max(0, (left / total) * 100)}%` }} /></div></div>
          <span className="ttime"><Icon name="clock" size={17} /><b className={cn(left <= 10 && "a-blink")}>{fmtSecs(Math.max(0, left))}</b></span>
        </div>
      )}
      <div key={i} className={cn("tfcard a-up", exp && (exp.ok ? "okk" : "badd"))}>
        <div className="tfq">{s?.s}</div>
        <span className="tfmeta">{i + 1} z {n}</span>
      </div>
      <div className="dots" aria-hidden="true">{sts.map((_, k) => <i key={k} className={results[k] === true ? "ok" : results[k] === false ? "bad" : ""} />)}</div>
      <div className={cn("tfexp", exp && "show", exp?.ok ? "ok" : "bad")}>{exp?.text}</div>
      <Foot api={api}>
        <div className="tfbtns">
          <button type="button" className="tfbtn yes" onClick={() => answer(true)}><Icon name="check" size={24} stroke={3.4} /><span>PRAWDA</span></button>
          <button type="button" className="tfbtn no" onClick={() => answer(false)}><Icon name="close" size={24} stroke={3.4} /><span>FAŁSZ</span></button>
        </div>
      </Foot>
    </>
  );
}
