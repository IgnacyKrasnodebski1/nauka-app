"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { chestOpenable, isLevelUnlocked, layoutPath, levelProgress, subjectCompletion, trophyClaimable, unlockedIndex, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { burst } from "@/lib/confetti";
import { m } from "@/lib/motion";
import { useSfx } from "@/lib/sfx";
import { hueOf } from "@/lib/hue";
import { cn } from "@/lib/utils";
import { Btn3d } from "@/components/ui/btn3d";
import { Chest, Trophy } from "@/components/ui/chest";
import { Icon } from "@/components/ui/icons";
import { Mascot } from "@/components/mascot/mascot";

const W = 360;

/** Duolingo-style snake path: SVG track from layoutPath() + absolutely positioned 3D nodes, chests and the trophy. */
export function WindingPath({ topic }: { topic: Topic }) {
  const { progressOf, ready, toast, openChest, claimTrophy, hearts, unlimitedHearts, streak } = useApp();
  const router = useRouter();
  const sfx = useSfx();
  const p = ready ? progressOf(topic.id) : { xp: 0, levels: {}, chests: [] };
  const c = subjectCompletion(topic, p);
  const lay = layoutPath(topic.levels.length, { width: W });
  const activeIdx = unlockedIndex(topic, p);
  const allDone = c.total > 0 && c.done === c.total;
  const activeNodeK = lay.nodes.findIndex((n) => n.kind === "level" && n.levelIndex === activeIdx);
  const frac = allDone ? 1 : lay.nodes.length > 1 ? Math.max(0, activeNodeK) / (lay.nodes.length - 1) : 0;
  const hue = hueOf({ name: topic.name, accent2: topic.accent2 });
  const activeRef = useRef<HTMLButtonElement>(null);
  const [opened, setOpened] = useState<number | null>(null);

  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.75 || r.top < 80) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [ready, activeIdx]);

  const go = (levelId: string) => {
    sfx.play("tap");
    router.push(`/app/t/${topic.id}/l/${levelId}`);
  };

  return (
    <div className="pb-6">
      {/* unit header */}
      <div className="card3d hue mt-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="eyebrow" style={{ color: "var(--hue)" }}>Jednostka · {c.done}/{c.total} poziomów</div>
            <h2 className="mt-0.5" style={{ fontSize: 20 }}>{allDone ? "Cały temat zaliczony" : topic.levels[activeIdx]?.title ?? topic.name}</h2>
            <div className="bar mt-2.5" style={{ maxWidth: 240 }}><i style={{ width: `${c.pct}%` }} /></div>
          </div>
          {allDone ? (
            <Mascot state="cheer" size={68} streak={streak} />
          ) : (
            <Btn3d variant="hue" size="sm" onClick={() => topic.levels[activeIdx] && go(topic.levels[activeIdx]!.id)}>
              <Icon name="play" size={14} />Kontynuuj
            </Btn3d>
          )}
        </div>
      </div>
      {!unlimitedHearts && hearts.hearts === 0 && <div className="exfb bad mb-2">Brak serc — poczekaj na regenerację albo uzupełnij za klejnoty w lekcji.</div>}

      <div className="wpath" style={{ width: W, maxWidth: "100%", height: lay.height }}>
        <svg className="track" viewBox={`0 0 ${lay.width} ${lay.height}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={lay.d} fill="none" stroke="var(--line-strong)" strokeWidth="6" strokeLinecap="round" strokeDasharray="1 14" />
          <m.path d={lay.d} fill="none" stroke={hue} strokeWidth="8" strokeLinecap="round" pathLength={1} initial={{ pathLength: 0 }} animate={{ pathLength: frac }} transition={{ duration: 0.9, ease: "easeOut" }} style={{ opacity: 0.9 }} />
        </svg>

        {lay.nodes.map((n, k) => {
          if (n.kind === "level") {
            const lv = topic.levels[n.levelIndex!]!;
            const lp = levelProgress(p, lv.id);
            const unlocked = ready && isLevelUnlocked(topic, p, lv.id);
            const active = !allDone && n.levelIndex === activeIdx;
            const state = lp.done ? "done" : active ? "active" : unlocked ? "active" : "locked";
            const labelLeft = n.x > lay.width / 2;
            return (
              <m.div key={n.i} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18, delay: Math.min(0.6, k * 0.05) }} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {active && <div className="tooltip-start" style={{ left: n.x, top: n.y - 38 - 44 }}>Start</div>}
                <button
                  ref={active ? activeRef : undefined}
                  type="button"
                  className={cn("node3d", state)}
                  style={{ left: n.x, top: n.y, pointerEvents: "auto" }}
                  aria-label={`Poziom ${n.levelIndex! + 1}: ${lv.title}${lp.done ? " (zaliczony)" : unlocked ? "" : " (zablokowany)"}`}
                  onClick={() => (unlocked ? go(lv.id) : toast("Najpierw zalicz poprzedni poziom"))}
                >
                  {lp.done ? <Icon name="check" size={34} /> : unlocked ? <Icon name="star" size={30} /> : <Icon name="lock" size={26} />}
                </button>
                {lp.done && (
                  <div className="nodestars" style={{ left: n.x, top: n.y + 40 }} aria-label={`${lp.stars} z 3 gwiazdek`}>
                    {[0, 1, 2].map((s) => (
                      <Icon key={s} name="star" size={14} style={{ color: s < lp.stars ? "var(--play-yellow)" : "var(--faint)" }} />
                    ))}
                  </div>
                )}
                <div className={cn("nodelabel", labelLeft ? "left" : "", !unlocked && "locked")} style={{ top: n.y, [labelLeft ? "right" : "left"]: labelLeft ? lay.width - n.x + 48 : n.x + 48 }}>
                  {lv.title}
                  <small>{lv.quiz.length} pytań · {lv.flashcards.length} fiszek</small>
                </div>
              </m.div>
            );
          }
          if (n.kind === "chest") {
            const idx = n.chestIndex!;
            const done = (p.chests ?? []).includes(idx);
            const can = ready && chestOpenable(p, topic.levels, idx);
            const st = done ? "opened" : can ? "openable" : "closed";
            return (
              <m.button
                key={n.i}
                type="button"
                className={cn("node3d chest", st)}
                style={{ left: n.x, top: n.y }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: opened === idx ? [1, 1.3, 1] : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18, delay: Math.min(0.6, k * 0.05) }}
                aria-label={done ? "Skrzynka otwarta" : can ? "Otwórz skrzynkę" : "Skrzynka (zalicz poziomy powyżej)"}
                onClick={() => {
                  if (done) return toast("Ta skrzynka jest już otwarta");
                  if (!can) return toast("Zalicz poziomy powyżej, żeby otworzyć skrzynkę");
                  const g = openChest(topic.id, idx);
                  if (g) {
                    setOpened(idx);
                    sfx.play("chest");
                    burst("chest", hue);
                    toast(`Skrzynka: +${g} klejnotów`, "gem");
                  }
                }}
              >
                <Chest state={st} size={40} />
              </m.button>
            );
          }
          const claimed = (p.chests ?? []).includes(-1);
          const can = ready && trophyClaimable(p, topic.levels);
          const st = claimed ? "claimed" : can ? "claimable" : "locked";
          return (
            <m.button
              key={n.i}
              type="button"
              className={cn("node3d trophy", st)}
              style={{ left: n.x, top: n.y }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18, delay: Math.min(0.6, k * 0.05) }}
              aria-label={claimed ? "Trofeum odebrane" : can ? "Odbierz trofeum" : "Trofeum (zalicz wszystkie poziomy)"}
              onClick={() => {
                if (claimed) return toast("Trofeum już odebrane");
                if (!can) return toast("Zalicz wszystkie poziomy, żeby odebrać trofeum");
                const g = claimTrophy(topic.id);
                if (g) {
                  sfx.play("levelup");
                  burst("trophy", hue);
                  toast(`Trofeum: +${g} klejnotów`, "gem");
                }
              }}
            >
              <Trophy state={st} size={46} />
            </m.button>
          );
        })}
      </div>
    </div>
  );
}
