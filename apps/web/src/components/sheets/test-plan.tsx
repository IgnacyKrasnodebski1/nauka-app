"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { dayDiff, pl, todayStr, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { loadLibrary } from "@/lib/client-data";
import { addDays, inDays, noEmoji } from "@/lib/dates";
import { createTest, levelKey, questionsInScope, subjectLevelKeys, unfinishedLevels } from "@/lib/tests";
import { useUi } from "@/components/app/chrome";
import { Sheet } from "@/components/ui/sheet";
import { Icon } from "@/components/ui/icons";
import { Mono, themeStyle } from "@/components/ui/mono";
import { cn } from "@/lib/utils";

/** „Mam sprawdzian” (legacy openTestSheet): subject chips, native date (min tomorrow), level scope → createTest → plan screen. */
export function TestPlanSheet({ subjectId }: { subjectId: string | null }) {
  const { closeSheet } = useUi();
  const { supabase, user, tests, setTests, allProgress, weak, toast } = useApp();
  const router = useRouter();
  const [lib, setLib] = useState<{ subjects: Subject[]; topics: Topic[] } | null>(null);
  const [sel, setSel] = useState<string | null>(subjectId);
  const [date, setDate] = useState(addDays(todayStr(), 7));
  const [levels, setLevels] = useState<string[] | null>(null);
  useEffect(() => {
    loadLibrary(supabase, user.id).then((l) => {
      setLib(l);
      if (!sel) setSel(l.subjects[0]?.id ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user.id]);
  const subject = lib?.subjects.find((s) => s.id === sel) ?? null;
  const topics = useMemo(() => (lib && subject ? lib.topics.filter((t) => t.subjectId === subject.id) : []), [lib, subject]);
  const all = useMemo(() => subjectLevelKeys(topics), [topics]);
  const lv = levels ?? all;
  const N = dayDiff(todayStr(), date);
  const left = unfinishedLevels(topics, allProgress(), lv).length;
  const nq = questionsInScope(topics, lv);
  const existing = tests.find((t) => t.subjectId === sel);
  const go = () => {
    if (!subject) return;
    if (!all.length) return toast("Ten przedmiot nie ma jeszcze tematów", "alert");
    const r = createTest(tests, subject.id, date, lv, topics, allProgress(), weak);
    setTests(r.tests);
    closeSheet();
    toast("Plan gotowy", "calendar");
    router.push(`/app/testplan/${r.test.id}`);
  };
  return (
    <Sheet kind="testplan" onClose={closeSheet} label="Mam sprawdzian">
      <div className="shandle" />
      <div className="shead">
        <div className="st2">Mam sprawdzian</div>
        <button type="button" className="backbtn sclose" aria-label="Zamknij" onClick={closeSheet}><Icon name="close" size={18} stroke={3} /></button>
      </div>
      <div className="eyebrow sec">Przedmiot</div>
      <div className="tpchips">
        {!lib && <span className="spinner" />}
        {lib?.subjects.map((s) => (
          <button key={s.id} type="button" className={cn("tpchip themed", s.id === sel && "on")} style={themeStyle(s.accent2)} onClick={() => { setSel(s.id); setLevels(null); }}>
            <Mono text={s.name} cls="solid" />{noEmoji(s.name)}
          </button>
        ))}
        {lib && !lib.subjects.length && <span className="sp">Najpierw dodaj przedmiot.</span>}
      </div>
      <div className="eyebrow sec">Kiedy</div>
      <label className="tpdate">
        <Icon name="calendar" size={18} stroke={2.4} />
        <input type="date" min={addDays(todayStr(), 1)} value={date} aria-label="Data sprawdzianu" onChange={(e) => { const v = e.target.value; setDate(v && dayDiff(todayStr(), v) >= 1 ? v : addDays(todayStr(), 1)); }} />
        <span>{inDays(Math.max(0, N))}</span>
      </label>
      <div className="eyebrow sec">Zakres</div>
      <div className="tpchips">
        <button type="button" className={cn("tpchip", lv.length === all.length && "on")} onClick={() => setLevels(null)}>wszystkie</button>
        {topics.flatMap((t) => t.levels.map((l) => {
          const k = levelKey(t.id, l.id);
          const on = lv.includes(k);
          return (
            <button key={k} type="button" className={cn("tpchip", on && "on")} aria-pressed={on} onClick={() => { const next = on ? lv.filter((x) => x !== k) : all.filter((x) => x === k || lv.includes(x)); const val = next.length ? next : [k]; setLevels(val.length === all.length ? null : val); }}>
              {topics.length > 1 ? noEmoji(t.short || t.name) + " · " : ""}{noEmoji(l.title)}
            </button>
          );
        }))}
      </div>
      <div className="tpsum">
        <Icon name="bulb" size={16} />
        <span>{N} {pl(N, "dzień", "dni", "dni")} · {left ? `${left} ${pl(left, "poziom", "poziomy", "poziomów")} do nauki` : "wszystko zaliczone, zostają powtórki"} · {nq} {pl(nq, "pytanie", "pytania", "pytań")} na próbny{existing ? " · zastąpi obecny plan" : ""}</span>
      </div>
      <button type="button" className="pill a-glow" data-primary onClick={go} disabled={!subject}>UŁÓŻ PLAN</button>
    </Sheet>
  );
}
