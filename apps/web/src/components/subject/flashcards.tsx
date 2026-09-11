"use client";
import { useMemo, useState } from "react";
import { allFlashcards, cardKey, isDue, newCard, review, XP, type SrsGrade } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import type { AppSubject } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "browse" | "srs";

export function FlashcardsTab({ subject }: { subject: AppSubject }) {
  const { addXp, toast, srsOf, setSrs, ready } = useApp();
  const [mode, setMode] = useState<Mode>("browse");
  const [lvl, setLvl] = useState<string>("all");
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [srsQueue, setSrsQueue] = useState<string[] | null>(null);
  const [srsDone, setSrsDone] = useState(0);

  const all = useMemo(() => allFlashcards(subject), [subject]);
  const srs = ready ? srsOf(subject) : {};
  const dueCount = all.filter((c) => {
    const st = srs[cardKey(c.levelId, c.index)];
    return !st || isDue(st);
  }).length;

  const list = mode === "srs" && srsQueue ? all.filter((c) => srsQueue.includes(cardKey(c.levelId, c.index))) : lvl === "all" ? all : all.filter((c) => c.levelId === lvl);
  const safeIdx = list.length ? idx % list.length : 0;
  const card = list[safeIdx];

  const startSrs = () => {
    const due = all.filter((c) => {
      const st = srs[cardKey(c.levelId, c.index)];
      return !st || isDue(st);
    });
    if (!due.length) return toast("Nic nie czeka na powtórkę 🎉");
    setSrsQueue(due.map((c) => cardKey(c.levelId, c.index)));
    setSrsDone(0);
    setIdx(0);
    setFlipped(false);
    setMode("srs");
  };

  const grade = (g: SrsGrade) => {
    if (!card) return;
    const key = cardKey(card.levelId, card.index);
    const next = review(srs[key] ?? newCard(), g);
    setSrs(subject, { ...srs, [key]: next });
    if (g >= 2) addXp(subject, XP.flashcardKnown);
    const rest = (srsQueue ?? []).filter((k) => k !== key);
    if (g === 0) rest.push(key); // again → back to the end of the queue
    setSrsDone((d) => d + 1);
    setFlipped(false);
    if (!rest.length) {
      setSrsQueue(null);
      setMode("browse");
      toast("Powtórka zrobiona 🧠✨");
      return;
    }
    setSrsQueue(rest);
    setIdx(0);
  };

  const browseNext = (known: boolean) => {
    if (!card) return;
    if (known) {
      addXp(subject, XP.flashcardKnown);
      toast(`+${XP.flashcardKnown}xp 💪`);
    }
    // browsing also feeds the SRS lightly: known = good, not yet = again
    const key = cardKey(card.levelId, card.index);
    setSrs(subject, { ...srs, [key]: review(srs[key] ?? newCard(), known ? 2 : 0) });
    setFlipped(false);
    setIdx((i) => (i + 1) % Math.max(1, list.length));
  };

  if (!all.length) return <div className="zbox"><p>Ten przedmiot nie ma jeszcze fiszek.</p></div>;

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100dvh - 190px)" }}>
      {mode === "browse" ? (
        <div className="chips" role="tablist" aria-label="Poziom">
          <button type="button" className={cn("chip", lvl === "all" && "active")} onClick={() => { setLvl("all"); setIdx(0); setFlipped(false); }}>Wszystko 🌀</button>
          {subject.levels.map((l) => (
            <button key={l.id} type="button" className={cn("chip", lvl === l.id && "active")} onClick={() => { setLvl(l.id); setIdx(0); setFlipped(false); }}>{l.title}</button>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between mb-3">
          <span className="tag !mb-0">🔁 powtórka · zostało {srsQueue?.length ?? 0}</span>
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
            <div className="face front"><span className="tag">{card.lvl}</span><div className="term">{card.t}</div><div className="tapomat">tapnij = odpowiedź 👀</div></div>
            <div className="face back"><span className="tag">odpowiedź ✅</span><div className="deftxt" dangerouslySetInnerHTML={{ __html: card.d }} /><div className="tapomat">tapnij = wróć ↩</div></div>
          </div>
        </div>
      )}

      {mode === "browse" ? (
        <>
          <div className="fbtns">
            <button type="button" className="fbtn no" onClick={() => browseNext(false)}>jeszcze nie 😵</button>
            <button type="button" className="fbtn yes" onClick={() => browseNext(true)}>umiem 💪</button>
          </div>
          <button type="button" className="pill ghost mt-3" onClick={startSrs}>🔁 Powtórka SRS — {dueCount} do zrobienia</button>
        </>
      ) : (
        <div className="fbtns">
          <button type="button" className="fbtn no" onClick={() => grade(0)}>nie 😵</button>
          <button type="button" className="fbtn mid" onClick={() => grade(1)}>trudne 🤔</button>
          <button type="button" className="fbtn yes" onClick={() => grade(2)}>dobrze 👍</button>
          <button type="button" className="fbtn yes" onClick={() => grade(3)}>easy 😎</button>
        </div>
      )}
    </div>
  );
}
