"use client";
import Link from "next/link";
import { dayDiff, FREEZE_MAX, pl, todayStr } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { DAYS_S } from "@/lib/dates";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** Streak.html: flame, counter, week dots (activity), freeze card. */
export function StreakScreen() {
  const { streak, meta, activity } = useApp();
  const best = Math.max(meta.best || 0, streak);
  const left = best - streak + 1;
  const msg = streak === 0 ? "Zrób dziś jedno zadanie z planu i seria startuje." : streak >= best ? "To twój rekord. Nie przerywaj." : `Rekord to ${best}. Jeszcze ${left} ${pl(left, "dzień", "dni", "dni")} i bijesz swój wynik.`;
  const t = todayStr(), now = new Date(), dow = (now.getDay() + 6) % 7;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i), ds = todayStr(d), toToday = dayDiff(ds, t);
    let st = "miss";
    if (toToday < 0) st = "future";
    else if ((activity[ds]?.xp ?? 0) > 0) st = "done";
    if (toToday === 0) st = st === "done" ? "todaydone" : "today";
    return { lab: DAYS_S[(i + 1) % 7]!, st };
  });
  const n = meta.streakFreezes;
  return (
    <div className="screen active">
      <div className="streakbg" />
      <div className="blob a-float amber" aria-hidden="true" />
      <div className="scroll streakview">
        <Link href="/app" className="streakclose" aria-label="Zamknij"><Icon name="close" size={18} stroke={3} /></Link>
        <div className="streakhero">
          <Icon name="flame" size={118} className="ic-flame a-beat" />
          <div className="streakn a-pop">{streak}</div>
          <div className="streakt">{streak === 1 ? "dzień z rzędu" : "dni z rzędu"}</div>
          <div className="streakp">{msg}</div>
        </div>
        <div className="week">
          <div className="eyebrow">Ten tydzień</div>
          <div className="days">
            {days.map((d, i) => (
              <div key={i} className={cn("day", d.st)}>
                <div className={`dot a-up d${Math.min(6, i + 1)}`}>{d.st === "done" ? <Icon name="check" size={19} stroke={3.6} /> : d.st === "todaydone" || d.st === "today" ? <Icon name="flame" size={18} /> : null}</div>
                <span>{d.lab}</span>
              </div>
            ))}
          </div>
        </div>
        <Link href="/app/shop" className="freezecard a-up d3" aria-label={`Zamrożenia serii: ${n}. Otwórz plecak`}>
          <div className="ico"><Icon name="snow" size={24} stroke={2.6} /></div>
          <div className="grow"><div className="t">Zamrożenie serii</div><div className="s">{n ? `Masz ${n} z ${FREEZE_MAX}` : "Nie masz żadnego"}{n ? " — ratuje serię w wolny dzień" : " — 100 gemów w plecaku"}</div></div>
          <Icon name="chevron-right" size={20} className="chev" />
        </Link>
        <div className="streakfoot"><Link href="/app" className="pill amber a-glow">Wracam do nauki</Link></div>
      </div>
    </div>
  );
}
