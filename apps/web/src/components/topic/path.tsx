"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { bossNodeState, bossUnlocked, chestIndexes, chestOpenable, GEMS, levelProgress, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { noEmoji } from "@/lib/dates";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Icon, StarRow } from "@/components/ui/icons";
import { BossSvg } from "@/components/tasks/common";

/** Horizontal offsets of consecutive nodes (px), cyclic — legacy PATH_OFF. */
const PATH_OFF = [-104, 8, 96, -28];
type Item = { kind: "level"; i: number } | { kind: "chest"; after: number } | { kind: "boss" };

/** Path.html: chapter card, zigzag of nodes with connectors, chest after every 3rd level, boss at the end. */
export function PathTab({ topic }: { topic: Topic; subject: Subject }) {
  const { ready, progressOf, openChest, toast } = useApp();
  const sfx = useSfx();
  const wrap = useRef<HTMLDivElement>(null);
  const p = progressOf(topic.id);
  const isDone = (id: string) => !!levelProgress(p, id).done;
  const unlocked = (i: number) => i === 0 || isDone(topic.levels[i - 1]!.id);
  const curIdx = topic.levels.findIndex((l, i) => unlocked(i) && !isDone(l.id));
  const all = curIdx < 0;
  const boss = bossNodeState(topic, p);
  const chests = new Set(chestIndexes(topic.levels.length));
  const items: Item[] = [];
  topic.levels.forEach((_, i) => {
    items.push({ kind: "level", i });
    if (chests.has(i)) items.push({ kind: "chest", after: i });
  });
  items.push({ kind: "boss" });
  const xOf = (k: number) => PATH_OFF[k % PATH_OFF.length]!;
  const doneOf = (it: Item) => (it.kind === "chest" ? (p.chests ?? []).includes(it.after) : it.kind === "boss" ? boss === "beaten" : isDone(topic.levels[it.i]!.id));

  useEffect(() => {
    const w = wrap.current;
    if (!w || !ready) return;
    const n = w.querySelector<HTMLElement>(".node-open,.node-boss.open");
    if (!n) return;
    const r = n.getBoundingClientRect(), wr = w.getBoundingClientRect();
    if (r.bottom <= wr.bottom - 80) return;
    w.scrollTop = Math.max(0, r.top - wr.top + w.scrollTop - wr.height / 2 + r.height / 2);
  }, [ready, topic.id]);

  return (
    <div className="scroll pathview" ref={wrap}>
      <div className="blob a-float mid" aria-hidden="true" />
      <div className="chapter a-up">
        <i />
        <div className="grow">
          <div className="eyebrow">Rozdział {all ? topic.levels.length : curIdx + 1}</div>
          <div className="t">{all ? (boss === "beaten" ? "Wszystko zaliczone" : "Boss rozdziału czeka") : noEmoji(topic.levels[curIdx]!.title)}</div>
        </div>
        <Icon name={all && boss !== "beaten" ? "boss" : "list"} size={18} />
      </div>
      <div className="path">
        <div className="connector done first" />
        {items.map((it, k) => {
          const x = xOf(k);
          const conn = k > 0 ? <div className={cn("connector", doneOf(items[k - 1]!) && "done")} style={{ "--x": `${(xOf(k - 1) + x) / 2}px` } as React.CSSProperties} /> : null;
          if (it.kind === "chest") {
            const opened = (p.chests ?? []).includes(it.after), open = chestOpenable(p, topic.levels, it.after);
            return (
              <div key={k} className="contents">
                {conn}
                <div className="pathnode" style={{ "--x": `${x}px` } as React.CSSProperties}>
                  <button
                    type="button"
                    className={cn("nodebtn node-chest", opened && "opened", !opened && open && "a-sway")}
                    aria-label={"Skrzynia: " + (opened ? "otwarta" : open ? "do otwarcia" : "po zaliczeniu poziomu " + (it.after + 1))}
                    onClick={() => {
                      if (opened) return toast("Skrzynia już otwarta", "chest");
                      if (!open) return toast("Skrzynia otworzy się po zaliczeniu poziomu " + (it.after + 1), "lock");
                      const g = openChest(topic.id, it.after);
                      sfx.play("chest");
                      toast("Skrzynia: +" + (g || GEMS.chest) + " gemów", "gem", "a-pop");
                    }}
                  >
                    <Icon name="chest" size={32} stroke={2.4} />
                  </button>
                  <div className="nodelabel gold">{opened ? "Otwarta" : "Skrzynia"}</div>
                </div>
              </div>
            );
          }
          if (it.kind === "boss") {
            const beaten = boss === "beaten", open = bossUnlocked(topic, p);
            const inner = <><BossSvg size={52} />{beaten && <span className="won"><Icon name="check" size={14} stroke={4} /></span>}</>;
            const label = "Boss rozdziału: " + (beaten ? "pokonany, powtórz walkę" : open ? "zacznij walkę" : "po zaliczeniu wszystkich poziomów");
            return (
              <div key={k} className="contents">
                {conn}
                <div className={cn("pathnode", open && !beaten && "cur")} style={{ "--x": `${x}px` } as React.CSSProperties}>
                  {open && !beaten && <div className="bubble a-bob">WALKA</div>}
                  {open ? (
                    <Link href={`/app/t/${topic.id}/boss`} className={cn("nodebtn node-boss", beaten ? "beaten" : "open a-pulse")} aria-label={label}>{inner}</Link>
                  ) : (
                    <button type="button" className="nodebtn node-boss locked" aria-label={label} onClick={() => toast("Boss czeka, aż zaliczysz wszystkie poziomy", "lock")}>{inner}</button>
                  )}
                  <div className={cn("nodelabel", !beaten && (open ? "cur" : "lock"))}>{beaten ? "Boss pokonany" : "Boss rozdziału"}</div>
                </div>
              </div>
            );
          }
          const lv = topic.levels[it.i]!, un = unlocked(it.i), done = isDone(lv.id), stars = levelProgress(p, lv.id).stars, cur = un && !done;
          const label = (done ? "Powtórz: " : cur ? "Zacznij: " : "Zablokowane: ") + noEmoji(lv.title);
          const inner = <>{done ? <Icon name="check" size={34} stroke={3.4} /> : cur ? <Icon name="bolt" size={40} /> : <Icon name="lock" size={28} />}{done && <span className="stars"><StarRow n={stars} size={12} /></span>}</>;
          return (
            <div key={k} className="contents">
              {conn}
              <div className={cn("pathnode", cur && "cur")} style={{ "--x": `${x}px` } as React.CSSProperties}>
                {cur && <div className="bubble a-bob">ZACZNIJ</div>}
                {un ? (
                  <Link href={`/app/t/${topic.id}/l/${lv.id}`} className={cn("nodebtn", done ? "node-done" : "node-open a-pulse")} aria-label={label} onClick={() => sfx.play("tap")}>{inner}</Link>
                ) : (
                  <button type="button" className="nodebtn node-lock" aria-label={label} onClick={() => toast("Najpierw zalicz poprzedni poziom", "lock")}>{inner}</button>
                )}
                <div className={cn("nodelabel", cur ? "cur" : !done && "lock")}>{noEmoji(lv.title)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
