"use client";
import Link from "next/link";
import { Fragment } from "react";
import { isLevelUnlocked, levelProgress, subjectCompletion } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import type { AppSubject } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PathTab({ subject }: { subject: AppSubject }) {
  const { progressOf, ready, toast } = useApp();
  const p = ready ? progressOf(subject) : { xp: 0, levels: {} };
  const c = subjectCompletion(subject, p);
  const href = `/app/s/${subject.slug ?? subject.id}`;
  return (
    <>
      <div className="progressrow mt-1">
        <div className="bar"><i style={{ width: `${c.pct}%` }} /></div>
        <div className="counter">{c.done}/{c.total} poziomów</div>
      </div>
      {c.done === c.total && c.total > 0 && (
        <div className="exfb ok mb-2">👑 Cały przedmiot zaliczony. Zrób egzamin próbny albo polew po gwiazdki.</div>
      )}
      <div className="path">
        {subject.levels.map((lv, i) => {
          const lp = levelProgress(p, lv.id);
          const unlocked = isLevelUnlocked(subject, p, lv.id);
          const prevDone = i > 0 && levelProgress(p, subject.levels[i - 1]!.id).done;
          const cls = lp.done ? "node-done" : unlocked ? "node-open" : "node-lock";
          const label = (
            <div className="nodelabel">
              {lv.title}
              <small>{lv.quiz.length} pytań · {lv.flashcards.length} fiszek{lv.games?.length ? ` · ${lv.games.length} gry` : ""}</small>
            </div>
          );
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
                  <Link href={`${href}/l/${lv.id}`} className={cn("nodebtn", cls)} aria-label={`Poziom ${i + 1}: ${lv.title}${lp.done ? " (zaliczony)" : ""}`}>{inner}</Link>
                ) : (
                  <button type="button" className={cn("nodebtn", cls)} aria-label={`Poziom ${i + 1}: ${lv.title} (zablokowany)`} onClick={() => toast("Najpierw zalicz poprzedni poziom 🔒")}>{inner}</button>
                )}
                {label}
              </div>
            </Fragment>
          );
        })}
      </div>
    </>
  );
}
