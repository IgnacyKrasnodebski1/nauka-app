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
  ["tematy", "Tematy"],
  ["fiszki", "Fiszki"],
  ["egzamin", "Egzamin"],
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
  let done = 0,
    total = 0;
  for (const t of topics) {
    const c = subjectCompletion(t, ready ? progressOf(t.id) : { xp: 0, levels: {} });
    done += c.done;
    total += c.total;
  }

  async function remove() {
    if (!confirm(`Usunąć „${subject.name}” razem z ${topics.length} ${plural(topics.length, "tematem", "tematami", "tematami")} i postępami? Tego nie da się cofnąć.`)) return;
    setBusy(true);
    const { error } = await supabase.from("subjects").delete().eq("id", subject.id);
    setBusy(false);
    if (error) return toast("Nie udało się usunąć");
    toast("Usunięte");
    router.push("/app");
    router.refresh();
  }

  return (
    <SubjectTheme s={subject}>
      <TopBar back="/app" title={<span className="subline">Przedmiot</span>} xp={xp} />
      <div className="glow-head px-4 pt-5 pb-2">
        <div className="flex items-center gap-4">
          <div className="tile lg" aria-hidden="true">{subject.emoji}</div>
          <div className="min-w-0">
            <h1 className="truncate" style={{ fontSize: 26 }}>{subject.name}</h1>
            <div className="text-muted text-sm mt-1">{topics.length} {plural(topics.length, "temat", "tematy", "tematów")} · {done}/{total} poziomów</div>
          </div>
        </div>
        <div className="progressrow mt-4 mb-0"><div className="bar"><i style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div><span className="counter">{total ? Math.round((done / total) * 100) : 0}%</span></div>
      </div>
      <div className="subtabs" role="tablist" aria-label="Sekcje przedmiotu">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={cn("subtab", tab === k && "active")} onClick={() => router.replace(`?tab=${k}`, { scroll: false })}>{label}</button>
        ))}
      </div>
      <div className="px-4" role="tabpanel">
        {tab === "tematy" && (
          <>
            <ExamPlan subject={subject} topics={topics} />
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Link href={`/app/s/${subject.id}/new?mode=materials`} className="card hover !p-4">
                <div className="tile sm mb-3" aria-hidden="true">📸</div>
                <h3>Z materiałów</h3>
                <p>zdjęcia, PDF, tekst</p>
              </Link>
              <Link href={`/app/s/${subject.id}/new?mode=prompt`} className="card hover !p-4">
                <div className="tile sm mb-3" aria-hidden="true">✍️</div>
                <h3>Z hasła</h3>
                <p>np. „fotosynteza”</p>
              </Link>
            </div>
            <div className="section-title"><span className="eyebrow">Tematy · {topics.length}</span></div>
            {topics.length === 0 ? (
              <div className="empty">
                <div className="tile neutral" aria-hidden="true">📄</div>
                <p>Wrzuć zdjęcia notatek albo wpisz hasło — AI zrobi z tego poziomy.</p>
                <Link href={`/app/s/${subject.id}/new?mode=prompt`} className="pill sm">Pierwszy temat</Link>
              </div>
            ) : (
              topics.map((t) => {
                const p = ready ? progressOf(t.id) : { xp: 0, levels: {} };
                const c = subjectCompletion(t, p);
                const stars = t.levels.reduce((a, l) => a + levelProgress(p, l.id).stars, 0);
                return (
                  <Link key={t.id} href={`/app/t/${t.id}`} className="subjcard">
                    <div className="tile" aria-hidden="true">{t.emoji}</div>
                    <div className="subjmeta">
                      <h3>{t.name}</h3>
                      <div className="sub">{t.source === "prompt" ? "z hasła" : "z materiałów"} · {t.levels.length} {plural(t.levels.length, "poziom", "poziomy", "poziomów")} · <span style={{ color: "var(--accent)" }}>★</span> {stars}/{t.levels.length * 3}</div>
                      <div className="subjprog">
                        <div className="bar"><i style={{ width: `${c.pct}%` }} /></div>
                        <small>{c.done}/{c.total}</small>
                      </div>
                    </div>
                    <div className="chev" aria-hidden="true">›</div>
                  </Link>
                );
              })
            )}
            <button type="button" className="pill text mt-6" style={{ color: "var(--danger)" }} disabled={busy} onClick={remove}>Usuń przedmiot</button>
          </>
        )}
        {tab === "fiszki" && <FlashcardsTab topics={topics} />}
        {tab === "egzamin" && <ExamTab topics={topics} />}
      </div>
    </SubjectTheme>
  );
}
