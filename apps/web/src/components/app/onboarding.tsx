"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CURRICULUM, STAGES, SubjectInputSchema, paletteFor, type Stage } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { cn } from "@/lib/utils";

interface Pick {
  key: string;
  name: string;
  emoji: string;
}

/**
 * First-login onboarding (stage → subject chips from CURRICULUM + custom) and the "+ przedmiot" picker.
 * Creates `subjects` rows with paletteFor(name).
 */
export function SubjectPicker({ mode, existing, onClose }: { mode: "onboarding" | "add"; existing: string[]; onClose?: () => void }) {
  const { supabase, user, stage: savedStage, setStage, toast } = useApp();
  const router = useRouter();
  const [step, setStep] = useState<"stage" | "subjects">(mode === "onboarding" ? "stage" : "subjects");
  const [stage, setLocalStage] = useState<Stage>(savedStage ?? "liceum");
  const [picked, setPicked] = useState<Pick[]>([]);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  const chips = CURRICULUM[stage];

  const toggle = (c: Pick) => setPicked((p) => (p.some((x) => x.key === c.key) ? p.filter((x) => x.key !== c.key) : [...p, c]));
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
      const rows = picked.map((p, i) => {
        const [accent, accent2] = paletteFor(p.name);
        const input = SubjectInputSchema.parse({ name: p.name, emoji: p.emoji, category: p.key.startsWith("custom:") ? "inne" : p.key, stage });
        return { owner_id: user.id, name: input.name, emoji: input.emoji, category: input.category, stage: input.stage, accent, accent2, position: existing.length + i };
      });
      const { error } = await supabase.from("subjects").insert(rows);
      if (error) throw error;
      toast(picked.length === 1 ? "Przedmiot dodany ✅" : `${picked.length} przedmioty dodane ✅`);
      onClose?.();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message || "Nie udało się zapisać.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[75] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="sp-title">
      <div className="card w-full max-w-md pop max-h-[92dvh] overflow-y-auto">
        {step === "stage" ? (
          <>
            <span className="tag">hej 👋 · krok 1/2</span>
            <h2 id="sp-title" className="text-2xl font-black tracking-tight">Na jakim etapie jesteś?</h2>
            <p className="text-muted text-sm mt-1 mb-4">Dopasujemy przedmioty, język i trudność pytań. Zmienisz to potem w koncie.</p>
            <div className="grid grid-cols-2 gap-3">
              {STAGES.map((s) => (
                <button key={s.id} type="button" onClick={() => { setLocalStage(s.id); setPicked([]); setStep("subjects"); }} className={cn("card text-left !p-4 hover:border-white/30 transition", stage === s.id && "!border-[var(--accent2)]")}>
                  <div className="text-3xl">{s.emoji}</div>
                  <div className="font-black mt-1">{s.label}</div>
                  <div className="text-muted text-xs">{s.hint}</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="tag">{mode === "onboarding" ? "krok 2/2" : "nowy przedmiot"}</span>
              {mode === "onboarding" ? (
                <button type="button" className="chip" onClick={() => setStep("stage")}>← etap</button>
              ) : (
                <button type="button" className="chip" onClick={onClose}>zamknij</button>
              )}
            </div>
            <h2 id="sp-title" className="text-2xl font-black tracking-tight">{mode === "onboarding" ? "Czego się uczysz?" : "Dodaj przedmiot"}</h2>
            <p className="text-muted text-sm mt-1 mb-3">Zaznacz przedmioty — każdy dostanie własną półkę na tematy.</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Przedmioty">
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
              <button type="button" className="pill sm" onClick={addCustom}>dodaj</button>
            </div>
            {err && <div className="exfb bad" role="alert">{err}</div>}
            <button type="button" className="pill mt-4" disabled={busy || !picked.length} onClick={save}>
              {busy ? "zapisuję…" : picked.length ? `Lecimy z ${picked.length} 🚀` : "Wybierz przedmioty"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
