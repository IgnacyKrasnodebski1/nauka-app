"use client";
import type { ThesisTask } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { CheckBtn, useChooser, type TaskApi } from "./common";

/** CZYJA TO TEZA (WhoSaid.html): quote card, 2-column grid {name, sub}; selected = violet. */
export function ThesisTaskView({ task, api }: { task: ThesisTask; api: TaskApi }) {
  const opts = task.options;
  const ch = useChooser(opts.length, task.c, (sel, ok) => api.finish(ok, { e: task.e, sub: ok ? "" : "Poprawnie: " + (opts[task.c]?.name ?? ""), src: task.src }));
  return (
    <>
      <div className="thcard a-pop d1"><Icon name="quote" size={34} /><div className="thtext">{task.thesis}</div></div>
      <div className="eyebrow">{task.q || "Kto tak twierdzi?"}</div>
      <div className="thgrid">
        {opts.map((o, k) => (
          <button key={k} type="button" className={cn("thopt", !ch.done && "a-up d" + Math.min(6, k + 1), ch.stateOf(k), ch.animOf(k))} disabled={ch.done} onClick={() => ch.select(k)}>
            <span className="n">{o.name}</span>{o.sub && <span className="s">{o.sub}</span>}
          </button>
        ))}
      </div>
      <CheckBtn api={api} disabled={ch.sel == null || ch.done} onClick={ch.check} />
    </>
  );
}
