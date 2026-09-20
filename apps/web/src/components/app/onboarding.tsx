"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CURRICULUM, DAILY_GOALS, DAILY_GOAL_LABEL, STAGES, SubjectInputSchema, paletteFor, type DailyGoal, type Stage } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { AnimatePresence, m } from "@/lib/motion";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Btn3d } from "@/components/ui/btn3d";
import { Icon } from "@/components/ui/icons";
import { SegmentedProgress } from "@/components/ui/segmented-progress";
import { Mascot } from "@/components/mascot/mascot";

interface Pick {
  key: string;
  name: string;
  emoji: string;
}

type Step = "stage" | "subjects" | "goal" | "start";
const STEPS: Step[] = ["stage", "subjects", "goal", "start"];

/**
 * First-login onboarding with the mascot (stage → subjects → daily goal → start) and the "+ przedmiot" picker.
 * Creates `subjects` rows with paletteFor(name).
 */
export function SubjectPicker({ mode, existing, onClose }: { mode: "onboarding" | "add"; existing: string[]; onClose?: () => void }) {
  const { supabase, user, stage: savedStage, setStage, toast, setDailyGoal, dailyGoal } = useApp();
  const sfx = useSfx();
  const router = useRouter();
  const [step, setStep] = useState<Step>(mode === "onboarding" ? "stage" : "subjects");
  const [stage, setLocalStage] = useState<Stage>(savedStage ?? "liceum");
  const [goal, setGoal] = useState<DailyGoal>(dailyGoal);
  const [picked, setPicked] = useState<Pick[]>([]);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  const chips = CURRICULUM[stage];
  const stepIdx = STEPS.indexOf(step);

  const toggle = (c: Pick) => {
    sfx.play("tap");
    setPicked((p) => (p.some((x) => x.key === c.key) ? p.filter((x) => x.key !== c.key) : [...p, c]));
  };
  const addCustom = () => {
    const name = custom.trim();
    if (!name) return;
    if (taken.has(name.toLowerCase()) || picked.some((p) => p.name.toLowerCase() === name.toLowerCase())) return setErr("Taki przedmiot już jest.");
    setPicked((p) => [...p, { key: `custom:${name.toLowerCase()}`, name, emoji: "📘" }]);
    setCustom("");
    setErr(null);
  };

  async function save() {
    if (!picked.length) return setErr("Wybierz chociaż jeden przedmiot.");
    setBusy(true);
    setErr(null);
    try {
      if (mode === "onboarding" || savedStage !== stage) setStage(stage);
      if (mode === "onboarding") setDailyGoal(goal);
      const rows = picked.map((p, i) => {
        const [accent, accent2] = paletteFor(p.name);
        const input = SubjectInputSchema.parse({ name: p.name, emoji: p.emoji, category: p.key.startsWith("custom:") ? "inne" : p.key, stage });
        return { owner_id: user.id, name: input.name, emoji: input.emoji, category: input.category, stage: input.stage, accent, accent2, position: existing.length + i };
      });
      const { error } = await supabase.from("subjects").insert(rows);
      if (error) throw error;
      sfx.play("levelup");
      toast(picked.length === 1 ? "Przedmiot dodany" : `${picked.length} przedmioty dodane`, "xp");
      onClose?.();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message || "Nie udało się zapisać.");
    } finally {
      setBusy(false);
    }
  }

  const anim = { initial: { opacity: 0, x: 30 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -30 }, transition: { type: "spring", stiffness: 320, damping: 30 } } as const;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="sp-title">
      <div className="card3d" style={{ width: "100%", maxWidth: 440, maxHeight: "92dvh", overflowY: "auto" }}>
        {mode === "onboarding" && (
          <div className="flex items-center gap-3 mb-4">
            <SegmentedProgress total={4} done={stepIdx} label={`Krok ${stepIdx + 1} z 4`} />
            <span className="counter">{stepIdx + 1}/4</span>
          </div>
        )}
        <AnimatePresence mode="wait">
          {step === "stage" && (
            <m.div key="stage" {...anim}>
              <div className="flex items-center gap-3 mb-4">
                <Mascot state="happy" size={84} />
                <div className="bubble-say" style={{ maxWidth: "none" }}>Cześć, jestem <b>Rec</b>. Powiedz mi, na jakim etapie jesteś, a dopasuję przedmioty i trudność.</div>
              </div>
              <h2 id="sp-title">Na jakim etapie jesteś?</h2>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {STAGES.map((s) => (
                  <button key={s.id} type="button" onClick={() => { sfx.play("tap"); setLocalStage(s.id); setPicked([]); setStep("subjects"); }} className={cn("card3d press text-left", stage === s.id ? "soft-green" : "glass")}>
                    <div className="text-[30px] leading-none mb-2" aria-hidden="true">{s.emoji}</div>
                    <div className="display font-bold text-[15px] text-txt">{s.label}</div>
                    <div className="text-muted text-xs mt-0.5 font-semibold">{s.hint}</div>
                  </button>
                ))}
              </div>
            </m.div>
          )}

          {step === "subjects" && (
            <m.div key="subjects" {...anim}>
              <div className="flex items-center justify-between mb-2">
                {mode === "onboarding" ? (
                  <button type="button" className="chip" onClick={() => setStep("stage")}><Icon name="back" size={14} />etap</button>
                ) : (
                  <span className="tag !mb-0">Nowy przedmiot</span>
                )}
                {mode === "add" && <button type="button" className="chip" onClick={onClose}>zamknij</button>}
              </div>
              {mode === "onboarding" && (
                <div className="flex items-center gap-3 mb-3">
                  <Mascot state="think" size={72} />
                  <div className="bubble-say" style={{ maxWidth: "none" }}>Każdy przedmiot dostanie własną półkę na tematy.</div>
                </div>
              )}
              <h2 id="sp-title">{mode === "onboarding" ? "Czego się uczysz?" : "Dodaj przedmiot"}</h2>
              <div className="flex flex-wrap gap-2 mt-4" role="group" aria-label="Przedmioty">
                {chips.map((c) => {
                  const has = taken.has(c.name.toLowerCase());
                  const on = picked.some((x) => x.key === c.key);
                  return (
                    <button key={c.key} type="button" className={cn("chip", on && "active", has && "opacity-40")} disabled={has} aria-pressed={on} onClick={() => toggle(c)}>
                      {c.emoji} {c.name}{has ? " ✓" : ""}
                    </button>
                  );
                })}
                {picked.filter((p) => p.key.startsWith("custom:")).map((p) => (
                  <button key={p.key} type="button" className="chip active" onClick={() => toggle(p)}>{p.emoji} {p.name} ✕</button>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <label htmlFor="custom-subject" className="sr-only">Własny przedmiot</label>
                <input id="custom-subject" className="input" placeholder="własny, np. Anatomia" value={custom} maxLength={60} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())} />
                <Btn3d variant="blue" size="sm" onClick={addCustom}>dodaj</Btn3d>
              </div>
              {err && <div className="exfb bad" role="alert">{err}</div>}
              {mode === "onboarding" ? (
                <Btn3d variant="green" className="mt-4" disabled={!picked.length} onClick={() => setStep("goal")}>{picked.length ? `Dalej (${picked.length})` : "Wybierz przedmioty"}</Btn3d>
              ) : (
                <Btn3d variant="green" className="mt-4" disabled={busy || !picked.length} onClick={save}>{busy ? "Zapisuję…" : picked.length ? `Dodaj (${picked.length})` : "Wybierz przedmioty"}</Btn3d>
              )}
            </m.div>
          )}

          {step === "goal" && (
            <m.div key="goal" {...anim}>
              <button type="button" className="chip mb-2" onClick={() => setStep("subjects")}><Icon name="back" size={14} />przedmioty</button>
              <div className="flex items-center gap-3 mb-3">
                <Mascot state="idle" size={72} />
                <div className="bubble-say" style={{ maxWidth: "none" }}>Ile XP dziennie? Cel możesz zmienić w koncie.</div>
              </div>
              <h2 id="sp-title">Cel dzienny</h2>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {DAILY_GOALS.map((g) => (
                  <button key={g} type="button" className={cn("card3d press text-center !p-3", goal === g ? "soft-green" : "glass")} aria-pressed={goal === g} onClick={() => { sfx.play("tap"); setGoal(g); }}>
                    <Icon name="target" size={22} style={{ color: goal === g ? "var(--play-green)" : "var(--muted)", margin: "0 auto 6px" }} />
                    <div className="display font-extrabold text-txt text-[20px]">{g} XP</div>
                    <div className="text-[11px] font-bold text-muted uppercase tracking-wider">{DAILY_GOAL_LABEL[g]}</div>
                  </button>
                ))}
              </div>
              <p className="text-muted text-sm mt-3 font-semibold">Jedna lekcja to ok. 40–60 XP. Cel dzienny daje bonus +10 XP i klejnoty.</p>
              <Btn3d variant="green" className="mt-4" onClick={() => setStep("start")}>Dalej</Btn3d>
            </m.div>
          )}

          {step === "start" && (
            <m.div key="start" {...anim} className="text-center">
              <Mascot state="cheer" size={120} say="Wszystko gotowe. Lecimy!" bubbleSide="top" />
              <h2 id="sp-title" className="mt-3">Gotowe do startu</h2>
              <p className="text-muted mt-2 font-semibold">{picked.length} {picked.length === 1 ? "przedmiot" : "przedmioty"} · cel {goal} XP dziennie · {STAGES.find((s) => s.id === stage)?.label}</p>
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {picked.map((p) => <span key={p.key} className="tag badge green !mb-0">{p.emoji} {p.name}</span>)}
              </div>
              {err && <div className="exfb bad text-left" role="alert">{err}</div>}
              <Btn3d variant="green" size="lg" className="mt-5" disabled={busy} onClick={save}>{busy ? "Zapisuję…" : "Zaczynamy"}</Btn3d>
              <button type="button" className="chip mt-3" onClick={() => setStep("goal")}><Icon name="back" size={14} />wstecz</button>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
