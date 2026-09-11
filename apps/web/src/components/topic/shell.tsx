"use client";
import { useRouter, useSearchParams } from "next/navigation";
import type { Subject, Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { TopBar } from "@/components/app/chrome";
import { SubjectTheme } from "@/components/topic/theme";
import { PathTab } from "@/components/topic/path";
import { FlashcardsTab } from "@/components/topic/flashcards";
import { QuizTab } from "@/components/topic/quiz";
import { ExamTab } from "@/components/topic/exam";
import { InfoTab } from "@/components/topic/info";
import { cn } from "@/lib/utils";

const TABS = [
  ["path", "🗺️ Ścieżka"],
  ["fiszki", "🎴 Fiszki"],
  ["quiz", "🧠 Quiz"],
  ["egzamin", "🎯 Egzamin"],
  ["info", "📋 Info"],
] as const;
type Tab = (typeof TABS)[number][0];

export function TopicShell({ topic, subject }: { topic: Topic; subject: Subject }) {
  const { progressOf, ready } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const fromUrl = params.get("tab") as Tab | null;
  const tab: Tab = fromUrl && TABS.some((t) => t[0] === fromUrl) ? fromUrl : "path";
  const go = (t: Tab) => router.replace(`?tab=${t}`, { scroll: false });
  const xp = ready ? progressOf(topic.id).xp : 0;

  return (
    <SubjectTheme s={subject}>
      <TopBar back={`/app/s/${subject.id}`} title={<>{topic.emoji} <span className="g">{topic.short || topic.name}</span></>} xp={xp} />
      <div className="px-4 -mt-1 mb-1 text-muted text-xs font-bold">{subject.emoji} {subject.name}</div>
      <div className="subtabs" role="tablist" aria-label="Sekcje tematu">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={cn("subtab", tab === k && "active")} onClick={() => go(k)}>{label}</button>
        ))}
      </div>
      <div className="px-4" role="tabpanel">
        {tab === "path" && <PathTab topic={topic} />}
        {tab === "fiszki" && <FlashcardsTab topics={[topic]} />}
        {tab === "quiz" && <QuizTab topic={topic} />}
        {tab === "egzamin" && <ExamTab topics={[topic]} />}
        {tab === "info" && <InfoTab topic={topic} />}
      </div>
    </SubjectTheme>
  );
}
