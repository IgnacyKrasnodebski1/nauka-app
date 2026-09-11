"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildExamPlan, todayStr, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { daysUntil } from "@/lib/types";

const DAY = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];
function fmtDay(d: string): string {
  const [y, m, dd] = d.split("-").map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, dd);
  return `${DAY[dt.getDay()]} ${dd}.${String(m).padStart(2, "0")}`;
}

/** "Mam sprawdzian" — exam date + label on the subject, plan from buildExamPlan, countdown. */
export function ExamPlan({ subject, topics }: { subject: Subject; topics: Topic[] }) {
  const { supabase, allProgress, ready, toast } = useApp();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(subject.examDate ?? "");
  const [label, setLabel] = useState(subject.examLabel ?? "");
  const [busy, setBusy] = useState(false);

  async function save(clear = false) {
    setBusy(true);
    const { error } = await supabase.from("subjects").update({ exam_date: clear ? null : date || null, exam_label: clear ? null : label.trim() || null }).eq("id", subject.id);
    setBusy(false);
    if (error) return toast("Nie udało się zapisać 😵");
    toast(clear ? "Usunięte" : "Plan gotowy 📅");
    setEditing(false);
    router.refresh();
  }

  if (!subject.examDate && !editing)
    return (
      <div className="card mb-4">
        <h3>📅 Mam sprawdzian</h3>
        <p className="mb-3">Podaj datę, a rozłożymy poziomy na dni i dorzucimy symulację dzień wcześniej.</p>
        <button type="button" className="pill ghost" onClick={() => setEditing(true)}>Ustaw datę sprawdzianu</button>
      </div>
    );

  if (editing)
    return (
      <form className="card mb-4 space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <h3>📅 Sprawdzian</h3>
        <div>
          <label className="label" htmlFor="exam-date">Data</label>
          <input id="exam-date" type="date" className="input" required min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="exam-label">Nazwa (opcjonalnie)</label>
          <input id="exam-label" className="input" placeholder="np. kartkówka z fotosyntezy" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="pill" disabled={busy || !date}>Zapisz</button>
          <button type="button" className="pill ghost" onClick={() => setEditing(false)}>Anuluj</button>
          {subject.examDate && <button type="button" className="pill ghost" onClick={() => save(true)}>Usuń</button>}
        </div>
      </form>
    );

  const n = daysUntil(subject.examDate!);
  const plan = ready ? buildExamPlan(topics, allProgress(), subject.examDate!) : null;
  return (
    <div className="card mb-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3>📅 {subject.examLabel || "Sprawdzian"}</h3>
          <p>{n < 0 ? `${-n} dni temu — jak poszło?` : n === 0 ? "DZIŚ. Powodzenia 🍀" : `za ${n} ${n === 1 ? "dzień" : "dni"} · ${plan?.levelsLeft ?? "…"} poziomów do zrobienia`}</p>
        </div>
        <button type="button" className="chip" onClick={() => setEditing(true)}>zmień</button>
      </div>
      {plan && n >= 0 && topics.length > 0 && (
        <ol className="mt-3 space-y-2 list-none p-0 m-0">
          {plan.days.slice(0, 7).map((d, i) => (
            <li key={d.date} className="text-sm flex gap-3">
              <span className="font-black w-[64px] shrink-0 text-muted">{i === 0 ? "dziś" : fmtDay(d.date)}</span>
              <span className="flex-1 flex flex-wrap gap-x-2 gap-y-1">
                {d.tasks.map((t, k) =>
                  t.kind === "level" ? (
                    <Link key={k} href={`/app/t/${t.topicId}/l/${t.levelId}`} className="underline">📘 {t.label}</Link>
                  ) : (
                    <span key={k} className="text-muted">{t.kind === "exam" ? "🎯" : "🎴"} {t.label}</span>
                  ),
                )}
              </span>
            </li>
          ))}
          {plan.days.length > 7 && <li className="text-xs text-muted">… i {plan.days.length - 7} kolejnych dni</li>}
        </ol>
      )}
      {plan && topics.length === 0 && <p className="text-sm mt-2">Najpierw dodaj tematy — wtedy ułożymy plan.</p>}
    </div>
  );
}
