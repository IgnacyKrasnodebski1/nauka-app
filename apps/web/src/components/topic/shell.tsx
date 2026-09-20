"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { levelProgress, subjectCompletion, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { TopBar } from "@/components/app/chrome";
import { SubjectTheme } from "@/components/topic/theme";
import { WindingPath } from "@/components/topic/winding-path";
import { FlashcardsTab } from "@/components/topic/flashcards";
import { QuizTab } from "@/components/topic/quiz";
import { ExamTab } from "@/components/topic/exam";
import { InfoTab } from "@/components/topic/info";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const TABS = [
  ["path", "Ścieżka"],
  ["fiszki", "Fiszki"],
  ["quiz", "Quiz"],
  ["egzamin", "Egzamin"],
  ["info", "Info"],
] as const;
type Tab = (typeof TABS)[number][0];

export function TopicShell({ topic, subject }: { topic: Topic; subject: Subject }) {
  const { progressOf, ready } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const fromUrl = params.get("tab") as Tab | null;
  const tab: Tab = fromUrl && TABS.some((t) => t[0] === fromUrl) ? fromUrl : "path";
  const go = (t: Tab) => router.replace(`?tab=${t}`, { scroll: false });
  const p = ready ? progressOf(topic.id) : { xp: 0, levels: {} };
  const c = subjectCompletion(topic, p);
  const stars = topic.levels.reduce((a, l) => a + levelProgress(p, l.id).stars, 0);

  return (
    <SubjectTheme s={subject}>
      <TopBar back={`/app/s/${subject.id}`} title={<span className="subline">{subject.name}</span>} />
      <div className="unitbar">
        <span className="emo" aria-hidden="true">{topic.emoji}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate">{topic.name}</h1>
          <div className="sub flex items-center gap-3 flex-wrap">
            <span>{c.done}/{c.total} poziomów</span>
            <span className="inline-flex items-center gap-1"><Icon name="star" size={13} />{stars}/{topic.levels.length * 3}</span>
            <span className="inline-flex items-center gap-1"><Icon name="bolt" size={13} />{p.xp} XP</span>
          </div>
        </div>
      </div>
      <div className="subtabs" role="tablist" aria-label="Sekcje tematu">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={cn("subtab", tab === k && "active")} onClick={() => go(k)}>{label}</button>
        ))}
      </div>
      <div className="px-4" role="tabpanel">
        {tab === "path" && <WindingPath topic={topic} />}
        {tab === "fiszki" && <FlashcardsTab topics={[topic]} />}
        {tab === "quiz" && <QuizTab topic={topic} />}
        {tab === "egzamin" && <ExamTab topics={[topic]} />}
        {tab === "info" && <InfoTab topic={topic} />}
      </div>
    </SubjectTheme>
  );
}
