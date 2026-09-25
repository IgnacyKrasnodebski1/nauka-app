"use client";
import { useEffect, useState } from "react";
import { fmtSec, ghostStatus, ghostWhen, GHOST_TICK_MS, runScore, runTime, todayStr, type GhostRecord, type GhostStep } from "@nauka/shared";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** Ghost.html — race card above the question: you vs your best run. */
export function GhostCard({ ghost, run, youIdx, total, t0 }: { ghost: GhostRecord; run: GhostStep[]; youIdx: number; total: number; t0: number }) {
  const [now, setNow] = useState(t0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), GHOST_TICK_MS);
    return () => clearInterval(t);
  }, []);
  const st = ghostStatus(ghost.run, run, youIdx, now - t0, total);
  return (
    <div className="ghostcard a-up">
      <div className="ghrow"><div className="av">Ty</div><div className="grow"><div className="lab"><b>Ty</b><span>{youIdx} / {total}</span></div><div className="bar"><i style={{ width: `${(youIdx / total) * 100}%` }} /></div></div></div>
      <div className="ghrow ghost"><div className="av"><Icon name="ghost" size={20} /></div><div className="grow"><div className="lab"><b>Ty z {ghostWhen(ghost.at, todayStr())}</b><span>{st.ghostIdx} / {total}</span></div><div className="bar"><i style={{ width: `${(st.ghostIdx / total) * 100}%` }} /></div></div></div>
      <div className={cn("ghnote", st.state === "lead" && "lead")}><Icon name={st.state === "lead" ? "bolt" : "ghost"} size={16} /><span>{youIdx === 0 && st.ghostIdx === 0 ? `Duch rusza razem z tobą — ${runScore(ghost.run)} z ${total} w ${fmtSec(runTime(ghost.run))}.` : st.text}</span></div>
    </div>
  );
}
