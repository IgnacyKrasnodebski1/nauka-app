"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { dayDiff, pl, todayStr, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { srsDue, srsEntries, type SrsEntry } from "@/lib/review";
import { dailyFor, taskInfo } from "@/lib/daily-plan";
import { noEmoji } from "@/lib/dates";
import { Icon } from "@/components/ui/icons";
import { ReviewSession } from "@/components/review/session";

/** ComeBack.html: after ≥ 3 days away — old streak → 0, what waits in review, "start with 5 minutes". */
export function ComeBackScreen({ subjects, topics }: { subjects: Subject[]; topics: Topic[] }) {
  const { ready, meta, allSrs, overrides, allProgress, weak, daily } = useApp();
  const router = useRouter();
  const [session, setSession] = useState<SrsEntry[] | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const due = useMemo(() => (ready ? srsDue(srsEntries(topics, allSrs(), overrides, subjects)) : []), [ready, topics, subjects]);
  const d = meta.lastDay ? dayDiff(meta.lastDay, todayStr()) : 0;
  const old = meta.streak;
  const bySub = subjects.map((s) => ({ s, n: due.filter((x) => x.topic.subjectId === s.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 3);
  const plan = ready ? dailyFor(daily, topics, allProgress(), weak).plan : null;
  const first = plan?.tasks.map((t) => taskInfo(t, topics, subjects, allSrs(), weak)).find((x) => x && !x.t.done) ?? null;
  const take = Math.min(15, due.length);
  if (session) return <ReviewSession items={session} topics={topics} onExit={() => router.push("/app")} />;
  return (
    <div className="screen active">
      <div className="blob a-float mid" aria-hidden="true" />
      <div className="scroll comeback">
        <div className="cbart"><div className="cbico a-sway"><Icon name="clock" size={50} stroke={2} /></div></div>
        <div className="cbtxt a-up d1"><h1>Nie było cię {d} {pl(d, "dzień", "dni", "dni")}</h1><p>Bez dramatu — wracamy od małego kroku. Pięć minut dziś znaczy więcej niż godzina kiedyś.</p></div>
        {old > 0 && d > 1 && <div className="cbstreak a-up d2"><Icon name="flame" size={42} /><div className="grow"><div className="t">Seria zaczyna się od nowa</div><div className="nums"><span className="old">{old}</span><Icon name="chevron-right" size={16} stroke={2.8} /><span className="new a-pop d3">0</span></div></div></div>}
        <div className="cbdue a-up d3">
          {bySub.length ? (
            <>
              <div className="hd"><span className="eyebrow sec">Czeka na powtórkę</span><b>{due.length} {pl(due.length, "pojęcie", "pojęcia", "pojęć")}</b></div>
              {bySub.map((x, i) => <div key={x.s.id} className={`row r${i + 1}`}><span className="lb">{noEmoji(x.s.name)}</span><div className="bar"><i className={`a-grow d${i + 2}`} style={{ width: `${Math.round((x.n / bySub[0]!.n) * 100)}%` }} /></div><span className="n">{x.n}</span></div>)}
            </>
          ) : (
            <><div className="hd"><span className="eyebrow sec">Nic nie przepadło</span></div><p className="sp">Pojęcia wrócą do powtórki we właściwym dniu. Zacznij od planu na dziś.</p></>
          )}
        </div>
        <div className="cbwarm a-up d4"><div className="ico a-pulse"><Icon name="bolt" size={24} /></div><div className="grow"><div className="t">Zacznij od 5 minut</div><div className="s">{due.length ? `${take} ${pl(take, "pojęcie", "pojęcia", "pojęć")} z powtórki — bez nowych rzeczy` : first ? first.title : "jedno zadanie z planu dnia"}</div></div></div>
        <div className="cbfoot">
          <button type="button" className="pill a-glow" onClick={() => (due.length ? setSession(due.slice(0, 15)) : router.push(first?.href ?? "/app"))}>ZACZNIJ OD 5 MINUT</button>
          <Link href="/app" className="pill text">NORMALNY PLAN DNIA</Link>
        </div>
      </div>
    </div>
  );
}
