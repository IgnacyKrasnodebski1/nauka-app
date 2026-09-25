"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { dayDiff, levelProgress, todayStr, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { loadLibrary } from "@/lib/client-data";
import { deckSize } from "@/lib/review";
import { splitKey, syncTests, tpSub, tpTitle, TP_ICON, type PlanRow, type TestPlan } from "@/lib/tests";
import { DAYS, DAYS_S, dateOf, fmtDate, inDays, MONTHS_S, noEmoji } from "@/lib/dates";
import { Shell } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";
import { themeStyle } from "@/components/ui/mono";
import { RingSvg } from "@/components/topic/exam";
import { cn } from "@/lib/utils";

/** TestPlan.html: readiness ring, day-by-day rows (done / missed / today / future / rest), exam day, actions per row. */
export function TestPlanScreen({ id }: { id: string }) {
  const { ready, supabase, user, tests, setTests, allProgress, weak, exams, toast } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "";
  const [lib, setLib] = useState<{ subjects: Subject[]; topics: Topic[] } | null>(null);
  useEffect(() => { loadLibrary(supabase, user.id).then(setLib); }, [supabase, user.id]);
  const t = tests.find((x) => x.id === id) ?? null;
  const subject = lib?.subjects.find((s) => s.id === t?.subjectId) ?? null;
  const topics = useMemo(() => (lib && t ? lib.topics.filter((x) => x.subjectId === t.subjectId) : []), [lib, t]);
  const progress = allProgress();
  useEffect(() => {
    if (!ready || !lib || !t) return;
    const synced = syncTests(tests, (sid) => lib.topics.filter((x) => x.subjectId === sid), progress, weak);
    if (synced !== tests) setTests(synced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, lib]);
  const back = () => router.push(from.startsWith("topic:") ? `/app/t/${from.slice(6)}?tab=egzamin` : from === "subject" && subject ? `/app/s/${subject.id}` : "/app");
  if (!ready || !lib) return <Shell title="Plan do sprawdzianu" pills={false} back={back} cls="tplan"><div className="spinner" /></Shell>;
  if (!t || !subject) return <Shell title="Plan do sprawdzianu" pills={false} backHref="/app" cls="tplan"><div className="tpnote">Ten plan już nie istnieje — sprawdzian minął albo plan został usunięty.</div></Shell>;
  const today = todayStr(), N = dayDiff(today, t.date);
  const total = t.levels.length, done = t.levels.filter((k) => { const { topicId, levelId } = splitKey(k); return levelProgress(progress[topicId] ?? { xp: 0, levels: {} }, levelId).done; }).length;
  const best = Math.max(0, ...topics.map((x) => exams[x.id]?.best?.pct ?? 0));
  const readyPct = Math.round(((total ? done / total : 0) * 0.6 + (best / 100) * 0.4) * 100);
  const d = dateOf(t.date);
  const allKeys = topics.flatMap((x) => x.levels.map((l) => `${x.id}:${l.id}`));
  const scope = total === allKeys.length ? "cały przedmiot" : t.levels.map((k) => { const { topicId, levelId } = splitKey(k); return noEmoji(topics.find((x) => x.id === topicId)?.levels.find((l) => l.id === levelId)?.title); }).filter(Boolean).join(", ");
  const todayRow = t.plan.find((r) => r.date === today);
  const action = (r: PlanRow) => {
    if (r.kind === "rest") return toast("Dziś wolne. Odpoczynek też się liczy", "check");
    if (r.kind === "learn") {
      const key = (r.lv ?? []).find((k) => { const { topicId, levelId } = splitKey(k); return !levelProgress(progress[topicId] ?? { xp: 0, levels: {} }, levelId).done; }) ?? r.lv?.[0];
      if (!key) return;
      const { topicId, levelId } = splitKey(key);
      const tp = topics.find((x) => x.id === topicId);
      const i = tp?.levels.findIndex((l) => l.id === levelId) ?? -1;
      if (!tp || i < 0) return;
      const unlocked = i === 0 || levelProgress(progress[topicId] ?? { xp: 0, levels: {} }, tp.levels[i - 1]!.id).done;
      return router.push(unlocked ? `/app/t/${topicId}/l/${levelId}` : `/app/t/${topicId}`);
    }
    const topicOf = (kind: "weak" | "mock" | "review") => {
      const ids = [...new Set(t.levels.map((k) => splitKey(k).topicId))];
      if (kind === "weak") return ids.find((tid) => deckSize(tid, weak) > 0) ?? ids[0];
      return ids[0];
    };
    if (r.kind === "review" && r.short) return router.push(`/app/cram/${topicOf("review")}`);
    if (r.kind === "review") { const tid = topicOf("review"); const lv = t.levels.filter((k) => k.startsWith(tid + ":")).map((k) => splitKey(k).levelId); return router.push(`/app/review?topic=${tid}&levels=${lv.join(",")}`); }
    if (r.kind === "weak") { const tid = topicOf("weak"); if (tid && deckSize(tid, weak) > 0) return router.push(`/app/review?deck=${tid}`); }
    return router.push(`/app/t/${topicOf("mock")}?tab=egzamin`);
  };
  return (
    <div className="contents" style={themeStyle(subject.accent2)}>
      <Shell title="Plan do sprawdzianu" pills={false} back={back} cls="tplan">
        <div className="tphero a-up">
          <div className="rvring a-pop"><RingSvg pct={readyPct} /><div className="rvpct"><b>{readyPct}%</b><span>gotowość</span></div></div>
          <div className="grow"><div className="s">{noEmoji(subject.name)} · {scope}</div><div className="d">{DAYS[d.getDay()]!.toLowerCase()}, {d.getDate()} {MONTHS_S[d.getMonth()]}</div><div className="in a-blink">{inDays(N)}</div></div>
        </div>
        <div className="tprows">
          {t.plan.map((r, i) => {
            const dd = dateOf(r.date);
            const state = r.date < today ? (r.done ? "tp-done" : "tp-missed") : r.date === today ? (r.done ? "tp-now tp-done" : "tp-now") : "tp-future";
            return (
              <button key={r.date} type="button" className={cn("tprow", state, r.kind === "rest" && "tp-rest", r.date === today ? "a-pop" : "a-up d" + Math.min(6, i + 1))} aria-label={`${fmtDate(r.date)}: ${tpTitle(r, topics)}`} onClick={() => (r.date < today ? toast(r.done ? "Zrobione" : "Ten dzień minął — plan przeliczony", "calendar") : action(r))}>
                <div className="dy"><small>{DAYS_S[dd.getDay()]}</small><b>{dd.getDate()}</b></div>
                <div className="ico"><Icon name={r.done ? "check" : TP_ICON[r.kind]} size={18} stroke={r.done ? 3.4 : 2.4} /></div>
                <div className="grow"><div className="t">{tpTitle(r, topics)}</div><div className="s">{r.date < today && !r.done ? "pominięte — plan przeliczony" : tpSub(r)}</div></div>
                {r.date === today && <span className={cn("badge2", !r.done && "a-blink")}>{r.done ? "zrobione" : "dziś"}</span>}
              </button>
            );
          })}
          <div className="tprow tp-exam a-up d6"><div className="dy"><small>{DAYS_S[d.getDay()]}</small><b>{d.getDate()}</b></div><div className="ico"><Icon name="flag" size={18} /></div><div className="grow"><div className="t">Sprawdzian</div><div className="s">powodzenia</div></div>{N === 0 && <span className="badge2">dziś</span>}</div>
        </div>
        <div className="tpnote">Opuścisz dzień? Plan sam się przeliczy. Nauka i powtórki z planu liczą się też do planu dnia.</div>
        <div className="tpfoot">
          {todayRow && !todayRow.done && todayRow.kind !== "rest" ? <button type="button" className="pill a-glow" onClick={() => action(todayRow)}>ZACZNIJ DZISIEJSZE</button> : <button type="button" className="pill ghost" onClick={back}>{N === 0 ? "POWODZENIA" : "NA DZIŚ WSZYSTKO"}</button>}
          <button type="button" className="pill text" onClick={() => { if (!confirm("Usunąć plan do sprawdzianu?")) return; setTests(tests.filter((x) => x.id !== t.id)); toast("Plan usunięty", "close"); router.push("/app"); }}>Usuń plan</button>
        </div>
      </Shell>
    </div>
  );
}
export type { TestPlan };
