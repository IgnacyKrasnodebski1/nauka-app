"use client";
import { useEffect, useRef, useState } from "react";
import { checkTypeTerm, pl, type TypeTermTask } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { Foot, Title, type TaskApi } from "./common";

/** WPISZ POJĘCIE (TypeTerm.html): definition card, input, letter dashes, "Pierwsza litera · −2 XP", "Nie pamiętam". */
export function TypeTermTaskView({ task, api }: { task: TypeTermTask; api: TaskApi }) {
  const ans = String(task.answer || "");
  const letters = ans.replace(/\s+/g, "").length;
  const tol = task.typo ?? 1;
  const [val, setVal] = useState("");
  const [locked, setLocked] = useState(false);
  const [state, setState] = useState<"" | "ok" | "bad">("");
  const [hinted, setHinted] = useState(false);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => inp.current?.focus(), 80); return () => clearTimeout(t); }, []);
  const check = () => {
    if (locked || !val.trim()) return;
    setLocked(true);
    const ok = checkTypeTerm(task, val);
    setState(ok ? "ok" : "bad");
    api.finish(ok, { e: task.e, sub: ok ? "" : "Poprawnie: " + ans, src: task.src });
  };
  const giveUp = () => {
    if (locked) return;
    setLocked(true);
    setVal(ans);
    setState("bad");
    api.finish(false, { e: task.e, sub: "Poprawnie: " + ans, src: task.src });
  };
  const hint = () => {
    if (locked || hinted) return;
    setHinted(true);
    if (!val) setVal(ans.charAt(0));
    api.onHintXp?.();
    inp.current?.focus();
  };
  const typed = val.replace(/\s+/g, "").length;
  return (
    <>
      <div><Title>{task.title || "Jak to się nazywa?"}</Title></div>
      <div className="defcard a-up d1"><div className="eyebrow">Definicja</div><div className="deftext">{task.definition}</div></div>
      <div className="a-up d2">
        <label className="eyebrow" htmlFor="term">Twoja odpowiedź</label>
        <div className={cn("termbox", state, state === "bad" && "a-shake")}>
          <input id="term" ref={inp} className="terminput" type="text" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Twoja odpowiedź" value={val} disabled={locked} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); check(); } }} />
        </div>
        <div className="letters" aria-hidden="true">{ans.split("").map((ch, k) => (/\s/.test(ch) ? <b key={k} /> : <i key={k} className={k - ans.slice(0, k).replace(/\S/g, "").length < typed ? "on" : ""} />))}</div>
        <div className="termmeta">{letters} {pl(letters, "litera", "litery", "liter")}{tol ? " · literówka w jednym miejscu jest akceptowana" : ""}</div>
      </div>
      <div className="termbtns a-up d3">
        <button type="button" className="hintbtn gold" disabled={hinted || locked} onClick={hint}>{hinted ? `Zaczyna się na „${ans.charAt(0).toUpperCase()}”` : "Pierwsza litera · −2 XP"}</button>
        <button type="button" className="hintbtn" disabled={locked} onClick={giveUp}>Nie pamiętam</button>
      </div>
      <Foot api={api}><button type="button" className="pill" disabled={!val.trim() || locked} onClick={check}>SPRAWDŹ</button></Foot>
    </>
  );
}
