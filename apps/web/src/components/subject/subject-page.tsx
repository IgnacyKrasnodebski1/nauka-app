"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { levelProgress, subjectCompletion, unlockedIndex, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { m } from "@/lib/motion";
import { useSfx } from "@/lib/sfx";
import { TopBar } from "@/components/app/chrome";
import { SubjectTheme } from "@/components/topic/theme";
import { FlashcardsTab } from "@/components/topic/flashcards";
import { ExamTab } from "@/components/topic/exam";
import { ExamPlan } from "@/components/subject/exam-plan";
import { plural } from "@/components/app/subject-card";
import { Btn3d } from "@/components/ui/btn3d";
import { Icon } from "@/components/ui/icons";
import { Ring } from "@/components/ui/ring";
import { Mascot } from "@/components/mascot/mascot";
import { cn } from "@/lib/utils";

const TABS = [
  ["tematy", "Tematy"],
  ["fiszki", "Fiszki"],
  ["egzamin", "Egzamin"],
] as const;
type Tab = (typeof TABS)[number][0];

export function SubjectPage({ subject, topics }: { subject: Subject; topics: Topic[] }) {
  const { progressOf, ready, supabase, toast, streak } = useApp();
  const sfx = useSfx();
  const params = useSearchParams();
  const router = useRouter();
  const fromUrl = params.get("tab") as Tab | null;
  const tab: Tab = fromUrl && TABS.some((t) => t[0] === fromUrl) ? fromUrl : "tematy";
  const [busy, setBusy] = useState(false);
  const xp = ready ? topics.reduce((a, t) => a + progressOf(t.id).xp, 0) : 0;
  let done = 0,
    total = 0,
    stars = 0;
  for (const t of topics) {
    const p = ready ? progressOf(t.id) : { xp: 0, levels: {} };
    const c = subjectCompletion(t, p);
    done += c.done;
    total += c.total;
    stars += t.levels.reduce((a, l) => a + levelProgress(p, l.id).stars, 0);
  }
  const pct = total ? Math.round((done / total) * 100) : 0;

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
      <TopBar back="/app" title={<span className="subline">Przedmiot</span>} />
      <div className="unitbar">
        <span className="emo" aria-hidden="true">{subject.emoji}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate">{subject.name}</h1>
          <div className="sub flex items-center gap-3 flex-wrap">
            <span>{topics.length} {plural(topics.length, "temat", "tematy", "tematów")}</span>
            <span className="inline-flex items-center gap-1"><Icon name="star" size={13} />{stars}/{total * 3}</span>
            <span className="inline-flex items-center gap-1"><Icon name="bolt" size={13} />{xp} XP</span>
          </div>
        </div>
        <Ring pct={pct} size={58} stroke={8} color="#fff" track="rgba(0,0,0,0.3)">
          <span className="display text-[13px] font-extrabold" style={{ color: "#fff" }}>{pct}%</span>
        </Ring>
      </div>
      <div className="subtabs" role="tablist" aria-label="Sekcje przedmiotu">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={cn("subtab", tab === k && "active")} onClick={() => { sfx.play("tap"); router.replace(`?tab=${k}`, { scroll: false }); }}>{label}</button>
        ))}
      </div>
      <div className="px-4" role="tabpanel">
        {tab === "tematy" && (
          <>
            <ExamPlan subject={subject} topics={topics} />
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Link href={`/app/s/${subject.id}/new?mode=materials`} className="card3d purple press feature-tile !min-h-0" onClick={() => sfx.play("tap")}>
                <span className="ic"><Icon name="camera" size={24} /></span>
                <h3 style={{ color: "#fff" }}>Z materiałów</h3>
                <p>zdjęcia, PDF, tekst</p>
              </Link>
              <Link href={`/app/s/${subject.id}/new?mode=prompt`} className="card3d blue press feature-tile !min-h-0" onClick={() => sfx.play("tap")}>
                <span className="ic"><Icon name="pen" size={24} /></span>
                <h3 style={{ color: "#fff" }}>Z hasła</h3>
                <p>np. „fotosynteza”</p>
              </Link>
            </div>
            <div className="section-title !mt-2"><span className="eyebrow">Jednostki · {topics.length}</span></div>
            {topics.length === 0 ? (
              <div className="card3d empty">
                <Mascot state="think" size={100} streak={streak} say="Wrzuć notatki albo wpisz hasło — ja robię resztę." bubbleSide="top" />
                <Btn3d variant="green" href={`/app/s/${subject.id}/new?mode=prompt`}>Pierwszy temat</Btn3d>
              </div>
            ) : (
              topics.map((t, i) => {
                const p = ready ? progressOf(t.id) : { xp: 0, levels: {} };
                const c = subjectCompletion(t, p);
                const st = t.levels.reduce((a, l) => a + levelProgress(p, l.id).stars, 0);
                const next = t.levels[unlockedIndex(t, p)];
                const all = c.total > 0 && c.done === c.total;
                return (
                  <m.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <div className="card3d unitrow">
                      <span className="emo" aria-hidden="true">{t.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="eyebrow" style={{ color: "var(--hue)" }}>Jednostka {i + 1}</div>
                        <Link href={`/app/t/${t.id}`}><h3>{t.name}</h3></Link>
                        <div className="sub flex items-center gap-2 flex-wrap">
                          <span>{c.done}/{c.total} poz.</span>
                          <span className="inline-flex items-center gap-0.5"><Icon name="star" size={12} style={{ color: "var(--play-yellow)" }} />{st}/{t.levels.length * 3}</span>
                          <span>{t.source === "prompt" ? "z hasła" : "z materiałów"}</span>
                        </div>
                        <div className="bar mt-2" style={{ maxWidth: 200 }}><i style={{ width: `${c.pct}%` }} /></div>
                      </div>
                      <Btn3d variant={all ? "ghost" : "hue"} size="sm" href={all || !next ? `/app/t/${t.id}` : `/app/t/${t.id}/l/${next.id}`}>
                        {all ? "Powtórz" : c.done ? "Kontynuuj" : "Start"}
                      </Btn3d>
                    </div>
                  </m.div>
                );
              })
            )}
            <button type="button" className="btn3d ghost danger mt-6" disabled={busy} onClick={remove}>Usuń przedmiot</button>
          </>
        )}
        {tab === "fiszki" && <FlashcardsTab topics={topics} />}
        {tab === "egzamin" && <ExamTab topics={topics} />}
      </div>
    </SubjectTheme>
  );
}
