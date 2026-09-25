"use client";
import { TASK_META, type Task } from "@nauka/shared";
import type { ReactNode } from "react";
import type { TaskApi } from "./common";
import { TfTaskView } from "./tf";
import { FillTaskView } from "./fill";
import { MatchTaskView } from "./match";
import { OrderTaskView } from "./order";
import { SortTaskView } from "./sort";
import { TypeTermTaskView } from "./typeterm";
import { SwipeTaskView } from "./swipe";
import { ThesisTaskView } from "./thesis";
import { ScenarioTaskView } from "./scenario";
import { FindErrorTaskView } from "./finderror";
import { TimelineTaskView } from "./timeline";
import { ChainTaskView } from "./chain";
import { ChartTaskView } from "./chart";
import { MathStepsTaskView } from "./mathsteps";
import { HotspotTaskView } from "./hotspot";

export type { TaskApi, TaskFeedback } from "./common";

/** Registry of the 15 task renderers (legacy TASKS[type].render). */
export function TaskView({ task, api }: { task: Task; api: TaskApi }) {
  switch (task.type) {
    case "tf": return <TfTaskView task={task} api={api} />;
    case "fill": return <FillTaskView task={task} api={api} />;
    case "match": return <MatchTaskView task={task} api={api} />;
    case "order": return <OrderTaskView task={task} api={api} />;
    case "sort": return <SortTaskView task={task} api={api} />;
    case "typeterm": return <TypeTermTaskView task={task} api={api} />;
    case "swipe": return <SwipeTaskView task={task} api={api} />;
    case "thesis": return <ThesisTaskView task={task} api={api} />;
    case "scenario": return <ScenarioTaskView task={task} api={api} />;
    case "finderror": return <FindErrorTaskView task={task} api={api} />;
    case "timeline": return <TimelineTaskView task={task} api={api} />;
    case "chain": return <ChainTaskView task={task} api={api} />;
    case "chart": return <ChartTaskView task={task} api={api} />;
    case "mathsteps": return <MathStepsTaskView task={task} api={api} />;
    case "hotspot": return <HotspotTaskView task={task} api={api} />;
  }
}

/** .task frame with the type chip + session chips (legacy taskBlock). The foot goes through api.footEl. */
export function TaskBlock({ task, api, chips }: { task: Task; api: TaskApi; chips: ReactNode }) {
  const meta = TASK_META[task.type];
  return (
    <div className="task">
      <div className="qchips"><span className={`tchip ${meta.tone}`}>{meta.label}</span>{chips}</div>
      <TaskView task={task} api={api} />
    </div>
  );
}
