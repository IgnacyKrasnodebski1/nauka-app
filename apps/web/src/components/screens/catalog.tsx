"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CURRICULUM, foldAnswer, paletteFor, pl, STAGES, subjectCompletion, SUBJECT_HUES, type Stage, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { invalidateLibrary } from "@/lib/client-data";
import { initial, noEmoji } from "@/lib/dates";
import { LEVEL_NAME } from "@/components/screens/onboarding";
import { Shell, useUi } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";
import { themeStyle } from "@/components/ui/mono";
import { cn } from "@/lib/utils";

const CHIP: Record<Stage, string> = { podstawowa: "Podstawówka", liceum: "Liceum", studia: "Studia", inne: "Inne" };
const ORDER: Stage[] = ["podstawowa", "liceum", "studia", "inne"];

/**
 * Catalog.html — Odkrywaj: search, stage chips, CTA, your subjects (with progress) and the curriculum per stage.
 * A curriculum card creates the subject (paletteFor colour); `?add=1` then continues to the upload flow.
 */
export function CatalogScreen({ subjects, topics }: { subjects: Subject[]; topics: Topic[] }) {
  const { user, supabase, stage, allProgress, toast } = useApp();
  const { openQuickAdd } = useUi();
  const router = useRouter();
  const params = useSearchParams();
  const add = params.get("add") === "1", first = params.get("first") === "1";
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<Stage | "all">(stage ?? "all");
  const [busy, setBusy] = useState<string | null>(null);
  const progress = allProgress();
  const words = foldAnswer(q).split(" ").filter(Boolean);
  const hit = (s: string) => { const h = foldAnswer(s); return words.every((w) => h.includes(w)); };
  const mine = useMemo(() => subjects.filter((s) => (level === "all" || s.stage === level) && hit(s.name + " " + topics.filter((t) => t.subjectId === s.id).map((t) => t.name + " " + t.levels.map((l) => l.title).join(" ")).join(" "))), [subjects, topics, level, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = (level === "all" ? ORDER : [level]).map((st) => ({ st, items: CURRICULUM[st].filter((c) => hit(c.name + " " + LEVEL_NAME[st]) && !subjects.some((s) => s.stage === st && s.category === c.key && s.name === c.name)) })).filter((g) => g.items.length);
  const create = async (st: Stage, c: { key: string; name: string; emoji: string }) => {
    setBusy(c.key + st);
    const [accent, accent2] = paletteFor(c.name);
    const { data, error } = await supabase.from("subjects").insert({ owner_id: user.id, name: c.name, emoji: c.emoji, category: c.key, stage: st, accent, accent2, position: subjects.length }).select("id").single();
    setBusy(null);
    if (error || !data) return toast("Nie udało się dodać przedmiotu", "alert");
    invalidateLibrary();
    toast("Przedmiot dodany: " + c.name, "check");
    const id = (data as { id: string }).id;
    router.push(add ? `/app/s/${id}/new?mode=photo${first ? "&first=1" : ""}` : `/app/s/${id}`);
    router.refresh();
  };
  const pick = (s: Subject) => router.push(add ? `/app/s/${s.id}/new?mode=photo` : `/app/s/${s.id}`);
  const hueOf = (name: string) => SUBJECT_HUES[Math.abs([...name].reduce((a, ch) => a + ch.charCodeAt(0), 0)) % SUBJECT_HUES.length]!.color;
  return (
    <Shell nav={!add} title={add ? "Do którego przedmiotu?" : "Odkrywaj"} pills={false} cls="catalog" right={<Link href={first ? "/app" : add ? "/app" : "/app"} className="backbtn" aria-label="Zamknij"><Icon name="close" size={18} stroke={3} /></Link>}>
      <label className="catsearch a-up"><Icon name="search" size={20} stroke={2.6} /><span className="sr">Szukaj przedmiotu</span><input type="search" id="cat-search" placeholder="Przedmiot, dział albo temat" value={q} autoComplete="off" onChange={(e) => setQ(e.target.value)} /></label>
      <div className="catchips a-up d1">
        <button type="button" className={cn("catchip", level === "all" && "on")} aria-pressed={level === "all"} onClick={() => setLevel("all")}>Wszystkie</button>
        {STAGES.map((s) => <button key={s.id} type="button" className={cn("catchip", level === s.id && "on")} aria-pressed={level === s.id} onClick={() => setLevel(s.id)}>{CHIP[s.id]}</button>)}
      </div>
      {!add && <button type="button" className="catcta a-up d2" onClick={openQuickAdd}><div className="ico a-bob"><Icon name="upload" size={26} stroke={2.6} /></div><div className="grow"><div className="t">Masz notatki od nauczyciela?</div><div className="s">Zrób z nich temat w 3 minuty</div></div></button>}
      {add && <div className="infobox a-up d2"><Icon name="bulb" size={18} /><span>{first ? "Wybierz przedmiot na start — do niego wgrasz pierwszy materiał." : "Materiał trafi jako nowy temat do wybranego przedmiotu."}</span></div>}
      <div className="catlist">
        {mine.length > 0 && (
          <>
            <div className="eyebrow sec">Twoje przedmioty · {mine.length}</div>
            <div className="grid2 catgrid">
              {mine.map((s, i) => {
                const ts = topics.filter((t) => t.subjectId === s.id);
                let n = 0, done = 0;
                for (const t of ts) { const c = subjectCompletion(t, progress[t.id] ?? { xp: 0, levels: {} }); n += c.total; done += c.done; }
                return (
                  <button key={s.id} type="button" className={cn("catcard themed a-up", "d" + Math.min(6, i + 1))} style={themeStyle(s.accent2)} aria-label={`${s.name}, ${ts.length} tematów, otwórz`} onClick={() => pick(s)}>
                    <div className="mono solid" aria-hidden="true">{initial(s.name)}</div>
                    <div className="t">{noEmoji(s.name)}</div>
                    <div className="s">{ts.length ? ts.map((t) => noEmoji(t.short || t.name)).slice(0, 3).join(", ") : LEVEL_NAME[s.stage]}</div>
                    <div className="catmeta"><span>{done ? done + "/" : ""}{n} {pl(n, "poziom", "poziomy", "poziomów")}</span><span className="open">{add ? "Wybierz" : "Otwórz"} <Icon name="chevron-right" size={13} stroke={3.2} /></span></div>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {groups.map((g) => (
          <div key={g.st} className="contents">
            <div className="eyebrow sec">{LEVEL_NAME[g.st]} · {g.items.length}</div>
            <div className="grid2 catgrid">
              {g.items.map((c, i) => (
                <button key={c.key} type="button" className={cn("catcard themed a-up", "d" + Math.min(6, i + 1), busy === c.key + g.st && "a-blink")} style={themeStyle(hueOf(c.name))} disabled={!!busy} aria-label={`${c.name}, dodaj przedmiot`} onClick={() => create(g.st, c)}>
                  <div className="mono solid" aria-hidden="true">{initial(c.name)}</div>
                  <div className="t">{c.name}</div>
                  <div className="s">{LEVEL_NAME[g.st]}</div>
                  <div className="catmeta"><span>nowy przedmiot</span><span className="open">Dodaj <Icon name="plus" size={13} stroke={3.2} /></span></div>
                </button>
              ))}
            </div>
          </div>
        ))}
        {!mine.length && !groups.length && <div className="catempty a-up"><Icon name="search" size={26} stroke={2.2} /><div className="t">Nic nie znaleziono</div><div className="s">{words.length ? "Spróbuj krócej albo innym słowem — szukam też w tytułach tematów." : "Brak przedmiotów na tym etapie."}</div></div>}
      </div>
    </Shell>
  );
}
