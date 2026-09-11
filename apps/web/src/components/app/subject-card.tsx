"use client";
import Link from "next/link";
import { subjectCompletion } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import type { AppSubject } from "@/lib/types";

export function SubjectCard({ s, badge }: { s: AppSubject; badge?: string }) {
  const { progressOf, ready } = useApp();
  const p = ready ? progressOf(s) : { xp: 0, levels: {} };
  const c = subjectCompletion(s, p);
  return (
    <Link href={`/app/s/${s.slug ?? s.id}`} className="subjcard" style={{ ["--sa" as string]: s.accent }}>
      <div className="subjemoji" aria-hidden="true">{s.emoji}</div>
      <div className="subjmeta">
        <h3>{s.name}</h3>
        <div className="sub">{s.tagline}</div>
        <div className="subjprog">
          <div className="bar"><i style={{ width: `${c.pct}%` }} /></div>
          <small>{c.done}/{c.total} poziomów{badge ? ` · ${badge}` : ""}</small>
        </div>
      </div>
      <div className="chev" aria-hidden="true">›</div>
    </Link>
  );
}
