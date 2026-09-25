import type { Task } from "@nauka/shared";
import React, { useMemo, useRef } from "react";
import type { Feedback } from "@/components/Sheets";
import { ChainView, FillView, MatchView, OrderView, SortView, TimelineView } from "./drag";
import { FrameMetaProvider, type FrameMeta, type TaskApi } from "./frame";
import { ChartView, FindErrorView, HotspotView, MathStepsView, ScenarioView, SwipeView, TfView, ThesisView, TypeTermView } from "./simple";

export type { Feedback, TaskApi };

export interface TaskViewProps {
  task: Task;
  n: number;
  total: number;
  combo?: number;
  broken?: boolean;
  boost?: boolean;
  tag?: string;
  onFinish: (ok: boolean, fb: Feedback) => void;
  onHintXp?: (n: number) => void;
  onSource?: () => void;
}

/** Rejestr rendererów 15 typów zadań (legacy `TASKS`) + ramka z chipami sesji. Zakończenie raz przez `api.finish`. */
export function TaskView({ task, n, total, combo, broken, boost, tag, onFinish, onHintXp, onSource }: TaskViewProps) {
  const done = useRef(false);
  const api = useMemo<TaskApi>(
    () => ({
      finish(ok, fb) {
        if (done.current) return;
        done.current = true;
        onFinish(ok, fb ?? {});
      },
      hintXp: onHintXp,
    }),
    [onFinish, onHintXp],
  );
  const meta = useMemo<FrameMeta>(() => ({ n, total, combo, broken, boost, tag, type: task.type }), [n, total, combo, broken, boost, tag, task.type]);
  let body: React.ReactNode;
  switch (task.type) {
    case "tf":
      body = <TfView task={task} api={api} />;
      break;
    case "fill":
      body = <FillView task={task} api={api} />;
      break;
    case "typeterm":
      body = <TypeTermView task={task} api={api} onSource={task.src ? onSource : undefined} />;
      break;
    case "swipe":
      body = <SwipeView task={task} api={api} />;
      break;
    case "thesis":
      body = <ThesisView task={task} api={api} />;
      break;
    case "scenario":
      body = <ScenarioView task={task} api={api} />;
      break;
    case "finderror":
      body = <FindErrorView task={task} api={api} />;
      break;
    case "match":
      body = <MatchView task={task} api={api} />;
      break;
    case "order":
      body = <OrderView task={task} api={api} />;
      break;
    case "sort":
      body = <SortView task={task} api={api} />;
      break;
    case "timeline":
      body = <TimelineView task={task} api={api} />;
      break;
    case "chain":
      body = <ChainView task={task} api={api} />;
      break;
    case "chart":
      body = <ChartView task={task} api={api} />;
      break;
    case "mathsteps":
      body = <MathStepsView task={task} api={api} />;
      break;
    case "hotspot":
      body = <HotspotView task={task} api={api} />;
      break;
    default:
      body = null;
  }
  return <FrameMetaProvider value={meta}>{body}</FrameMetaProvider>;
}
