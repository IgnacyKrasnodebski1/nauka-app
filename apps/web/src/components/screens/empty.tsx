"use client";
import { useUi } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";

const STEPS = [
  ["Dodajesz zdjęcia, pliki i notatki", "strona z podręcznika, PDF, wklejony tekst"],
  ["Powstają poziomy, fiszki i pytania", "możesz wszystko poprawić przed startem"],
  ["Uczysz się po 10 minut dziennie", "materiał wraca tuż przed zapomnieniem"],
];

/** EmptyState.html — no subjects yet. */
export function EmptyState() {
  const { openQuickAdd } = useUi();
  return (
    <div className="screen active">
      <div className="blob a-float acid" aria-hidden="true" />
      <div className="blob a-float d3 pink" aria-hidden="true" />
      <div className="scroll empty">
        <div className="logo brand">Recall<span className="g">.</span></div>
        <div className="art">
          <div className="art-a a-sway" /><div className="art-b a-sway d2" />
          <div className="art-c a-bob"><Icon name="upload" size={58} stroke={2.4} /></div>
        </div>
        <div className="a-up d1"><h1>Zacznij od pierwszego przedmiotu</h1><p>Dodaj materiały z zajęć. Reszta powstanie sama.</p></div>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={i} className={`step a-up d${i + 2}`}><div className="num">{i + 1}</div><div><div className="t">{s[0]}</div><div className="s">{s[1]}</div></div></div>
          ))}
        </div>
        <div className="efoot"><button type="button" className="pill a-glow" onClick={openQuickAdd}>Dodaj materiał</button></div>
      </div>
    </div>
  );
}
