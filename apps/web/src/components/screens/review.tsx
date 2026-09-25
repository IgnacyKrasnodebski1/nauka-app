"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { pl, shuffle, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { deckEntries, nextDueText, srsDue, srsEntries, srsStats, topicCardEntries, type SrsEntry } from "@/lib/review";
import { initial, noEmoji } from "@/lib/dates";
import { Shell } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";
import { themeStyle } from "@/components/ui/mono";
import { ReviewSession } from "@/components/review/session";
import { cn } from "@/lib/utils";

/**
 * Review.html — Powtórka: due count, per-subject rows, memory state, start. Query: `topic=` (plan row: that topic's
 * due cards, or its cards when nothing is due), `deck=` (error deck of a topic), `n=` limit, `start=1` auto-start.
 */
export function ReviewScreen({ subjects, topics }: { subjects: Subject[]; topics: Topic[] }) {
  const { ready, allSrs, overrides, weak, version, toast } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const [session, setSession] = useState<{ items: SrsEntry[]; deck?: string | null } | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo(() => (ready ? srsEntries(topics, allSrs(), overrides, subjects) : []), [ready, topics, subjects, version]);
  const due = useMemo(() => srsDue(all), [all]);
  const st = srsStats(all), tot = all.length, n = due.length, nd = nextDueText(all);
  const bySubj = subjects.map((s) => ({ s, mine: due.filter((x) => x.topic.subjectId === s.id) })).filter((x) => x.mine.length).sort((a, b) => b.mine.length - a.mine.length);

  // deep links from the daily plan / exam result / come-back: derived once the store is ready
  const auto = useMemo<{ items: SrsEntry[]; deck?: string | null; empty?: string } | null>(() => {
    if (!ready) return null;
    const tid = params.get("topic"), deck = params.get("deck"), lim = Number(params.get("n") || 0), start = params.get("start");
    if (deck) {
      const t = topics.find((x) => x.id === deck);
      const items = t ? shuffle(deckEntries(t, weak, allSrs()[t.id] ?? {}, overrides, subjects.find((s) => s.id === t.subjectId))) : [];
      return items.length ? { items, deck } : { items: [], empty: "Talia błędów jest pusta" };
    }
    if (tid) {
      const t = topics.find((x) => x.id === tid);
      if (!t) return null;
      const lv = params.get("levels")?.split(",").filter(Boolean);
      let items = due.filter((x) => x.topic.id === tid && (!lv?.length || lv.includes(x.levelId)));
      if (!items.length) items = shuffle(topicCardEntries(t, allSrs()[t.id] ?? {}, subjects.find((s) => s.id === t.subjectId))).filter((x) => !lv?.length || lv.includes(x.levelId));
      if (lim > 0) items = items.slice(0, lim);
      return items.length ? { items } : { items: [], empty: "Ten temat nie ma fiszek" };
    }
    if (start) { const items = lim > 0 ? due.slice(0, lim) : due; return items.length ? { items } : null; }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (auto?.empty) { toast(auto.empty, auto.deck ? "check" : "alert"); router.replace("/app/review"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);
  const active = session ?? (!dismissed && auto && auto.items.length ? auto : null);

  if (active) return <ReviewSession items={active.items} deck={active.deck} topics={topics} onExit={() => { setSession(null); setDismissed(true); router.replace("/app/review"); }} />;

  return (
    <Shell nav title="Powtórka" backHref="/app" pills={false} blob="cyan" cls="review">
      <div className="rvhero a-up">
        <div className="grow">
          <div className="rvn a-pop">{n}</div>
          <div className="rvt">{n ? pl(n, "pojęcie na dziś", "pojęcia na dziś", "pojęć na dziś") : "nic na dziś"}</div>
          <div className="rvs">{n ? "Zaplanowane tak, żeby wróciły tuż przed zapomnieniem." : tot ? "Wszystko na dziś przejrzane." + (nd ? " Najbliższa powtórka " + nd + "." : "") : "Ucz się z fiszek i lekcji — pojęcia wrócą tu we właściwym dniu."}</div>
        </div>
        <Icon name="refresh" size={58} stroke={1.8} className={cn(n > 0 && "a-spin")} />
      </div>
      {n > 0 && (
        <>
          <div className="eyebrow sec">Z czego</div>
          <div className="rvrows">
            {bySubj.map(({ s, mine }, i) => {
              const lv = [...new Set(mine.map((x) => x.lvl))];
              return (
                <button key={s.id} type="button" className={cn("rvrow themed a-up", "d" + Math.min(6, i + 1))} style={themeStyle(s.accent2)} aria-label={`${s.name}: ${mine.length} do powtórki`} onClick={() => setSession({ items: mine })}>
                  <div className="mono solid" aria-hidden="true">{initial(s.name)}</div>
                  <div className="grow"><div className="t">{noEmoji(s.name)}</div><div className="s">{lv.slice(0, 2).join(" · ")}{lv.length > 2 ? " · +" + (lv.length - 2) : ""}</div></div>
                  <span className="n">{mine.length}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="eyebrow sec">Stan pamięci</div>
      <div className="memcard a-up d3">
        {([["Świeże", "red", st.fresh, 1], ["W trakcie", "gold", st.mid, 2], ["Utrwalone", "acid", st.firm, 3]] as [string, string, number, number][]).map(([lab, tone, v, d]) => (
          <div key={lab} className={cn("memrow", tone)}><span className="lb">{lab}</span><div className="bar"><i className={`a-grow d${d}`} style={{ width: `${tot ? Math.round((v / tot) * 100) : 0}%` }} /></div><span className="n">{v}</span></div>
        ))}
        {!tot && <div className="memnote">Jeszcze nic w powtórce. Każda fiszka i każde pytanie, na które odpowiesz, trafia tutaj.</div>}
      </div>
      <div className="rvfoot">
        {n ? <button type="button" className="pill cyan a-glow" onClick={() => setSession({ items: due })}>ZACZNIJ POWTÓRKĘ</button> : <Link href="/app/cards" className="pill ghost">Przejrzyj fiszki</Link>}
      </div>
    </Shell>
  );
}
