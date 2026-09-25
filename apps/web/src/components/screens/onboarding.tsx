"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DAILY_GOALS, DAILY_GOAL_LABEL, type DailyGoal, type Stage } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import type { Goal } from "@/lib/store/extra";
import { Toggle } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export const LEVELS: [Stage, string, string, string, string][] = [
  ["podstawowa", "Szkoła podstawowa", "klasy 4–8", "edit", "amber"],
  ["liceum", "Liceum lub technikum", "klasy 1–5", "book", "acid"],
  ["studia", "Studia", "licencjat, magisterka", "cap", "pink"],
  ["inne", "Coś innego", "języki, kursy, certyfikaty", "globe", "cyan"],
];
export const GOALS: [Goal, string, Stage[]][] = [
  ["sprawdziany", "Kartkówki i sprawdziany", ["podstawowa", "liceum", "inne"]],
  ["matura-p", "Matura podstawowa", ["liceum"]],
  ["matura-r", "Matura rozszerzona", ["liceum"]],
  ["olimpiada", "Olimpiada", ["podstawowa", "liceum"]],
  ["sesja", "Sesja i kolokwia", ["studia"]],
  ["wlasny", "Własny cel", ["podstawowa", "liceum", "studia", "inne"]],
];
export const GOAL_DEFAULT: Record<Stage, Goal> = { podstawowa: "sprawdziany", liceum: "matura-r", studia: "sesja", inne: "wlasny" };
export const LEVEL_NAME: Record<Stage, string> = { podstawowa: "Podstawówka", liceum: "Liceum / technikum", studia: "Studia", inne: "Inne" };
export const GOAL_NAME: Record<Goal, string> = { sprawdziany: "kartkówki i sprawdziany", "matura-p": "matura podstawowa", "matura-r": "matura rozszerzona", olimpiada: "olimpiada", sesja: "sesja i kolokwia", wlasny: "własny cel" };
const GOAL_MINS: Record<DailyGoal, string> = { 20: "5 minut", 50: "10 minut", 100: "20 minut" };
const GOAL_T: Record<DailyGoal, string> = { 20: "Spokojnie", 50: "Normalnie", 100: "Solidnie" };

function ObShell({ step, cls, children }: { step: number; cls: string; children: React.ReactNode }) {
  return (
    <div className="screen active">
      <div className="blob a-float acid" aria-hidden="true" />
      <div className={`scroll ob ${cls}`}>
        <div className="obdots" aria-label={`Krok ${step} z 3`}>
          {[1, 2, 3].map((i) => <i key={i} className={i < step ? "on" : i === step ? "cur a-blink" : ""} />)}
        </div>
        {children}
      </div>
    </div>
  );
}

/** LevelPick.html — stage + goal; from=first → Onboarding, else back to settings. */
export function LevelPickScreen() {
  const { stage: saved, setStage, goal: savedGoal, setGoal, toast } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const from = params.get("from") || "first";
  const [level, setLevel] = useState<Stage | null>(from === "first" ? null : saved);
  const [goal, setG] = useState<Goal | null>(savedGoal);
  const [first, setFirst] = useState(true);
  const pick = (id: Stage) => {
    setLevel(id);
    if (!goal || !GOALS.find((g) => g[0] === goal)![2].includes(id)) setG(GOAL_DEFAULT[id]);
    setFirst(false);
  };
  const next = () => {
    if (!level) return;
    setStage(level);
    setGoal(goal ?? GOAL_DEFAULT[level]);
    if (from === "first") router.push("/app/onboarding?from=first");
    else {
      toast("Zapisane: " + LEVEL_NAME[level], "check");
      router.push("/app/settings");
    }
  };
  return (
    <ObShell step={1} cls="levelpick">
      <div className="obhead a-up"><h1>Na jakim etapie jesteś?</h1><p>Dopasujemy poziom trudności, język wyjaśnień i gotowe przedmioty.</p></div>
      <div className="obopts">
        {LEVELS.map(([id, t, s, ic, tone], i) => {
          const on = level === id;
          return (
            <button key={id} type="button" className={cn("obopt", tone, on && "on", on && !first && "a-pop", first && "a-up d" + (i + 1))} aria-pressed={on} onClick={() => pick(id)}>
              <div className="ico"><Icon name={ic} size={24} stroke={2.6} /></div>
              <div className="grow"><div className="t">{t}</div><div className="s">{s}</div></div>
              <span className="ck">{on && <Icon name="check" size={16} stroke={4} />}</span>
            </button>
          );
        })}
      </div>
      <div className="eyebrow sec obeye">Do czego się przygotowujesz?</div>
      <div className="obchips">
        {GOALS.filter((g) => !level || g[2].includes(level)).map(([id, t], i) => (
          <button key={id} type="button" className={cn("obchip", goal === id && "on", first && "a-up d" + Math.min(6, i + 3))} aria-pressed={goal === id} onClick={() => setG(id)}>{t}</button>
        ))}
      </div>
      <div className="obfoot">
        <button type="button" className="pill a-glow" disabled={!level} onClick={next}>{from === "first" ? "DALEJ" : "ZAPISZ"}</button>
        {from !== "first" && <button type="button" className="pill text" onClick={() => router.push("/app/settings")}>Wróć bez zmian</button>}
      </div>
    </ObShell>
  );
}

/** Onboarding.html — daily goal (XP) + reminder. */
export function OnboardingScreen() {
  const { dailyGoal, setDailyGoal, reminder, setReminder, toast } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const from = params.get("from") || "first";
  const [goal, setG] = useState<DailyGoal>(dailyGoal);
  const [remOn, setRemOn] = useState(!!reminder?.on);
  const [first, setFirst] = useState(true);
  const at = reminder?.at || "19:30";
  const back = from === "today" ? "/app" : "/app/settings";
  const save = () => {
    setDailyGoal(goal);
    setReminder({ on: remOn, at });
    if (from === "first") {
      router.push("/app/catalog?add=1&first=1");
      setTimeout(() => toast("Cel dzienny: " + goal + " XP", "bolt"), 500);
    } else {
      toast("Cel dzienny: " + goal + " XP", "bolt");
      router.push(back);
    }
  };
  return (
    <ObShell step={2} cls="onboarding">
      <div className="obhead a-up"><h1>Ile czasu dziennie?</h1><p>Cel możesz zmienić w każdej chwili. Lepiej zacząć niżej i utrzymać serię.</p></div>
      <div className="obopts">
        {DAILY_GOALS.map((xp, i) => {
          const on = goal === xp;
          return (
            <button key={xp} type="button" className={cn("obopt goal", on && "on", on && !first && "a-pop", first && "a-up d" + (i + 1))} aria-pressed={on} onClick={() => { setG(xp); setFirst(false); }}>
              <i className="obbar" />
              <div className="grow"><div className="t">{GOAL_T[xp]}</div><div className="s">{GOAL_MINS[xp]} · {xp} XP · {DAILY_GOAL_LABEL[xp]}</div></div>
              <span className="ck">{on && <Icon name="check" size={16} stroke={4} />}</span>
            </button>
          );
        })}
      </div>
      <div className="obrem a-up d5">
        <div className="ico"><Icon name="bell" size={22} stroke={2.4} /></div>
        <div className="grow"><div className="t">Przypomnienie</div><div className="s">codziennie o <b>{at}</b> · wymaga aplikacji mobilnej</div></div>
        <Toggle on={remOn} label="Przypomnienie" onChange={setRemOn} />
      </div>
      <div className="obnote a-up d6"><Icon name="flame" size={20} className="ic-flame" /><span>Seria rośnie każdego dnia, w którym dobijesz cel.</span></div>
      <div className="obfoot">
        <button type="button" className="pill a-glow" onClick={save}>{from === "first" ? "USTAW CEL" : "ZAPISZ CEL"}</button>
        {from !== "first" && <button type="button" className="pill text" onClick={() => router.push(back)}>Wróć bez zmian</button>}
      </div>
    </ObShell>
  );
}
