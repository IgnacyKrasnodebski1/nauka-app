"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useMounted } from "@/lib/use-mounted";
import { allQuiz, dayDiff, pl, todayStr, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { useUi } from "@/components/app/chrome";
import { inDays, noEmoji } from "@/lib/dates";
import type { TestPlan } from "@/lib/tests";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { emptyRec, examMin, exFailLabel, exPass, exScale, gradeParts } from "@/components/topic/exam";
import type { TopicTab } from "@/components/topic/shell";

const INFO_ICON: [RegExp, string, string][] = [[/cheat|najwa|priorytet|klucz|motyw/i, "bolt", "hot"], [/ocen|zalicz|punkt/i, "target", "pink"], [/zakres|unit|materia/i, "book", "cyan"], [/egzamin|test|kolokw|termin|deadline|homework|zadanie/i, "calendar", "gold"], [/regulac|prawo|kontekst/i, "file", "violet"], [/powt/i, "refresh", "cyan"], [/gramat|słow|slow/i, "edit", "gold"]];

/** Split `info` HTML into .zbox blocks (legacy infoBlocks); the grade table is replaced by the scale card. */
function infoBlocks(html: string): { title: string; html: string; icon: string; tone: string }[] | null {
  if (typeof document === "undefined") return null;
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  const boxes = [...tmp.querySelectorAll(".zbox")];
  if (!boxes.length) return null;
  return boxes
    .map((b) => {
      const h = b.querySelector("h3");
      const title = h ? noEmoji(h.textContent) : "";
      h?.remove();
      const grade = !!b.querySelector(".gradetbl");
      const m = INFO_ICON.find(([re]) => re.test(title)) ?? [null, "info", ""];
      return { title, html: b.innerHTML.trim(), grade, icon: m[1] as string, tone: m[2] as string };
    })
    .filter((x) => !x.grade && (x.title || x.html));
}
function scaleRows(t: Topic) {
  const sc = exScale(t).slice().sort((a, b) => b[0] - a[0]);
  const rows: { min: number; max: number; lab: string }[] = [];
  for (let i = sc.length - 1; i >= 0; i--) rows.push({ min: sc[i]![0], max: i > 0 ? sc[i - 1]![0] - 1 : 100, lab: gradeParts(sc[i]![1])[0] });
  return rows;
}

/** SubjectInfo.html: rules of passing (info blocks), grade scale with "tu jesteś", exam / test plan / share links. */
export function InfoTab({ topic, subject, test, go }: { topic: Topic; subject: Subject; test: TestPlan | null; go: (t: TopicTab) => void }) {
  const { exams } = useApp();
  const { openTestSheet } = useUi();
  const rec = exams[topic.id] ?? emptyRec();
  const last = rec.last;
  const mounted = useMounted();
  // parsed with the DOM → only after mount, so server and client render the same markup (no hydration mismatch)
  const blocks = useMemo(() => (mounted ? infoBlocks(topic.info) : null), [topic.info, mounted]);
  const rows = scaleRows(topic), pass = exPass(topic);
  const d = blocks ? Math.min(6, blocks.length + 1) : 2;
  const N = Math.min(20, allQuiz(topic).length);
  return (
    <div className="scroll info">
      <div className="infhead a-up"><div className="eyebrow">Zasady zaliczenia</div><h2>{noEmoji(topic.name)}</h2>{topic.tagline && <p>{topic.tagline}</p>}</div>
      {blocks ? blocks.map((b, i) => (
        <div key={i} className={cn("inftile", b.tone, "a-up", "d" + Math.min(6, i + 1))}><div className="infh"><Icon name={b.icon} size={18} stroke={2.6} /><span>{b.title || "Informacje"}</span></div><div className="infb" dangerouslySetInnerHTML={{ __html: b.html }} /></div>
      )) : (
        <div className="zbox a-up d1" dangerouslySetInnerHTML={{ __html: topic.info || "<p>Brak dodatkowych informacji o zaliczeniu.</p>" }} />
      )}
      <div className={cn("infscale a-up", "d" + d)}>
        <div className="infh"><span><Icon name="chart" size={18} stroke={2.6} />Siatka ocen</span><b className={cn(last && "acid")}>{last ? "twój wynik: " + last.pct + "%" : "jeszcze bez podejścia"}</b></div>
        <div className="infrows">
          <div className={cn("infrow fail", last && last.pct < pass && "on a-glow")}><span className="r">pod {pass}%</span>{last && last.pct < pass && <span className="here">tu jesteś</span>}<span className="g">{gradeParts(exFailLabel(topic))[0]}</span></div>
          {rows.map((r) => { const on = !!last && last.pct >= r.min && last.pct <= r.max; return <div key={r.min} className={cn("infrow", on && "on a-glow")}><span className="r">{r.min}–{r.max}%</span>{on && <span className="here">tu jesteś</span>}<span className="g">{r.lab}</span></div>; })}
        </div>
      </div>
      <button type="button" className={cn("inflink a-up", "d" + Math.min(6, d + 1))} onClick={() => go("egzamin")}><div className="ico"><Icon name="target" size={20} stroke={2.6} /></div><div className="grow"><div className="t">Egzamin próbny</div><div className="s">{N} {pl(N, "pytanie", "pytania", "pytań")} · {examMin(topic)} min · próg {pass}%{rec.best ? " · najlepiej " + rec.best.pct + "%" : ""}</div></div><Icon name="chevron-right" size={18} className="chev" /></button>
      {test ? (
        <Link href={`/app/testplan/${test.id}?from=topic:${topic.id}`} className={cn("inflink a-up", "d" + Math.min(6, d + 2))}><div className="ico red"><Icon name="calendar" size={20} stroke={2.4} /></div><div className="grow"><div className="t">Sprawdzian {inDays(dayDiff(todayStr(), test.date))}</div><div className="s">plan dzień po dniu jest gotowy</div></div><Icon name="chevron-right" size={18} className="chev" /></Link>
      ) : (
        <button type="button" className={cn("inflink a-up", "d" + Math.min(6, d + 2))} onClick={() => openTestSheet(subject.id)}><div className="ico red"><Icon name="calendar" size={20} stroke={2.4} /></div><div className="grow"><div className="t">Mam sprawdzian</div><div className="s">ułożę plan dzień po dniu do daty</div></div><Icon name="chevron-right" size={18} className="chev" /></button>
      )}
      <Link href={`/app/share/${topic.id}`} className="inflink a-up d6"><div className="ico cyan"><Icon name="share" size={20} stroke={2.4} /></div><div className="grow"><div className="t">Udostępnij klasie</div><div className="s">kod dla klasy · wkrótce</div></div><Icon name="chevron-right" size={18} className="chev" /></Link>
      <div className="inffoot"><button type="button" className="pill a-glow" onClick={() => go("path")}>WRÓĆ DO NAUKI</button></div>
    </div>
  );
}
