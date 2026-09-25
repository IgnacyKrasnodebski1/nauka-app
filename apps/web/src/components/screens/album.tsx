"use client";
import { useState } from "react";
import { albumCount, albumTiles, pl, todayStr, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { noEmoji } from "@/lib/dates";
import { Shell } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";
import { themeStyle } from "@/components/ui/mono";
import { cn } from "@/lib/utils";

const RAR = { epic: "mistrzowska", rare: "trudna", common: "zwykła" } as const;

/** Album.html: collected concepts (SRS box ≥ 3) per subject, rarity, "NOWA" today, locked tiles. */
export function AlbumScreen({ subjects, topics }: { subjects: Subject[]; topics: Topic[] }) {
  const { album } = useApp();
  const [filter, setFilter] = useState("all");
  const [flip, setFlip] = useState<Set<string>>(new Set());
  const t = todayStr();
  const tot = albumCount(album, topics);
  const subs = filter === "all" ? subjects : subjects.filter((s) => s.id === filter);
  const topicIds = new Set(topics.filter((x) => subs.some((s) => s.id === x.subjectId)).map((x) => x.id));
  const tiles = albumTiles(album, topics.filter((x) => topicIds.has(x.id)), t);
  const got = tiles.filter((x) => x.entry).sort((a, b) => (a.entry!.at < b.entry!.at ? 1 : a.entry!.at > b.entry!.at ? -1 : 0));
  const lock = tiles.filter((x) => !x.entry);
  const subjOf = (topicId: string) => subjects.find((s) => s.id === topics.find((x) => x.id === topicId)?.subjectId);
  return (
    <Shell title="Album pojęć" backHref="/app/profile" pills={false} cls="album">
      <div className="albhead a-up">
        <div className="sechdr msh"><span className="eyebrow">{tot.n} z {tot.m} zebrane</span><span className="albpct">{tot.m ? Math.round((tot.n / tot.m) * 100) : 0}%</span></div>
        <div className="bar"><i className="a-grow" style={{ width: `${tot.m ? (tot.n / tot.m) * 100 : 0}%` }} /></div>
      </div>
      <div className="albchips a-up d1">
        <button type="button" className={cn("albchip", filter === "all" && "on")} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Wszystkie</button>
        {subjects.map((s) => { const c = albumCount(album, topics.filter((x) => x.subjectId === s.id)); return <button key={s.id} type="button" className={cn("albchip themed", filter === s.id && "on")} style={themeStyle(s.accent2)} aria-pressed={filter === s.id} onClick={() => setFilter(s.id)}>{noEmoji(s.name)}{c.n ? " · " + c.n : ""}</button>; })}
      </div>
      <div className="albgrid">
        {got.map((x, i) => {
          const s = subjOf(x.topicId);
          const on = flip.has(x.key);
          return (
            <button key={x.key} type="button" className={cn("alb", x.entry!.rarity, "themed", on && "flip", i < 9 && "a-up d" + Math.min(6, Math.floor(i / 3) + 1))} style={themeStyle(s?.accent2)} aria-label={`${x.term} — ${RAR[x.entry!.rarity]}, dotknij, żeby zobaczyć definicję`} onClick={() => setFlip((f) => { const n = new Set(f); if (n.has(x.key)) n.delete(x.key); else n.add(x.key); return n; })}>
              {x.entry!.at === t && <span className="new a-pop d3">NOWA</span>}<span className="sw" /><span className="t">{x.term}</span><span className="d">{x.def}</span>
            </button>
          );
        })}
        {lock.map((x, i) => <div key={x.key} className={cn("alb lock", got.length + i < 9 && "a-up d" + Math.min(6, Math.floor((got.length + i) / 3) + 1))} aria-label="Nieodkryte pojęcie"><Icon name="lock" size={20} stroke={2.4} /></div>)}
        {!got.length && !lock.length && <div className="sp">Brak fiszek w tym przedmiocie.</div>}
      </div>
      <div className="alblegend a-up d5"><span><i />zwykłe</span><span><i className="rare" />trudne</span><span><i className="epic" />mistrzowskie</span></div>
      {!got.length && <p className="sp albnote">Pojęcie trafia do albumu, gdy trzy razy z rzędu odpowiesz dobrze w powtórce (pudełko 3). Bez pomyłek = trudne, z poziomu na 3 gwiazdki = mistrzowskie. {tot.m} {pl(tot.m, "pojęcie", "pojęcia", "pojęć")} czeka.</p>}
    </Shell>
  );
}
