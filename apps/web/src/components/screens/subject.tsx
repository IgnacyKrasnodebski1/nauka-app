"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { allFlashcards, dayDiff, pl, subjectCompletion, todayStr, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { invalidateLibrary } from "@/lib/client-data";
import { inDays, initial, noEmoji } from "@/lib/dates";
import { useUi, GemPill, HeartsPill, BackBtn } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";
import { themeStyle } from "@/components/ui/mono";
import { cn } from "@/lib/utils";

/** Subject = container: band like Path.html, topic rows (progress), "Mam sprawdzian", add material, delete. */
export function SubjectScreen({ subject, topics }: { subject: Subject; topics: Topic[] }) {
  const { ready, progressOf, tests, supabase, toast } = useApp();
  const { openTestSheet } = useUi();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const test = tests.find((t) => t.subjectId === subject.id) ?? null;
  let total = 0, done = 0, xp = 0;
  for (const t of topics) {
    const p = ready ? progressOf(t.id) : { xp: 0, levels: {} };
    const c = subjectCompletion(t, p);
    total += c.total;
    done += c.done;
    xp += p.xp;
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  const cards = topics.reduce((a, t) => a + allFlashcards(t).length, 0);
  const remove = async () => {
    if (!confirm(`Usunąć „${subject.name}” razem z ${topics.length} ${pl(topics.length, "tematem", "tematami", "tematami")} i postępami? Tego nie da się cofnąć.`)) return;
    setBusy(true);
    const { error } = await supabase.from("subjects").delete().eq("id", subject.id);
    setBusy(false);
    if (error) return toast("Nie udało się usunąć", "alert");
    invalidateLibrary();
    toast("Przedmiot usunięty", "close");
    router.push("/app");
    router.refresh();
  };
  return (
    <div className="contents" style={themeStyle(subject.accent2)}>
      <div className="band">
        <div className="brow">
          <BackBtn href="/app" label="Wróć do planu dnia" />
          <div className="bmeta">
            <div className="bname"><div className="mono xs solid" aria-hidden="true">{initial(subject.name)}</div><span>{noEmoji(subject.name)}</span></div>
            <div className="bprog"><div className="bar"><i className="a-grow" style={{ width: `${pct}%` }} /></div><span>{done}/{total} · <b>{xp}</b> xp</span></div>
          </div>
          <GemPill />
          <HeartsPill iconBeat />
        </div>
        {test ? (
          <Link href={`/app/testplan/${test.id}?from=subject`} className="bandtest"><Icon name="calendar" size={15} stroke={2.6} /><span>Sprawdzian {inDays(dayDiff(todayStr(), test.date))}</span><small>· plan dzień po dniu</small><Icon name="chevron-right" size={16} className="chev" /></Link>
        ) : (
          <button type="button" className="bandtest" onClick={() => openTestSheet(subject.id)}><Icon name="calendar" size={15} stroke={2.6} /><span>Mam sprawdzian</span><small>· ułożę plan do daty</small><Icon name="chevron-right" size={16} className="chev" /></button>
        )}
      </div>
      <div className="screen active">
        <div className="scroll">
          <div className="blob a-float mid" aria-hidden="true" />
          <div className="sechdr"><span className="eyebrow sec">Tematy · {topics.length}</span><span className="eyebrow sec">{cards} {pl(cards, "fiszka", "fiszki", "fiszek")}</span></div>
          {topics.length ? (
            <div className="setcard a-up d1">
              {topics.map((t, i) => {
                const p = ready ? progressOf(t.id) : { xp: 0, levels: {} };
                const c = subjectCompletion(t, p);
                return (
                  <div key={t.id} className="contents">
                    {i > 0 && <div className="setsep" />}
                    <Link href={`/app/t/${t.id}`} className="setrow themed">
                      <div className="mono solid xs" aria-hidden="true">{initial(t.short || t.name)}</div>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="t">{noEmoji(t.name)}</div>
                        <div className="s">{c.done}/{c.total} {pl(c.total, "poziom", "poziomy", "poziomów")} · {p.xp} xp{t.tagline?.includes("DEMO") ? " · demo" : ""}</div>
                        <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${c.pct}%` }} /></div>
                      </div>
                      <Icon name="chevron-right" size={18} className="chev" />
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="plan a-up d1"><div className="plan-row later"><div className="plan-tile"><Icon name="bulb" size={18} /></div><div className="pt"><div className="t">Jeszcze pusto</div><div className="s">dodaj materiał — powstaną poziomy, fiszki i pytania</div></div></div></div>
          )}
          <div className="eyebrow sec">Dodaj temat</div>
          <div className="qagrid">
            <Link href={`/app/s/${subject.id}/new?mode=photo`} className="qatile pink a-up d1"><Icon name="camera" size={24} stroke={2.6} /><div><div className="t">Zdjęcie</div><div className="s">strona, zeszyt, tablica</div></div></Link>
            <Link href={`/app/s/${subject.id}/new?mode=file`} className="qatile cyan a-up d2"><Icon name="upload" size={24} stroke={2.6} /><div><div className="t">Plik lub tekst</div><div className="s">PDF, zdjęcia, notatki</div></div></Link>
          </div>
          <Link href={`/app/s/${subject.id}/new?mode=prompt`} className="qatest a-up d3"><Icon name="bulb" size={20} stroke={2.4} /><span>Samo hasło — wg podstawy programowej</span><Icon name="chevron-right" size={18} stroke={2.6} className="chev" /></Link>
          {topics.length > 0 && (
            <>
              <div className="eyebrow sec">Cały przedmiot</div>
              <div className="setcard a-up d4">
                <Link href="/app/cards" className="setrow"><Icon name="cards" size={20} stroke={2.4} className="ic-cyan" /><div className="grow"><div className="t">Fiszki</div><div className="s">{cards} {pl(cards, "pojęcie", "pojęcia", "pojęć")} we wszystkich tematach</div></div><Icon name="chevron-right" size={18} className="chev" /></Link>
                <div className="setsep" />
                <Link href="/app/review" className="setrow"><Icon name="refresh" size={20} stroke={2.4} className="ic-cyan" /><div className="grow"><div className="t">Powtórka</div><div className="s">to, co dziś wraca</div></div><Icon name="chevron-right" size={18} className="chev" /></Link>
              </div>
            </>
          )}
          <div className="version" style={{ paddingTop: 8 }}>
            <button type="button" className={cn("pill text", busy && "a-blink")} disabled={busy} onClick={remove}>Usuń przedmiot</button>
          </div>
        </div>
      </div>
    </div>
  );
}
