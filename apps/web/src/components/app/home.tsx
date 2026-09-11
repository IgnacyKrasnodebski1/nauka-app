"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { buildDailySession, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { hueOf } from "@/lib/hue";
import { TopBar } from "@/components/app/chrome";
import { SubjectCard } from "@/components/app/subject-card";
import { SubjectPicker } from "@/components/app/onboarding";
import { examBadge } from "@/lib/types";

export function Home({ subjects, topics }: { subjects: Subject[]; topics: Topic[] }) {
  const { ready, user, allProgress, allSrs, weak, toast, streak } = useApp();
  const params = useSearchParams();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (params.get("upgraded")) toast("Witaj w Pro ⚡");
  }, [params, toast]);

  const session = useMemo(() => (ready ? buildDailySession(topics, allProgress(), allSrs(), weak) : null), [ready, topics, allProgress, allSrs, weak]);
  const first = user.name?.split(" ")[0] || null;
  const upcoming = subjects.filter((s) => s.examDate).sort((a, b) => (a.examDate! < b.examDate! ? -1 : 1))[0];
  const sessionTopic = session?.items[0] ? topics.find((t) => t.id === session.items[0]!.topicId) : undefined;
  const sessionSubject = subjects.find((s) => s.id === sessionTopic?.subjectId) ?? subjects[0];
  const hue = sessionSubject ? hueOf(sessionSubject) : undefined;

  return (
    <>
      <TopBar title={<>NAUKA</>} />
      <div className="px-4" style={hue ? ({ "--hue": hue } as CSSProperties) : undefined}>
        <div className="hero">
          <div className="eyebrow mb-2">{new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1>{first ? `Cześć, ${first}.` : "Cześć."}</h1>
          <p>{streak > 0 ? `Seria ${streak} dni — trzymaj tempo.` : "10 minut dziennie robi robotę."}{upcoming?.examDate ? ` ${upcoming.name}: ${examBadge(upcoming.examDate, upcoming.examLabel)}.` : ""}</p>
        </div>

        {/* Dziś — hero card */}
        <div className="card glow-head mb-6" style={{ overflow: "hidden" }}>
          <div className="eyebrow mb-3">Dziś</div>
          {!session ? (
            <div className="flex items-center gap-3 text-muted"><span className="spinner" /> liczę sesję…</div>
          ) : session.items.length === 0 ? (
            <>
              <h2 className="mb-1">Na dziś pusto</h2>
              <p>Dodaj pierwszy temat w przedmiocie, a jutro pojawią się tu powtórki.</p>
            </>
          ) : (
            <>
              <h2 className="display" style={{ fontSize: 28 }}>~{session.minutes} min nauki</h2>
              <p className="mt-1">{session.newLevel ? <>Nowy poziom: <b>{session.newLevel.title}</b></> : "Same powtórki — szybko pójdzie."}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="streak"><b className="hue">{session.reviewCount}</b><small>powtórki</small></span>
                <span className="streak"><b style={{ color: "var(--danger)" }}>{session.weakCount}</b><small>słabe</small></span>
                <span className="streak"><b style={{ color: "var(--success)" }}>{session.newLevel ? 1 : 0}</b><small>nowy</small></span>
              </div>
              <Link href="/app/today" className="pill mt-5">Start</Link>
            </>
          )}
        </div>

        <div className="section-title">
          <h3 className="eyebrow" style={{ fontFamily: "var(--font-body)" }}>Twoje przedmioty</h3>
          <button type="button" className="chip" onClick={() => setAdding(true)}>+ przedmiot</button>
        </div>
        {subjects.length === 0 ? (
          <div className="empty">
            <div className="tile neutral" aria-hidden="true">📚</div>
            <p>Dodaj przedmioty, potem wrzuć do nich tematy.</p>
            <button type="button" className="pill sm" onClick={() => setAdding(true)}>Dodaj przedmiot</button>
          </div>
        ) : (
          subjects.map((s) => <SubjectCard key={s.id} s={s} topics={topics.filter((t) => t.subjectId === s.id)} />)
        )}
      </div>

      {(subjects.length === 0 || adding) && (
        <SubjectPicker mode={subjects.length === 0 ? "onboarding" : "add"} existing={subjects.map((s) => s.name)} onClose={() => setAdding(false)} />
      )}
    </>
  );
}
