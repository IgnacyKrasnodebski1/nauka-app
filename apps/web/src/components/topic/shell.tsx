"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { dayDiff, subjectCompletion, todayStr, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { inDays, initial, noEmoji } from "@/lib/dates";
import { syncTests, tpTitle } from "@/lib/tests";
import { GemPill, HeartsPill } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";
import { themeStyle } from "@/components/ui/mono";
import { cn } from "@/lib/utils";
import { PathTab } from "@/components/topic/path";
import { CardsTab } from "@/components/topic/cards";
import { QuizTab } from "@/components/topic/quiz";
import { PracticeTab } from "@/components/topic/practice";
import { ExamTab } from "@/components/topic/exam";
import { InfoTab } from "@/components/topic/info";

const TABS = [
  ["path", "map", "Ścieżka"],
  ["fiszki", "cards", "Fiszki"],
  ["quiz", "brain", "Quiz"],
  ["cwicz", "edit", "Ćwiczenia"],
  ["egzamin", "target", "Egzamin"],
] as const;
export type TopicTab = (typeof TABS)[number][0] | "info";

/**
 * Topic shell (Path.html): header band in --surface-2 (back, mono + name, progress bar, info, gems, hearts),
 * "Sprawdzian za N dni" chip, sub-tabs Ścieżka / Fiszki / Quiz / Ćwiczenia / Egzamin + Klasa. Levels hidden in
 * SubjectReady (overrides "hide:…") are filtered out of every tab.
 */
export function TopicShell({ topic: full, subject }: { topic: Topic; subject: Subject }) {
  const { ready, progressOf, isLevelHidden, tests, setTests, allProgress, weak } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const fromUrl = params.get("tab") as TopicTab | null;
  const tab: TopicTab = fromUrl && (fromUrl === "info" || TABS.some((t) => t[0] === fromUrl)) ? fromUrl : "path";
  const go = (t: TopicTab) => router.replace(`${path}?tab=${t}`, { scroll: false });
  const topic = useMemo<Topic>(() => {
    const levels = full.levels.filter((l) => !isLevelHidden(full.id, l.id));
    return levels.length ? { ...full, levels } : full;
  }, [full, isLevelHidden]);
  const p = ready ? progressOf(topic.id) : { xp: 0, levels: {} };
  const c = subjectCompletion(topic, p);
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  const style = themeStyle(subject.accent2);

  // test plan chip (legacy bandtest): sync once a day
  const test = tests.find((t) => t.subjectId === subject.id) ?? null;
  useEffect(() => {
    if (!ready || !test) return;
    const synced = syncTests(tests, () => [topic], allProgress(), weak);
    if (synced !== tests) setTests(synced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, topic.id]);
  const N = test ? dayDiff(todayStr(), test.date) : 0;
  const todayRow = test?.plan.find((r) => r.date === todayStr());

  return (
    <div className="contents" style={style}>
      <div className="band">
        <div className="brow">
          <Link href={`/app/s/${subject.id}`} className="backbtn" aria-label="Wróć do przedmiotu"><Icon name="back" size={20} stroke={3} /></Link>
          <div className="bmeta">
            <div className="bname"><div className="mono xs solid" aria-hidden="true">{initial(topic.short || topic.name)}</div><span>{noEmoji(topic.short || topic.name)}</span></div>
            <div className="bprog"><div className="bar"><i className="a-grow" style={{ width: `${pct}%` }} /></div><span>{c.done}/{c.total} · <b>{p.xp}</b> xp</span></div>
          </div>
          <button type="button" className={cn("infobtn", tab === "info" && "active")} aria-label="Zasady zaliczenia" onClick={() => go("info")}><Icon name="info" size={19} /></button>
          <GemPill />
          <HeartsPill iconBeat />
        </div>
        {test && (
          <Link href={`/app/testplan/${test.id}?from=topic:${topic.id}`} className="bandtest">
            <Icon name="calendar" size={15} stroke={2.6} />
            <span>Sprawdzian {inDays(N)}</span>
            {N > 0 && todayRow ? <small>· dziś: {tpTitle(todayRow, [topic]).toLowerCase()}{todayRow.done ? " (zrobione)" : ""}</small> : <small />}
            <Icon name="chevron-right" size={16} className="chev" />
          </Link>
        )}
        <div className="subtabs" role="tablist">
          {TABS.map(([k, ic, lab]) => (
            <button key={k} type="button" role="tab" className={cn("subtab", tab === k && "active")} aria-current={tab === k ? "page" : undefined} aria-selected={tab === k} onClick={() => go(k)}>
              <Icon name={ic} size={15} /><span>{lab}</span>
            </button>
          ))}
          <Link href={`/app/share/${topic.id}`} className="subtab share" aria-label="Udostępnij klasie"><Icon name="share" size={15} /><span>Klasa</span></Link>
        </div>
      </div>
      <div className="screen active" id="subjscreen">
        {tab === "path" && <PathTab topic={topic} subject={subject} />}
        {tab === "fiszki" && <CardsTab topic={topic} subject={subject} />}
        {tab === "quiz" && <QuizTab key={params.get("lvl") ?? "all"} topic={topic} subject={subject} levelId={params.get("lvl")} />}
        {tab === "cwicz" && <PracticeTab topic={topic} subject={subject} />}
        {tab === "egzamin" && <ExamTab topic={topic} subject={subject} test={test} />}
        {tab === "info" && <InfoTab topic={topic} subject={subject} test={test} go={go} />}
      </div>
    </div>
  );
}
