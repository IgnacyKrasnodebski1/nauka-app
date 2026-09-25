"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { untilMidnight, type Quest } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { Shell, GemPill } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

const KIND: Record<string, [string, string]> = { xp: ["bolt", "acid"], combo: ["star", "pink"], review: ["refresh", "cyan"], levels: ["check", "acid"], perfect: ["clock", "gold"], games: ["grid", "amber"], minutes: ["clock", "gold"], correct: ["check", "acid"] };

/** Missions.html: 3 daily + 1 weekly, progress bars, claim → gems. */
export function MissionsScreen() {
  const { quests, claimQuest } = useApp();
  const sfx = useSfx();
  const [left, setLeft] = useState(() => untilMidnight().text);
  useEffect(() => { const t = setInterval(() => setLeft(untilMidnight().text), 30000); return () => clearInterval(t); }, []);
  const daily = quests.filter((q) => !q.weekly), weekly = quests.find((q) => q.weekly);
  const row = (x: Quest, d: number, isWeekly: boolean) => {
    const [ic, tone] = KIND[x.kind] ?? ["star", "gold"];
    const ready = x.done && !x.claimed, done = x.claimed;
    const pct = Math.round(Math.min(1, x.progress / x.target) * 100);
    return (
      <div key={x.id} className={cn("msrow", isWeekly ? "gold weekly" : tone, done && "done", ready && "ready", "a-up", "d" + d)}>
        <div className="mstop">
          <div className={cn("ico", done && "a-pop", isWeekly && !done && "a-sway")}><Icon name={done ? "check" : ic} size={isWeekly ? 28 : 24} stroke={done ? 3.4 : 2.6} /></div>
          <div className="grow"><div className="t">{x.title}</div><div className="s">{done ? "zrobione" : x.target > 1 ? `${Math.min(x.progress, x.target)} z ${x.target}` : ready ? "gotowe — odbierz nagrodę" : "jeszcze nie"}{isWeekly && !done ? " · duża nagroda" : ""}</div></div>
          {ready ? <button type="button" className="claim a-pop" aria-label={`Odbierz nagrodę: ${x.reward} gemów`} onClick={() => { claimQuest(x.id); sfx.play("chest"); }}>Odbierz</button> : <span className="rw"><Icon name="gem" size={15} />{x.reward}</span>}
        </div>
        {!done && <div className="bar"><i className={`a-grow d${d}`} style={{ width: `${pct}%` }} /></div>}
      </div>
    );
  };
  return (
    <Shell title="Misje" backHref="/app" pills={false} blob="gold" cls="missions" right={<GemPill />}>
      <div className="sechdr msh a-up"><span className="eyebrow sec">Dzienne</span><span className="msleft"><Icon name="clock" size={14} stroke={2.6} /><b className="a-blink">{left}</b></span></div>
      <div className="msrows">{daily.map((x, i) => row(x, i + 1, false))}</div>
      <div className="eyebrow sec">Tygodniowa</div>
      {weekly && row(weekly, 4, true)}
      <div className="msnote a-up d5"><Icon name="info" size={20} stroke={2.4} /><span>Misje odświeżają się o północy, niedokończone przepadają. Tygodniowa trwa do niedzieli.</span></div>
      <div className="msfoot"><Link href="/app" className="pill a-glow">DOKOŃCZ MISJE</Link></div>
    </Shell>
  );
}
