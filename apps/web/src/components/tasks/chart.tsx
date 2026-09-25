"use client";
import type { ChartTask } from "@nauka/shared";
import { KEYS } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { ChartSvg, CheckBtn, OptKey, Title, useChooser, type TaskApi } from "./common";

/** WYKRES (ChartRead.html): card with label + one-series chart, question, A–D. */
export function ChartTaskView({ task, api }: { task: ChartTask; api: TaskApi }) {
  const ch = useChooser(task.a.length, task.c, (sel, ok) => api.finish(ok, { e: task.e, sub: ok ? "" : "Poprawna: odpowiedź " + KEYS[task.c], src: task.src }));
  return (
    <>
      <div className="chartcard a-up d1"><div className="chartlbl">{task.chart.label || ""}</div><ChartSvg kind={task.chart.kind} xs={task.chart.x} ys={task.chart.y.map(Number)} /></div>
      <Title sm cls="a-up d2">{task.q}</Title>
      <div className="qopts">
        {task.a.map((a, k) => {
          const st = ch.stateOf(k);
          return (
            <button key={k} type="button" className={cn("qopt sm", !ch.done && "a-up d" + Math.min(6, k + 2), st, ch.animOf(k))} disabled={ch.done} onClick={() => ch.select(k)}>
              <OptKey i={k} state={st} /><span className="t">{a}</span>
            </button>
          );
        })}
      </div>
      <CheckBtn api={api} disabled={ch.sel == null || ch.done} onClick={ch.check} />
    </>
  );
}
