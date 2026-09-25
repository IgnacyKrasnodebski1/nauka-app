"use client";
import { useMemo, useRef, useState } from "react";
import { useMounted } from "@/lib/use-mounted";
import { allFlashcards, type Subject, type Topic } from "@nauka/shared";

/** legacy: +2 XP per known card in the Fiszki tab */
const CARD_XP = 2;
import { useApp } from "@/lib/store/app-context";
import { useDailyActions } from "@/lib/daily-plan";
import { cardSrsKey, heartQuestLeft, useSrsTouch } from "@/lib/review";
import { noEmoji } from "@/lib/dates";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { useKeys } from "@/components/tasks/common";

/** Flashcards.html (topic tab): level chips, progress row, flip card, "jeszcze nie / umiem" → SRS + album + heart quest. */
export function CardsTab({ topic, subject }: { topic: Topic; subject: Subject }) {
  const { addXp, toast } = useApp();
  const { tickDaily } = useDailyActions();
  const touch = useSrsTouch();
  const sfx = useSfx();
  const [lvl, setLvl] = useState("all");
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [hqTick, setHqTick] = useState(0);
  const mounted = useMounted();
  const x0 = useRef<number | null>(null);
  const swiped = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hq = useMemo(() => (mounted ? heartQuestLeft() : 0), [mounted, hqTick]);
  const list = allFlashcards(topic).filter((c) => lvl === "all" || c.levelId === lvl);
  const safe = list.length ? idx % list.length : 0;
  const c = list[safe];

  const next = (known: boolean) => {
    if (!c) return;
    touch(topic, cardSrsKey(c.levelId, c.index), known);
    if (known) {
      addXp(topic.id, CARD_XP);
      toast("+2 XP", "check");
      sfx.play("correct");
    } else sfx.play("tap");
    tickDaily(topic.id, "review", 1);
    setHqTick((n) => n + 1);
    setFlipped(false);
    setIdx((safe + 1) % Math.max(1, list.length));
  };
  useKeys((e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((f) => !f); }
    else if (e.key === "ArrowLeft" || e.key === "1") next(false);
    else if (e.key === "ArrowRight" || e.key === "2") next(true);
  });

  return (
    <div className="scroll">
      <div className="chips" role="tablist" aria-label="Poziom">
        <button type="button" className={cn("chip", lvl === "all" && "active")} onClick={() => { setLvl("all"); setIdx(0); setFlipped(false); }}>Wszystko</button>
        {topic.levels.map((l) => (
          <button key={l.id} type="button" className={cn("chip", lvl === l.id && "active")} onClick={() => { setLvl(l.id); setIdx(0); setFlipped(false); }}>{noEmoji(l.title)}</button>
        ))}
      </div>
      <div className="progressrow">
        <div className="bar"><i style={{ width: `${list.length ? (safe / list.length) * 100 : 0}%` }} /></div>
        <div className="counter">{list.length ? safe + 1 : 0}/{list.length}</div>
        {hq > 0 && <div className="counter red"><Icon name="heart" size={12} /> za {hq}</div>}
      </div>
      <div
        className={cn("flip", flipped && "flipped")}
        style={{ height: "calc(100dvh - 340px)" }}
        onClick={() => { if (swiped.current) { swiped.current = false; return; } setFlipped((f) => !f); }}
        onPointerDown={(e) => { x0.current = e.clientX; }}
        onPointerUp={(e) => { if (x0.current == null) return; const dx = e.clientX - x0.current; x0.current = null; if (Math.abs(dx) > 80) { swiped.current = true; next(dx > 0); } }}
        role="button"
        tabIndex={0}
        aria-label={c ? `Fiszka: ${c.t}. Dotknij, żeby odwrócić` : "Brak fiszek"}
      >
        <div className="flipinner">
          <div className="face front"><span className="tag">{c ? noEmoji(c.lvl) : ""}</span><div className="term">{c?.t ?? "—"}</div><div className="tapomat">dotknij, żeby odwrócić</div></div>
          <div className="face back"><span className="tag">odpowiedź</span><div className="deftxt">{c?.d ?? "Brak fiszek"}</div><div className="tapomat">dotknij, żeby wrócić</div></div>
        </div>
      </div>
      <div className="fbtns">
        <button type="button" className="fbtn no" onClick={() => next(false)} disabled={!c}><Icon name="refresh" size={18} stroke={2.8} /> jeszcze nie</button>
        <button type="button" className="fbtn yes" onClick={() => next(true)} disabled={!c}><Icon name="check" size={18} stroke={3.4} /> umiem</button>
      </div>
      <span hidden>{subject.name}</span>
    </div>
  );
}
