"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/lib/store/app-context";
import type { AppSubject } from "@/lib/types";
import { TopBar } from "@/components/app/chrome";
import { SubjectTheme } from "@/components/subject/theme";
import { PathTab } from "@/components/subject/path";
import { FlashcardsTab } from "@/components/subject/flashcards";
import { QuizTab } from "@/components/subject/quiz";
import { ExamTab } from "@/components/subject/exam";
import { InfoTab } from "@/components/subject/info";
import { cn } from "@/lib/utils";

const TABS = [
  ["path", "🗺️ Ścieżka"],
  ["fiszki", "🎴 Fiszki"],
  ["quiz", "🧠 Quiz"],
  ["egzamin", "🎯 Egzamin"],
  ["info", "📋 Info"],
] as const;
type Tab = (typeof TABS)[number][0];

export function SubjectShell({ subject }: { subject: AppSubject }) {
  const { progressOf, ready } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const fromUrl = params.get("tab") as Tab | null;
  const tab: Tab = fromUrl && TABS.some((t) => t[0] === fromUrl) ? fromUrl : "path";
  const go = (t: Tab) => router.replace(`?tab=${t}`, { scroll: false });
  const xp = ready ? progressOf(subject).xp : 0;

  return (
    <SubjectTheme s={subject}>
      <TopBar back="/app" title={<>{subject.emoji} <span className="g">{subject.short || subject.name}</span></>} subjectXp={xp} />
      <div className="subtabs" role="tablist" aria-label="Sekcje przedmiotu">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={cn("subtab", tab === k && "active")} onClick={() => go(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="px-4" role="tabpanel">
        {tab === "path" && <PathTab subject={subject} />}
        {tab === "fiszki" && <FlashcardsTab subject={subject} />}
        {tab === "quiz" && <QuizTab subject={subject} />}
        {tab === "egzamin" && <ExamTab subject={subject} />}
        {tab === "info" && <InfoTab subject={subject} />}
      </div>
    </SubjectTheme>
  );
}
