"use client";
import Link from "next/link";
import { useMemo } from "react";
import { allFlashcards, pl, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { srsDue, srsEntries } from "@/lib/review";
import { initial, noEmoji } from "@/lib/dates";
import { Shell } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";
import { themeStyle } from "@/components/ui/mono";

/** Fiszki hub (legacy renderCardsHub): topics per subject with card counts and due counts → topic Fiszki tab. */
export function CardsHub({ subjects, topics }: { subjects: Subject[]; topics: Topic[] }) {
  const { ready, allSrs, overrides, version } = useApp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const due = useMemo(() => (ready ? srsDue(srsEntries(topics, allSrs(), overrides, subjects)) : []), [ready, topics, subjects, version]);
  const totalC = topics.reduce((a, t) => a + allFlashcards(t).length, 0);
  return (
    <Shell nav title="Fiszki" pills={false} blob cls="cards">
      <div>
        <div className="eyebrow">{totalC} {pl(totalC, "pojęcie", "pojęcia", "pojęć")} · {subjects.length} {pl(subjects.length, "przedmiot", "przedmioty", "przedmiotów")}</div>
        <p className="sp">Wybierz temat i przeglądaj fiszki. Każda odpowiedź trafia do powtórki na interwałach.</p>
      </div>
      {due.length > 0 && (
        <Link href="/app/review" className="rvrow a-up d1"><div className="mono solid"><Icon name="refresh" size={22} stroke={2.6} /></div><div className="grow"><div className="t">Powtórka na dziś</div><div className="s">{due.length} {pl(due.length, "pojęcie czeka", "pojęcia czekają", "pojęć czeka")}</div></div><span className="n">{due.length}</span></Link>
      )}
      {subjects.map((s, si) => {
        const mine = topics.filter((t) => t.subjectId === s.id);
        if (!mine.length) return null;
        return (
          <div key={s.id} className="contents">
            <div className="eyebrow sec">{noEmoji(s.name)}</div>
            <div className={`setcard a-up d${Math.min(6, si + 2)}`}>
              {mine.map((t, i) => {
                const nc = allFlashcards(t).length, nd = due.filter((x) => x.topic.id === t.id).length;
                return (
                  <div key={t.id} className="contents">
                    {i > 0 && <div className="setsep" />}
                    <Link href={`/app/t/${t.id}?tab=fiszki`} className="setrow themed" style={themeStyle(s.accent2)}>
                      <div className="mono solid xs" aria-hidden="true">{initial(t.short || t.name)}</div>
                      <div className="grow"><div className="t">{noEmoji(t.name)}</div><div className="s">{nc} {pl(nc, "fiszka", "fiszki", "fiszek")}{nd ? " · " + nd + " do powtórki" : ""}</div></div>
                      <Icon name="chevron-right" size={18} className="chev" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {!topics.length && <div className="setcard a-up d2"><div className="setrow"><span className="t grow muted">Jeszcze nic — dodaj pierwszy materiał.</span></div></div>}
    </Shell>
  );
}
