"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { buildDailySession, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
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

  return (
    <>
      <TopBar title={<>📚 <span className="g">NAUKA</span></>} />
      <div className="px-4">
        <div className="hero !pb-3">
          <h1>{first ? `Siema, ${first} 👋` : "Siema 👋"}</h1>
          <p>{streak > 0 ? `Seria ${streak} dni — trzymaj tempo.` : "10 minut dziennie robi robotę."}{upcoming?.examDate ? ` 📅 ${upcoming.name}: ${examBadge(upcoming.examDate, upcoming.examLabel)}.` : ""}</p>
        </div>

        {/* Dziś */}
        <div className="fcard !p-5 mb-5">
          <span className="tag">⚡ Dziś</span>
          {!session ? (
            <div className="flex items-center gap-3 text-muted"><span className="spinner" /> liczę sesję…</div>
          ) : session.items.length === 0 ? (
            <>
              <div className="ftitle !text-[21px] !mb-2">Na dziś pusto</div>
              <div className="fbody !text-[15px]">Dodaj pierwszy temat w przedmiocie, a jutro pojawią się tu powtórki.</div>
            </>
          ) : (
            <>
              <div className="ftitle !text-[21px] !mb-2">~{session.minutes} min dzisiaj</div>
              <div className="fbody !text-[15px]">
                {session.reviewCount > 0 && <>🎴 {session.reviewCount} fiszek do powtórki<br /></>}
                {session.weakCount > 0 && <>🎯 {session.weakCount} pytań, które ostatnio nie weszły<br /></>}
                {session.newLevel && <>🆕 nowy poziom: <b>{session.newLevel.title}</b></>}
              </div>
              <Link href="/app/today" className="pill mt-4">Start ▶</Link>
            </>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-black uppercase tracking-wider text-muted">Twoje przedmioty</h2>
          <button type="button" className="chip" onClick={() => setAdding(true)}>+ przedmiot</button>
        </div>
        {subjects.length === 0 ? (
          <div className="addcard mb-6">
            <div className="subjemoji" aria-hidden="true">🫥</div>
            <div>Jeszcze pusto.<br /><span className="text-[12.5px] font-semibold">Dodaj przedmioty, potem wrzuć do nich tematy.</span></div>
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
