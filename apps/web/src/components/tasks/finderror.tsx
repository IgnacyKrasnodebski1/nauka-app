"use client";
import { useState } from "react";
import type { FindErrorTask } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { CheckBtn, Title, useChooser, type TaskApi } from "./common";

/** ZNAJDŹ BŁĄD (FindError.html): sentences as tiles; after the check the false one is struck through + the fix. */
export function FindErrorTaskView({ task, api }: { task: FindErrorTask; api: TaskApi }) {
  const w = task.wrong | 0;
  const [fix, setFix] = useState<{ ok: boolean } | null>(null);
  const ch = useChooser(task.sentences.length, w, (sel, ok) => {
    setFix({ ok });
    api.finish(ok, { e: task.e, sub: ok ? "" : "Fałszywe było zdanie " + (w + 1), src: task.src });
  });
  return (
    <>
      <div><Title>{task.title || "Jedno zdanie jest fałszywe. Które?"}</Title></div>
      <div className="errcard">
        {task.sentences.map((s, k) => (
          <button key={k} type="button" className={cn("errsent", !ch.done && "a-up d" + Math.min(6, k + 1), ch.stateOf(k))} disabled={ch.done} onClick={() => ch.select(k)}>{s}</button>
        ))}
        <div className={cn("errfix", fix && "show", fix?.ok ? "ok" : "bad")}>
          {fix && <><div className="lbl">{fix.ok ? "Trafione" : "Fałszywe było zdanie " + (w + 1)}</div><div>{task.fix ? <>Poprawnie: <b>{task.fix}</b></> : `Zdanie ${w + 1} jest fałszywe.`}</div></>}
        </div>
      </div>
      <div className="notebox a-up d5"><Icon name="info" size={18} /><span>Po sprawdzeniu zobaczysz poprawione zdanie.</span></div>
      <CheckBtn api={api} disabled={ch.sel == null || ch.done} onClick={ch.check} />
    </>
  );
}
