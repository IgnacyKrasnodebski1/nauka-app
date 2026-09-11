"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { levelProgress, subjectCompletion, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { TopBar } from "@/components/app/chrome";
import { SubjectTheme } from "@/components/topic/theme";
import { FlashcardsTab } from "@/components/topic/flashcards";
import { ExamTab } from "@/components/topic/exam";
import { ExamPlan } from "@/components/subject/exam-plan";
import { plural } from "@/components/app/subject-card";
import { cn } from "@/lib/utils";

const TABS = [
  ["tematy", "📚 Tematy"],
  ["fiszki", "🎴 Fiszki"],
  ["egzamin", "🎯 Egzamin"],
] as const;
type Tab = (typeof TABS)[number][0];

export function SubjectPage({ subject, topics }: { subject: Subject; topics: Topic[] }) {
  const { progressOf, ready, supabase, toast } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const fromUrl = params.get("tab") as Tab | null;
  const tab: Tab = fromUrl && TABS.some((t) => t[0] === fromUrl) ? fromUrl : "tematy";
  const [busy, setBusy] = useState(false);
  const xp = ready ? topics.reduce((a, t) => a + progressOf(t.id).xp, 0) : 0;

  async function remove() {
    if (!confirm(`Usunąć „${subject.name}” razem z ${topics.length} ${plural(topics.length, "tematem", "tematami", "tematami")} i postępami? Tego nie da się cofnąć.`)) return;
    setBusy(true);
    const { error } = await supabase.from("subjects").delete().eq("id", subject.id);
    setBusy(false);
    if (error) return toast("Nie udało się usunąć 😵");
    toast("Usunięte 🗑️");
    router.push("/app");
    router.refresh();
  }

  return (
    <SubjectTheme s={subject}>
      <TopBar back="/app" title={<>{subject.emoji} <span className="g">{subject.name}</span></>} xp={xp} />
      <div className="subtabs" role="tablist" aria-label="Sekcje przedmiotu">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={cn("subtab", tab === k && "active")} onClick={() => router.replace(`?tab=${k}`, { scroll: false })}>{label}</button>
        ))}
      </div>
      <div className="px-4" role="tabpanel">
        {tab === "tematy" && (
          <>
            <ExamPlan subject={subject} topics={topics} />
            <div className="grid grid-cols-2 gap-3 mb-5">
              <Link href={`/app/s/${subject.id}/new?mode=materials`} className="card !p-4 text-center hover:border-white/30">
                <div className="text-3xl">📸</div>
                <div className="font-black mt-1">Z materiałów</div>
                <div className="text-muted text-xs">zdjęcia, PDF, tekst</div>
              </Link>
              <Link href={`/app/s/${subject.id}/new?mode=prompt`} className="card !p-4 text-center hover:border-white/30">
                <div className="text-3xl">✍️</div>
                <div className="font-black mt-1">Z hasła</div>
                <div className="text-muted text-xs">np. „fotosynteza”</div>
              </Link>
            </div>
            <h2 className="text-[13px] font-black uppercase tracking-wider text-muted mb-3">Tematy ({topics.length})</h2>
            {topics.length === 0 ? (
              <div className="addcard mb-6">
                <div className="subjemoji" aria-hidden="true">🫥</div>
                <div>Jeszcze pusto.<br /><span className="text-[12.5px] font-semibold">Wrzuć zdjęcia notatek albo wpisz hasło — AI zrobi z tego poziomy.</span></div>
              </div>
            ) : (
              topics.map((t) => {
                const p = ready ? progressOf(t.id) : { xp: 0, levels: {} };
                const c = subjectCompletion(t, p);
                const stars = t.levels.reduce((a, l) => a + levelProgress(p, l.id).stars, 0);
                return (
                  <Link key={t.id} href={`/app/t/${t.id}`} className="subjcard" style={{ ["--sa" as string]: subject.accent }}>
                    <div className="subjemoji" aria-hidden="true">{t.emoji}</div>
                    <div className="subjmeta">
                      <h3>{t.name}</h3>
                      <div className="sub">{t.source === "prompt" ? "✍️ z hasła" : "📸 z materiałów"} · {t.levels.length} {plural(t.levels.length, "poziom", "poziomy", "poziomów")}</div>
                      <div className="subjprog">
                        <div className="bar"><i style={{ width: `${c.pct}%` }} /></div>
                        <small>{c.done}/{c.total} · ⭐ {stars}/{t.levels.length * 3}</small>
                      </div>
                    </div>
                    <div className="chev" aria-hidden="true">›</div>
                  </Link>
                );
              })
            )}
            <button type="button" className="pill ghost mt-6 !text-red" disabled={busy} onClick={remove}>Usuń przedmiot</button>
          </>
        )}
        {tab === "fiszki" && <FlashcardsTab topics={topics} />}
        {tab === "egzamin" && <ExamTab topics={topics} />}
      </div>
    </SubjectTheme>
  );
}
