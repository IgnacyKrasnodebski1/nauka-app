"use client";
import { useMemo, useState } from "react";
import { allFlashcards, cardKey, isDue, newCard, review, XP, type SrsGrade, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { cn } from "@/lib/utils";

type Mode = "browse" | "srs";
interface Card {
  t: string;
  d: string;
  lvl: string;
  topicId: string;
  topicName: string;
  key: string;
}

/** Flashcards across one topic (topic shell) or all topics of a subject (subject page). SRS state is per topic. */
export function FlashcardsTab({ topics }: { topics: Topic[] }) {
  const { addXp, toast, srsOf, setSrs, ready, version } = useApp();
  const [mode, setMode] = useState<Mode>("browse");
  const [filter, setFilter] = useState<string>("all"); // topicId or levelId (single topic)
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [srsQueue, setSrsQueue] = useState<string[] | null>(null);
  const [srsDone, setSrsDone] = useState(0);
  const single = topics.length === 1;

  const all = useMemo<Card[]>(
    () => topics.flatMap((t) => allFlashcards(t).map((c) => ({ t: c.t, d: c.d, lvl: single ? c.lvl : t.name, topicId: t.id, topicName: t.name, key: cardKey(c.levelId, c.index), levelId: c.levelId }))).map((c) => c),
    [topics, single],
  );
  const stateOf = (c: Card) => (ready ? srsOf(c.topicId)[c.key] : undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dueCards = useMemo(() => all.filter((c) => { const st = stateOf(c); return !st || isDue(st); }), [all, ready, version]);

  const chips = single ? topics[0]!.levels.map((l) => ({ id: l.id, label: l.title })) : topics.map((t) => ({ id: t.id, label: `${t.emoji} ${t.name}` }));
  const list = mode === "srs" && srsQueue ? all.filter((c) => srsQueue.includes(c.topicId + "|" + c.key)) : filter === "all" ? all : all.filter((c) => (single ? c.key.startsWith(filter + ":") : c.topicId === filter));
  const safeIdx = list.length ? idx % list.length : 0;
  const card = list[safeIdx];

  const startSrs = () => {
    if (!dueCards.length) return toast("Nic nie czeka na powtórkę");
    setSrsQueue(dueCards.map((c) => c.topicId + "|" + c.key));
    setSrsDone(0);
    setIdx(0);
    setFlipped(false);
    setMode("srs");
  };
  const grade = (g: SrsGrade) => {
    if (!card) return;
    const srs = srsOf(card.topicId);
    setSrs(card.topicId, { ...srs, [card.key]: review(srs[card.key] ?? newCard(), g) });
    if (g >= 2) addXp(card.topicId, XP.flashcardKnown);
    const id = card.topicId + "|" + card.key;
    const rest = (srsQueue ?? []).filter((k) => k !== id);
    if (g === 0) rest.push(id);
    setSrsDone((d) => d + 1);
    setFlipped(false);
    if (!rest.length) {
      setSrsQueue(null);
      setMode("browse");
      toast("Powtórka zrobiona");
      return;
    }
    setSrsQueue(rest);
    setIdx(0);
  };
  const browseNext = (known: boolean) => {
    if (!card) return;
    if (known) {
      addXp(card.topicId, XP.flashcardKnown);
      toast(`+${XP.flashcardKnown} XP`);
    }
    const srs = srsOf(card.topicId);
    setSrs(card.topicId, { ...srs, [card.key]: review(srs[card.key] ?? newCard(), known ? 2 : 0) });
    setFlipped(false);
    setIdx((i) => (i + 1) % Math.max(1, list.length));
  };

  if (!all.length) return <div className="zbox"><p>Nie ma jeszcze fiszek — dodaj temat.</p></div>;

  return (
    <div className="flex flex-col">
      {mode === "browse" ? (
        <div className="chips" role="tablist" aria-label="Filtr">
          <button type="button" className={cn("chip", filter === "all" && "active")} onClick={() => { setFilter("all"); setIdx(0); setFlipped(false); }}>Wszystko</button>
          {chips.map((c) => (
            <button key={c.id} type="button" className={cn("chip", filter === c.id && "active")} onClick={() => { setFilter(c.id); setIdx(0); setFlipped(false); }}>{c.label}</button>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between mb-3">
          <span className="tag badge hue !mb-0">Powtórka · zostało {srsQueue?.length ?? 0}</span>
          <button type="button" className="chip" onClick={() => { setMode("browse"); setSrsQueue(null); }}>przerwij</button>
        </div>
      )}
      <div className="progressrow">
        <div className="bar"><i style={{ width: `${mode === "srs" ? (srsDone / Math.max(1, srsDone + (srsQueue?.length ?? 0))) * 100 : list.length ? (safeIdx / list.length) * 100 : 0}%` }} /></div>
        <div className="counter">{mode === "srs" ? `${srsDone} ✓` : `${list.length ? safeIdx + 1 : 0}/${list.length}`}</div>
      </div>
      {card && (
        <div className={cn("flip mb-3", flipped && "flipped")}>
          <div className="flipinner" onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0} aria-label={flipped ? "Pokaż termin" : "Pokaż definicję"} onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), setFlipped((f) => !f))}>
            <div className="face front"><span className="tag">{card.lvl}</span><div className="term">{card.t}</div><div className="tapomat">tapnij, żeby odwrócić</div></div>
            <div className="face back"><span className="tag hue">Odpowiedź</span><div className="deftxt" dangerouslySetInnerHTML={{ __html: card.d }} /><div className="tapomat">tapnij, żeby wrócić</div></div>
          </div>
        </div>
      )}
      {mode === "browse" ? (
        <>
          <div className="fbtns">
            <button type="button" className="fbtn no" onClick={() => browseNext(false)}>Jeszcze nie</button>
            <button type="button" className="fbtn yes" onClick={() => browseNext(true)}>Umiem</button>
          </div>
          <button type="button" className="pill ghost mt-3" onClick={startSrs}>Powtórka SRS · {dueCards.length} do zrobienia</button>
        </>
      ) : (
        <div className="fbtns">
          <button type="button" className="fbtn no" onClick={() => grade(0)}>Nie</button>
          <button type="button" className="fbtn mid" onClick={() => grade(1)}>Trudne</button>
          <button type="button" className="fbtn yes" onClick={() => grade(2)}>Dobrze</button>
          <button type="button" className="fbtn yes" onClick={() => grade(3)}>Łatwe</button>
        </div>
      )}
    </div>
  );
}
