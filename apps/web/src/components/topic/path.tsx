"use client";
import Link from "next/link";
import { Fragment } from "react";
import { isLevelUnlocked, levelProgress, subjectCompletion, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { cn } from "@/lib/utils";

export function PathTab({ topic }: { topic: Topic }) {
  const { progressOf, ready, toast } = useApp();
  const p = ready ? progressOf(topic.id) : { xp: 0, levels: {} };
  const c = subjectCompletion(topic, p);
  return (
    <>
      <div className="progressrow mt-1">
        <div className="bar"><i style={{ width: `${c.pct}%` }} /></div>
        <div className="counter">{c.done}/{c.total} poziomów</div>
      </div>
      {c.done === c.total && c.total > 0 && <div className="exfb ok mb-2">👑 Cały temat zaliczony. Zrób egzamin próbny albo polew po gwiazdki.</div>}
      <div className="path">
        {topic.levels.map((lv, i) => {
          const lp = levelProgress(p, lv.id);
          const unlocked = isLevelUnlocked(topic, p, lv.id);
          const prevDone = i > 0 && levelProgress(p, topic.levels[i - 1]!.id).done;
          const cls = lp.done ? "node-done" : unlocked ? "node-open" : "node-lock";
          const inner = (
            <>
              {lp.done ? "✓" : unlocked ? lv.emoji || "📘" : "🔒"}
              {lp.done && <span className="stars" aria-label={`${lp.stars} z 3 gwiazdek`}>{"⭐".repeat(lp.stars)}{"·".repeat(Math.max(0, 3 - lp.stars))}</span>}
            </>
          );
          return (
            <Fragment key={lv.id}>
              {i > 0 && <div className={cn("connector", prevDone && "done")} />}
              <div className="pathnode pathzig">
                {unlocked ? (
                  <Link href={`/app/t/${topic.id}/l/${lv.id}`} className={cn("nodebtn", cls)} aria-label={`Poziom ${i + 1}: ${lv.title}${lp.done ? " (zaliczony)" : ""}`}>{inner}</Link>
                ) : (
                  <button type="button" className={cn("nodebtn", cls)} aria-label={`Poziom ${i + 1}: ${lv.title} (zablokowany)`} onClick={() => toast("Najpierw zalicz poprzedni poziom 🔒")}>{inner}</button>
                )}
                <div className="nodelabel">
                  {lv.title}
                  <small>{lv.quiz.length} pytań · {lv.flashcards.length} fiszek{lv.games?.length ? ` · ${lv.games.length} gry` : ""}</small>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </>
  );
}
