"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { pl, todayStr } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { DAYS, DAYS_S, fmtNum, weekRange } from "@/lib/dates";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** WeeklyStory.html: XP per day (activity), stats from the day journal (history); mode=last (Monday story) or this. */
export function WeeklyScreen() {
  const { activity, history } = useApp();
  const params = useSearchParams();
  const last = params.get("mode") === "last";
  const stats = (days: string[]) => {
    const st = { xp: 0, levels: 0, cards: 0, reviews: 0, combo: 0, missions: 0, days: 0, perDay: [] as number[] };
    for (const d of days) {
      const x = activity[d]?.xp ?? 0, h = history[d];
      st.xp += x; st.levels += h?.levels ?? 0; st.cards += h?.cards ?? 0; st.reviews += h?.reviews ?? 0; st.missions += h?.missions ?? 0; st.combo = Math.max(st.combo, h?.combo ?? 0);
      if (x > 0 || (h?.levels ?? 0) > 0 || (h?.reviews ?? 0) > 0) st.days++;
      st.perDay.push(x);
    }
    return st;
  };
  const days = weekRange(last ? -1 : 0);
  const cur = stats(days), prev = stats(weekRange(last ? -2 : -1));
  const diff = prev.xp > 0 ? Math.round(((cur.xp - prev.xp) / prev.xp) * 100) : null;
  const trend = diff == null ? (cur.xp ? "pierwszy tydzień z historią" : "jeszcze bez XP w tym tygodniu") : diff >= 0 ? `o ${diff}% więcej niż tydzień temu` : `o ${-diff}% mniej niż tydzień temu`;
  const t = todayStr(), max = Math.max(1, ...cur.perDay), bi = cur.perDay.indexOf(Math.max(...cur.perDay));
  const back = last ? "/app" : "/app/profile";
  const share = () => navigator.share?.({ title: "Recall — mój tydzień", text: `${cur.xp} XP, ${cur.days} ${pl(cur.days, "dzień", "dni", "dni")} nauki, ${cur.levels} ${pl(cur.levels, "poziom", "poziomy", "poziomów")} — Recall` }).catch(() => {});
  return (
    <div className="screen active weekly">
      <div className="wkblob a-float" aria-hidden="true" /><div className="wkblob two a-float d3" aria-hidden="true" />
      <div className="scroll wk">
        <div className="wksegs"><i className="on" /><i className="on" /><i><b className="a-grow" /></i><i /><i /></div>
        <div className="wkhead"><span>{last ? "Twój tydzień" : "Ten tydzień"}</span><Link href={back} className="wkclose" aria-label="Zamknij podsumowanie"><Icon name="close" size={20} stroke={3.4} /></Link></div>
        <div className="wkbody">
          <div className="wkl a-up">{last ? "W zeszłym tygodniu zdobyte" : "W tym tygodniu zdobyte"}</div>
          <div className="wkn a-pop d1">{fmtNum(cur.xp)} XP</div>
          <div className="wkchip a-up d2"><Icon name="trend" size={16} className={cn(!(diff != null && diff < 0) && "ic-acid")} /><span>{trend}</span></div>
          <div className="wkbars">{days.map((d, i) => <div key={d} className={cn("wkcol", d === t && "today", i === bi && cur.perDay[i]! > 0 && "best", d > t && "future")}><div className="wkbar"><i className={`a-up d${Math.min(6, i + 1)}`} style={{ height: `${Math.max(6, Math.round((cur.perDay[i]! / max) * 100))}%` }} /></div><span>{DAYS_S[(i + 1) % 7]}</span></div>)}</div>
          <div className="wkbest a-up d6">{cur.xp ? `Najmocniejszy dzień: ${DAYS[(bi + 1) % 7]!.toLowerCase()} — ${cur.perDay[bi]} XP.` : "Zacznij od jednego zadania z planu dnia."}</div>
        </div>
        <div className="wkgrid a-up d4">
          {([["flame", cur.days, pl(cur.days, "dzień nauki", "dni nauki", "dni nauki")], ["check", cur.levels, pl(cur.levels, "poziom zaliczony", "poziomy zaliczone", "poziomów zaliczonych")], ["refresh", cur.reviews, pl(cur.reviews, "pojęcie powtórzone", "pojęcia powtórzone", "pojęć powtórzonych")], ["cards", cur.cards, pl(cur.cards, "karta w albumie", "karty w albumie", "kart w albumie")], ["bolt", "×" + cur.combo, "najlepsze combo"], ["star", cur.missions, pl(cur.missions, "misja odebrana", "misje odebrane", "misji odebranych")]] as [string, string | number, string][]).map(([ic, v, lab]) => <div key={lab} className="wkstat"><Icon name={ic} size={18} stroke={2.6} /><b>{v}</b><span>{lab}</span></div>)}
        </div>
        <div className="wkfoot">
          <Link href={back} className="pill dark a-glow">{last ? "WRACAM DO NAUKI" : "WRÓĆ DO PROFILU"}</Link>
          <button type="button" className="pill text dark" onClick={share}><Icon name="upload" size={16} /> Udostępnij</button>
        </div>
      </div>
    </div>
  );
}
