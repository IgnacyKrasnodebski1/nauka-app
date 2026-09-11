"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { STAGES } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import type { AppSubject } from "@/lib/types";
import { TopBar } from "@/components/app/chrome";
import { SubjectCard } from "@/components/app/subject-card";

export function Home({ own, library, serverUserId }: { own: AppSubject[]; library: AppSubject[]; serverUserId: string | null }) {
  const { ready, user, progressOf, stage, toast, supabase } = useApp();
  const params = useSearchParams();

  useEffect(() => {
    if (params.get("upgraded")) toast("Witaj w Pro ⚡");
  }, [params, toast]);

  const started = useMemo(() => (ready ? library.filter((s) => progressOf(s).xp > 0 || Object.keys(progressOf(s).levels).length > 0) : []), [library, progressOf, ready]);
  const mine = [...own, ...started.filter((s) => !own.some((o) => o.id === s.id))];
  const stageLabel = STAGES.find((s) => s.id === stage)?.label;
  const showGuestHint = ready && !user && !serverUserId;

  return (
    <>
      <TopBar title={<>📚 <span className="g">NAUKA</span></>} />
      <div className="px-4">
        <div className="hero">
          <h1>{user ? `Siema${user.user_metadata?.full_name ? ", " + String(user.user_metadata.full_name).split(" ")[0] : ""} 👋` : "Siema 👋"}</h1>
          <p>{stageLabel ? `${stageLabel} · ` : ""}Poziomy jak w Duolingo, fiszki, mini-gry i egzamin próbny.{showGuestHint ? " Uczysz się jako gość — postępy zostają w tej przeglądarce." : ""}</p>
        </div>

        <Link href="/app/new" className="subjcard !mb-5" style={{ ["--sa" as string]: "var(--accent)" }}>
          <div className="subjemoji" aria-hidden="true">✨</div>
          <div className="subjmeta">
            <h3>Dodaj materiały</h3>
            <div className="sub">Screeny, notatki, PDF → AI zrobi z tego poziomy, fiszki i quizy.</div>
          </div>
          <div className="chev" aria-hidden="true">›</div>
        </Link>

        <h2 className="text-[13px] font-black uppercase tracking-wider text-muted mb-3">Twoje przedmioty</h2>
        {mine.length === 0 ? (
          <div className="addcard mb-6">
            <div className="subjemoji" aria-hidden="true">🫥</div>
            <div>Jeszcze pusto.<br /><span className="text-[12.5px] font-semibold">Wrzuć materiały albo zacznij coś z biblioteki niżej.</span></div>
          </div>
        ) : (
          mine.map((s) => <SubjectCard key={s.id} s={s} badge={s.ownerId ? "twój" : undefined} />)
        )}

        <h2 className="text-[13px] font-black uppercase tracking-wider text-muted mb-3 mt-6">Biblioteka</h2>
        <p className="text-muted text-sm mb-3">Gotowe przedmioty z prawdziwych zajęć — publiczne, za darmo.{!supabase ? " (tryb demo: z paczki @nauka/content)" : ""}</p>
        {library.map((s) => (
          <SubjectCard key={s.id} s={s} />
        ))}
      </div>
    </>
  );
}
