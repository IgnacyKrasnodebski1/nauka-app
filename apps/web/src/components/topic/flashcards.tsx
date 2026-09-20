"use client";
import { useMemo, useState } from "react";
import { allFlashcards, cardKey, isDue, newCard, review, XP, type SrsGrade, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Btn3d } from "@/components/ui/btn3d";
import { Icon } from "@/components/ui/icons";
import { SwipeDeck, type SwipeDir } from "@/components/ui/swipe-deck";
import { Mascot } from "@/components/mascot/mascot";

type Mode = "browse" | "srs";
interface Card {
  t: string;
  d: string;
  lvl: string;
  topicId: string;
  topicName: string;
  key: string;
}

/** Flashcards across one topic (topic shell) or all topics of a subject (subject page). Swipe deck: right = umiem, left = jeszcze nie, up = łatwe. */
export function FlashcardsTab({ topics }: { topics: Topic[] }) {
  const { addXp, toast, srsOf, setSrs, ready, version, bumpStats, questEvent } = useApp();
  const sfx = useSfx();
  const [mode, setMode] = useState<Mode>("browse");
  const [filter, setFilter] = useState<string>("all"); // topicId or levelId (single topic)
  const [idx, setIdx] = useState(0);
  const [srsQueue, setSrsQueue] = useState<string[] | null>(null);
  const [srsDone, setSrsDone] = useState(0);
  const [cmd, setCmd] = useState<{ n: number; dir: SwipeDir } | null>(null);
  const [round, setRound] = useState(0);
  const single = topics.length === 1;

  const all = useMemo<Card[]>(
    () => topics.flatMap((t) => allFlashcards(t).map((c) => ({ t: c.t, d: c.d, lvl: single ? c.lvl : t.name, topicId: t.id, topicName: t.name, key: cardKey(c.levelId, c.index) }))),
    [topics, single],
  );
  const stateOf = (c: Card) => (ready ? srsOf(c.topicId)[c.key] : undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dueCards = useMemo(() => all.filter((c) => { const st = stateOf(c); return !st || isDue(st); }), [all, ready, version]);

  const chips = single ? topics[0]!.levels.map((l) => ({ id: l.id, label: l.title })) : topics.map((t) => ({ id: t.id, label: `${t.emoji} ${t.name}` }));
  const list = mode === "srs" && srsQueue ? all.filter((c) => srsQueue.includes(c.topicId + "|" + c.key)) : filter === "all" ? all : all.filter((c) => (single ? c.key.startsWith(filter + ":") : c.topicId === filter));
  const safeIdx = list.length ? idx % list.length : 0;
  const card = list[safeIdx];

  const bump = (n = 1) => {
    bumpStats((s) => ({ cardsReviewed: s.cardsReviewed + n }));
    questEvent({ type: "review", count: n });
  };
  const startSrs = () => {
    if (!dueCards.length) return toast("Nic nie czeka na powtórkę");
    setSrsQueue(dueCards.map((c) => c.topicId + "|" + c.key));
    setSrsDone(0);
    setIdx(0);
    setRound((r) => r + 1);
    setMode("srs");
  };
  const grade = (g: SrsGrade) => {
    if (!card) return;
    const srs = srsOf(card.topicId);
    setSrs(card.topicId, { ...srs, [card.key]: review(srs[card.key] ?? newCard(), g) });
    if (g >= 2) {
      addXp(card.topicId, XP.flashcardKnown);
      sfx.play("correct");
    } else sfx.play("tap");
    bump();
    const id = card.topicId + "|" + card.key;
    const rest = (srsQueue ?? []).filter((k) => k !== id);
    if (g === 0) rest.push(id);
    setSrsDone((d) => d + 1);
    if (!rest.length) {
      setSrsQueue(null);
      setMode("browse");
      setRound((r) => r + 1);
      toast("Powtórka zrobiona", "xp");
      return;
    }
    setSrsQueue(rest);
    setIdx(0);
  };
  const browseNext = (known: boolean, easy = false) => {
    if (!card) return;
    if (known) {
      addXp(card.topicId, XP.flashcardKnown);
      sfx.play("correct");
    } else sfx.play("tap");
    const srs = srsOf(card.topicId);
    setSrs(card.topicId, { ...srs, [card.key]: review(srs[card.key] ?? newCard(), easy ? 3 : known ? 2 : 0) });
    bump();
    setIdx((i) => (i + 1) % Math.max(1, list.length));
  };

  if (!all.length)
    return (
      <div className="empty mt-4">
        <Mascot state="think" size={100} />
        <p>Nie ma jeszcze fiszek — dodaj temat.</p>
      </div>
    );

  return (
    <div className="flex flex-col pb-6">
      {mode === "browse" ? (
        <div className="chips mt-2" role="tablist" aria-label="Filtr">
          <button type="button" className={cn("chip", filter === "all" && "active")} onClick={() => { setFilter("all"); setIdx(0); setRound((r) => r + 1); }}>Wszystko</button>
          {chips.map((c) => (
            <button key={c.id} type="button" className={cn("chip", filter === c.id && "active")} onClick={() => { setFilter(c.id); setIdx(0); setRound((r) => r + 1); }}>{c.label}</button>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between my-3">
          <span className="tag badge hue !mb-0">Powtórka · zostało {srsQueue?.length ?? 0}</span>
          <button type="button" className="chip" onClick={() => { setMode("browse"); setSrsQueue(null); setRound((r) => r + 1); }}>przerwij</button>
        </div>
      )}
      <div className="progressrow">
        <div className="bar green"><i style={{ width: `${mode === "srs" ? (srsDone / Math.max(1, srsDone + (srsQueue?.length ?? 0))) * 100 : list.length ? (safeIdx / list.length) * 100 : 0}%` }} /></div>
        <div className="counter">{mode === "srs" ? `${srsDone} zrobione` : `${list.length ? safeIdx + 1 : 0}/${list.length}`}</div>
      </div>
      {card && (
        <SwipeDeck
          items={[...list.slice(safeIdx), ...list.slice(0, safeIdx)].slice(0, 3)}
          index={0}
          keyOf={(c) => `${round}|${c.topicId}|${c.key}`}
          allowUp
          command={cmd}
          onSwipe={(dir) => (mode === "srs" ? grade(dir === "up" ? 3 : dir === "right" ? 2 : 0) : browseNext(dir !== "left", dir === "up"))}
          render={(c, { flipped }) => (
            <div className={`flip ${flipped ? "flipped" : ""}`}>
              <div className="flipinner">
                <div className="face front"><span className="tag">{c.lvl}</span><div className="term">{c.t}</div><div className="tapomat">tapnij, żeby odwrócić · przeciągnij, żeby ocenić</div></div>
                <div className="face back"><span className="tag hue">Odpowiedź</span><div className="deftxt" dangerouslySetInnerHTML={{ __html: c.d }} /><div className="tapomat">tapnij, żeby wrócić</div></div>
              </div>
            </div>
          )}
        />
      )}
      {mode === "browse" ? (
        <>
          <div className="fbtns mt-4">
            <Btn3d variant="red" onClick={() => setCmd({ n: Date.now(), dir: "left" })}><Icon name="close" size={16} />Jeszcze nie</Btn3d>
            <Btn3d variant="green" onClick={() => setCmd({ n: Date.now(), dir: "right" })}><Icon name="check" size={16} />Umiem</Btn3d>
          </div>
          <Btn3d variant="blue" className="mt-3" onClick={startSrs}><Icon name="cards" size={16} />Powtórka SRS · {dueCards.length} do zrobienia</Btn3d>
        </>
      ) : (
        <div className="fbtns mt-4">
          <Btn3d variant="red" onClick={() => setCmd({ n: Date.now(), dir: "left" })}>Nie</Btn3d>
          <Btn3d variant="orange" onClick={() => grade(1)}>Trudne</Btn3d>
          <Btn3d variant="green" onClick={() => setCmd({ n: Date.now(), dir: "right" })}>Dobrze</Btn3d>
          <Btn3d variant="blue" onClick={() => setCmd({ n: Date.now(), dir: "up" })}>Łatwe</Btn3d>
        </div>
      )}
    </div>
  );
}
