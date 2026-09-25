"use client";
import { useState, type CSSProperties } from "react";
import { ACHIEVEMENTS, SUBJECT_HUES, TASK_META, TASK_TYPES } from "@nauka/shared";
import { ICONS, Icon, StarRow } from "@/components/ui/icons";
import { BossSvg, ChartSvg } from "@/components/tasks/common";
import { Logo } from "@/components/ui/logo";
import { themeStyle } from "@/components/ui/mono";
import { cn } from "@/lib/utils";

function Section({ title, children, style }: { title: string; children: React.ReactNode; style?: CSSProperties }) {
  return (
    <section style={{ marginBottom: 32, ...style }}>
      <h2 className="eyebrow" style={{ marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  );
}

/**
 * Recall 2.0 component gallery for visual QA (no auth, no store): tokens, icons, pills, buttons, chips, cards,
 * plan rows, subject tiles, path nodes, quiz options, task hub cards, badges, boss and chart art.
 */
export function Gallery() {
  const [hue, setHue] = useState(0);
  const [on, setOn] = useState(true);
  const style = themeStyle(SUBJECT_HUES[hue]!.color);
  const names = Object.keys(ICONS);
  return (
    <div id="app" style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px 80px", minHeight: "100dvh", position: "relative", overflow: "auto" }}>
      <div className="topbar" style={{ padding: "0 0 20px" }}>
        <Logo size={30} />
        <div className="pills"><span className="streak"><Icon name="flame" size={16} className="ic-flame a-beat" /><span>7</span> <small>dni</small></span><span className="streak"><Icon name="bolt" size={16} className="ic-gold" /><span>1 240</span> <small>xp</small></span><span className="streak gems"><Icon name="gem" size={16} className="ic-cyan" /><span>240</span></span></div>
      </div>
      <Section title="Kolor przedmiotu (accentVars)">
        <div className="chips">{SUBJECT_HUES.map((h, i) => <button key={h.name} type="button" className={cn("chip", i === hue && "active")} style={themeStyle(h.color)} onClick={() => setHue(i)}>{h.name}</button>)}</div>
      </Section>
      <div style={style}>
        <Section title="Przyciski i pigułki">
          <div style={{ display: "grid", gap: 10 }}>
            <button type="button" className="pill a-glow">PRZYCISK GŁÓWNY</button>
            <button type="button" className="pill ghost">Drugorzędny</button>
            <div style={{ display: "flex", gap: 10 }}><button type="button" className="pill cyan">Cyjan</button><button type="button" className="pill violet">Fiolet</button><button type="button" className="pill amber">Bursztyn</button></div>
            <button type="button" className="pill text">tekstowy</button>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="hearts"><Icon name="heart" size={16} /><span className="n">4</span></span><span className="hearts zero"><Icon name="heart" size={16} /><span className="n">0</span></span><button type="button" className={cn("toggle", on && "on")} role="switch" aria-checked={on} aria-label="Przełącznik" onClick={() => setOn((v) => !v)}><i /></button><span className="mono solid">B</span><span className="mono xs solid">M</span><StarRow n={2} size={14} /></div>
          </div>
        </Section>
        <Section title="Plan dnia">
          <div className="planbar"><div className="bar"><i style={{ width: "33%" }} /></div><span>1 z 3</span></div>
          <div className="plan">
            <div className="plan-row done"><div className="plan-tile"><Icon name="check" size={19} stroke={3.4} /></div><div className="pt"><div className="t">Powtórka — 12 fiszek</div></div><span className="rw">+20</span></div>
            <div className="plan-sep" />
            <div className="plan-row cur themed"><div className="plan-tile a-pulse"><Icon name="book" size={19} stroke={3} /></div><div className="pt"><div className="t">Roladka — Fotosynteza</div><div className="s">6 dawek · 6 pytań · +15</div></div><Icon name="chevron-right" size={20} className="chev" /></div>
            <div className="plan-sep" />
            <div className="plan-row later"><div className="plan-tile"><Icon name="question" size={19} stroke={2.6} /></div><div className="pt"><div className="t">Quiz — Komórka</div><div className="s">10 pytań · 5 min · +25</div></div><Icon name="chevron-right" size={20} className="chev" /></div>
          </div>
          <div className="minitiles" style={{ marginTop: 12 }}><span className="minitile gold"><Icon name="star" size={17} stroke={2.6} className="ic-gold" /><span>Misje 1/3</span></span><span className="minitile amber"><Icon name="flame" size={17} className="ic-flame" /><span>Seria 7</span></span><span className="minitile cyan"><Icon name="cards" size={17} stroke={2.6} className="ic-cyan" /><span>Album 12</span></span></div>
        </Section>
        <Section title="Kafle przedmiotów">
          <div className="grid2">
            <div className="subjtile themed"><div className="mono solid">B</div><div className="name">Biologia</div><div className="bar"><i style={{ width: "64%" }} /></div><small>9/14 poziomów</small></div>
            <div className="subjtile add"><div className="mono"><Icon name="plus" size={22} stroke={3} /></div><div className="name">Dodaj<br />materiał</div></div>
          </div>
        </Section>
        <Section title="Ścieżka">
          <div className="path" style={{ minHeight: 0 }}>
            <div className="pathnode" style={{ "--x": "-104px" } as CSSProperties}><span className="nodebtn node-done"><Icon name="check" size={34} stroke={3.4} /><span className="stars"><StarRow n={3} size={12} /></span></span><div className="nodelabel">Podstawy</div></div>
            <div className="pathnode cur" style={{ "--x": "8px" } as CSSProperties}><div className="bubble a-bob">ZACZNIJ</div><span className="nodebtn node-open a-pulse"><Icon name="bolt" size={40} /></span><div className="nodelabel cur">Fotosynteza</div></div>
            <div className="pathnode" style={{ "--x": "96px" } as CSSProperties}><span className="nodebtn node-chest a-sway"><Icon name="chest" size={32} stroke={2.4} /></span><div className="nodelabel gold">Skrzynia</div></div>
            <div className="pathnode" style={{ "--x": "-28px" } as CSSProperties}><span className="nodebtn node-lock"><Icon name="lock" size={28} /></span><div className="nodelabel lock">Komórka</div></div>
            <div className="pathnode" style={{ "--x": "8px" } as CSSProperties}><span className="nodebtn node-boss open"><BossSvg size={52} /></span><div className="nodelabel cur">Boss rozdziału</div></div>
          </div>
        </Section>
        <Section title="Quiz — kafle odpowiedzi">
          <div className="quiz">
            <div className="qchips"><span className="qn">Pytanie 3 z 6</span><span className="combo">3. poprawna z rzędu</span></div>
            <div className="qq">Gdzie zachodzi faza jasna fotosyntezy?</div>
            <div className="qopts">
              <div className="qopt correct"><span className="k">A</span><span className="t">W tylakoidach chloroplastu</span></div>
              <div className="qopt wrong"><span className="k">B</span><span className="t">W stromie</span></div>
              <div className="qopt dim"><span className="k">C</span><span className="t">W mitochondrium</span></div>
              <div className="qopt"><span className="k">D</span><span className="t">W cytoplazmie</span></div>
            </div>
          </div>
        </Section>
        <Section title="Zadania — karty hubu">
          <div className="exhub">
            {TASK_TYPES.slice(0, 4).map((t) => { const m = TASK_META[t]; return <div key={t} className="excard"><div className="eemoji"><Icon name={m.icon} size={26} stroke={2.4} /></div><div className="emeta"><h3>{m.label}</h3><p>{m.desc}</p></div></div>; })}
          </div>
        </Section>
        <Section title="Chipy, paski, karty ustawień">
          <div className="chips"><span className="chip active">Wszystko</span><span className="chip">Poziom 1</span><span className="chip">Poziom 2</span></div>
          <div className="egchips" style={{ marginBottom: 12 }}><span className="egchip on">10</span><span className="egchip">20</span><span className="egchip">wszystkie</span></div>
          <div className="setcard">
            <div className="setrow"><Icon name="bolt" size={20} stroke={2.4} /><div className="grow"><div className="t">Cel dzienny</div><div className="s">plan dnia, pasek XP i misja XP</div></div><span className="v acid">50 XP</span><Icon name="chevron-right" size={18} className="chev" /></div>
            <div className="setsep" />
            <div className="setrow"><div className="grow"><div className="t">Dźwięk</div><div className="s">krótkie efekty</div></div><span className="toggle on"><i /></span></div>
          </div>
        </Section>
        <Section title="Odznaki">
          <div className="badgegrid">{ACHIEVEMENTS.slice(0, 8).map((b, i) => <div key={b.key} className={cn("badge", i < 4 ? ["acid", "gold", "amber", "cyan"][i] : "lock")}><Icon name={i < 4 ? b.icon : "lock"} size={26} stroke={2.4} /><span>{b.title}</span></div>)}</div>
        </Section>
        <Section title="Boss i wykres">
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}><BossSvg size={96} /><div style={{ flex: 1 }}><ChartSvg kind="bar" xs={["2019", "2020", "2021", "2022"]} ys={[3, 5, 4, 7]} /></div></div>
        </Section>
      </div>
      <Section title={`Ikony (${names.length})`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8 }}>
          {names.map((n) => <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 4px", background: "var(--surface)", border: "2px solid var(--line)", borderRadius: 14 }}><Icon name={n} size={22} /><span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>{n}</span></div>)}
        </div>
      </Section>
    </div>
  );
}
