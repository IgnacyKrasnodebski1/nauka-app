"use client";
import Link from "next/link";
import { subjectCompletion, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { examBadge } from "@/lib/types";

export function SubjectCard({ s, topics }: { s: Subject; topics: Pick<Topic, "id" | "levels">[] }) {
  const { progressOf, ready } = useApp();
  let done = 0,
    total = 0;
  for (const t of topics) {
    const c = subjectCompletion(t, ready ? progressOf(t.id) : { xp: 0, levels: {} });
    done += c.done;
    total += c.total;
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  const badge = examBadge(s.examDate, s.examLabel);
  return (
    <Link href={`/app/s/${s.id}`} className="subjcard" style={{ ["--sa" as string]: s.accent }}>
      <div className="subjemoji" aria-hidden="true">{s.emoji}</div>
      <div className="subjmeta">
        <h3>{s.name}</h3>
        <div className="sub">{topics.length ? `${topics.length} ${plural(topics.length, "temat", "tematy", "tematów")}` : "jeszcze pusto — dodaj pierwszy temat"}</div>
        {badge && <span className="tag !mb-0 mt-2" style={{ background: "#ff3b5c33", color: "#ffb3c1" }}>📅 {badge}</span>}
        <div className="subjprog">
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <small>{pct}% poziomów</small>
        </div>
      </div>
      <div className="chev" aria-hidden="true">›</div>
    </Link>
  );
}

export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const m10 = n % 10,
    m100 = n % 100;
  if (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) return few;
  return many;
}
