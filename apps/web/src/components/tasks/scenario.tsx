"use client";
import type { ScenarioTask } from "@nauka/shared";
import { KEYS } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { CheckBtn, OptKey, Title, useChooser, type TaskApi } from "./common";

/** SCENARIUSZ (Scenario.html): "Sytuacja" card, question, A–D like the quiz (.qopt.sm). */
export function ScenarioTaskView({ task, api }: { task: ScenarioTask; api: TaskApi }) {
  const ch = useChooser(task.a.length, task.c, (sel, ok) => api.finish(ok, { e: task.e, sub: ok ? "" : "Poprawna: odpowiedź " + KEYS[task.c], src: task.src }));
  return (
    <>
      <div className="scenecard a-up d1"><div className="eyebrow">Sytuacja</div><div className="scenetext">{task.scene}</div></div>
      <Title sm cls="a-up d2">{task.q || "Co najlepiej to wyjaśnia?"}</Title>
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
