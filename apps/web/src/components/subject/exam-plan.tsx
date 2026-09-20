"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildExamPlan, todayStr, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { daysUntil } from "@/lib/types";
import { Btn3d } from "@/components/ui/btn3d";
import { Icon } from "@/components/ui/icons";
import { Mascot } from "@/components/mascot/mascot";

const DAY = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];
function fmtDay(d: string): string {
  const [y, m, dd] = d.split("-").map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, dd);
  return `${DAY[dt.getDay()]} ${dd}.${String(m).padStart(2, "0")}`;
}

/** "Mam sprawdzian" — exam date + label on the subject, plan from buildExamPlan, countdown with the thinking mascot. */
export function ExamPlan({ subject, topics }: { subject: Subject; topics: Topic[] }) {
  const { supabase, allProgress, ready, toast, streak } = useApp();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(subject.examDate ?? "");
  const [label, setLabel] = useState(subject.examLabel ?? "");
  const [busy, setBusy] = useState(false);

  async function save(clear = false) {
    setBusy(true);
    const { error } = await supabase.from("subjects").update({ exam_date: clear ? null : date || null, exam_label: clear ? null : label.trim() || null }).eq("id", subject.id);
    setBusy(false);
    if (error) return toast("Nie udało się zapisać");
    toast(clear ? "Usunięte" : "Plan gotowy");
    setEditing(false);
    router.refresh();
  }

  if (!subject.examDate && !editing)
    return (
      <div className="card3d soft-orange mt-3 mb-4 flex items-center gap-3">
        <div className="tile sm" style={{ background: "var(--play-orange-soft)", borderColor: "var(--play-orange-deep)", boxShadow: "0 3px 0 var(--play-orange-deep)", color: "var(--play-orange)" }} aria-hidden="true"><Icon name="calendar" size={20} /></div>
        <div className="flex-1 min-w-0">
          <h3>Mam sprawdzian</h3>
          <p>Podaj datę — rozłożymy poziomy na dni.</p>
        </div>
        <Btn3d variant="orange" size="sm" onClick={() => setEditing(true)}>Ustaw</Btn3d>
      </div>
    );

  if (editing)
    return (
      <form className="card3d mt-3 mb-4 space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <span className="tag">Sprawdzian</span>
        <div>
          <label className="label" htmlFor="exam-date">Data</label>
          <input id="exam-date" type="date" className="input" required min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="exam-label">Nazwa (opcjonalnie)</label>
          <input id="exam-label" className="input" placeholder="np. kartkówka z fotosyntezy" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn3d green" disabled={busy || !date}>Zapisz</button>
          <Btn3d variant="ghost" onClick={() => setEditing(false)}>Anuluj</Btn3d>
          {subject.examDate && <Btn3d variant="ghost" onClick={() => save(true)}>Usuń</Btn3d>}
        </div>
      </form>
    );

  const n = daysUntil(subject.examDate!);
  const plan = ready ? buildExamPlan(topics, allProgress(), subject.examDate!) : null;
  return (
    <div className="card3d soft-orange mt-3 mb-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className="tag" style={{ color: "var(--play-orange)" }}>Sprawdzian</span>
          <h3>{subject.examLabel || "Sprawdzian"}</h3>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="display font-extrabold text-txt" style={{ fontSize: 34, lineHeight: 1 }}>{n < 0 ? -n : n}</span>
            <span className="text-muted text-sm font-bold">{n < 0 ? "dni temu — jak poszło?" : n === 0 ? "DZIŚ. Powodzenia" : `${n === 1 ? "dzień" : "dni"} · ${plan?.levelsLeft ?? "…"} poziomów do zrobienia`}</span>
          </div>
        </div>
        <Mascot state="think" size={64} streak={streak} />
      </div>
      <button type="button" className="chip mt-2" onClick={() => setEditing(true)}>zmień datę</button>
      {plan && n >= 0 && topics.length > 0 && (
        <ol className="mt-3 list-none p-0 m-0 divide-y divide-[var(--line)]">
          {plan.days.slice(0, 7).map((d, i) => (
            <li key={d.date} className="text-sm flex gap-3 py-2.5">
              <span className="eyebrow w-[64px] shrink-0 pt-0.5">{i === 0 ? "dziś" : fmtDay(d.date)}</span>
              <span className="flex-1 flex flex-wrap gap-x-2 gap-y-1">
                {d.tasks.map((t, k) =>
                  t.kind === "level" ? (
                    <Link key={k} href={`/app/t/${t.topicId}/l/${t.levelId}`} className="hue font-bold">{t.label}</Link>
                  ) : (
                    <span key={k} className="text-muted font-semibold">{t.label}</span>
                  ),
                )}
              </span>
            </li>
          ))}
          {plan.days.length > 7 && <li className="text-xs text-muted pt-2">… i {plan.days.length - 7} kolejnych dni</li>}
        </ol>
      )}
      {plan && topics.length === 0 && <p className="text-sm mt-2">Najpierw dodaj tematy — wtedy ułożymy plan.</p>}
    </div>
  );
}
