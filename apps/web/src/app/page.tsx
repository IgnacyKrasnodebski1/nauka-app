import Link from "next/link";
import type { CSSProperties } from "react";
import { PLANS, STAGES, SUBJECT_HUES } from "@nauka/shared";
import { LandingHeader, LandingFooter } from "@/components/landing/chrome";

const FAQ = [
  { q: "Czy to działa z moimi bazgrołami z zeszytu?", a: "Tak, o ile da się je przeczytać. AI ogarnia zdjęcia notatek, slajdy, strony podręcznika i PDF-y. Im wyraźniej, tym lepiej." },
  { q: "Nie mam notatek — da się?", a: "Wpisz samo hasło, np. „tryby warunkowe” albo „pochodne”. AI ułoży temat zgodnie z polską podstawą programową dla Twojego etapu." },
  { q: "Czy AI nie zmyśla?", a: "Z materiałów uczy tylko tego, co w nich jest, a nieczytelne fragmenty pomija. Każde pytanie ma wyjaśnienie, więc łatwo zweryfikować." },
  { q: "Ile to kosztuje?", a: `Free: ${PLANS.free.generationsPerMonth} tematy miesięcznie za darmo. Pro: ${PLANS.pro.priceMonthlyPln} zł/mies. albo ${PLANS.pro.priceYearlyPln} zł/rok za ${PLANS.pro.generationsPerMonth} tematów, większe pliki i tutora bez limitu.` },
  { q: "Co z moimi plikami?", a: "Pliki lądują w Twoim prywatnym folderze i widzi je tylko Twoje konto. Przedmiot możesz usunąć w każdej chwili razem z tematami i postępami." },
];

const hue = (i: number) => ({ "--hue": SUBJECT_HUES[i]!.color } as CSSProperties);

/** Phone mockup built from the real app components' CSS (no images). */
function DeviceMock() {
  return (
    <div className="device" style={hue(2)} aria-hidden="true">
      <div className="screen">
        <div className="flex items-center justify-between mb-4">
          <span className="logo text-[15px]">NAUKA</span>
          <div className="pills">
            <span className="streak fire !py-1 !px-2 !text-[11px]">🔥 <b className="!text-[12px]">7</b></span>
            <span className="streak xp !py-1 !px-2 !text-[11px]">⚡ <b className="!text-[12px]">1 240</b></span>
          </div>
        </div>
        <div className="card !p-4 mb-3">
          <div className="eyebrow mb-1.5">Dziś</div>
          <div className="display font-extrabold text-txt text-[22px] leading-tight">~9 min nauki</div>
          <div className="text-muted text-[12.5px] mt-1">Nowy poziom: <b>Fotosynteza · czynniki</b></div>
          <div className="flex gap-1.5 mt-3">
            <span className="streak !py-1 !px-2"><b className="hue !text-[12px]">8</b><small>powtórki</small></span>
            <span className="streak !py-1 !px-2"><b className="!text-[12px]" style={{ color: "var(--danger)" }}>3</b><small>słabe</small></span>
          </div>
          <div className="pill !min-h-[36px] !text-[13px] mt-3">Start</div>
        </div>
        <div className="eyebrow mb-2">Twoje przedmioty</div>
        {[
          ["🧬", "Biologia", "3 tematy", 66, 2],
          ["➗", "Matematyka", "5 tematów", 40, 1],
          ["🏰", "Historia", "2 tematy", 85, 3],
        ].map(([e, n, s, p, h]) => (
          <div key={n as string} className="subjcard !mb-2 !p-3" style={hue(h as number)}>
            <div className="tile sm">{e}</div>
            <div className="subjmeta">
              <h3 className="!text-[14px]">{n}</h3>
              <div className="subjprog !mt-1.5"><div className="bar"><i style={{ width: `${p}%` }} /></div><small>{s}</small></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PathSnippet() {
  return (
    <div className="card !p-4" style={hue(0)} aria-hidden="true">
      <div className="path !py-1" style={{ ["--x" as string]: 0 }}>
        {[
          ["✓", "node-done", "Podstawy", "3 z 3 gwiazdek"],
          ["🌿", "node-open", "Czynniki i doświadczenia", "10 pytań · 12 fiszek"],
          ["🔒", "node-lock", "Znaczenie dla życia", "zablokowane"],
        ].map(([ic, cls, t, s]) => (
          <div key={t} className="pathnode !py-2">
            <span className={`nodebtn !w-12 !h-12 !text-[18px] ${cls}`}>{ic}</span>
            <div className="nodelabel"><div className={`t !text-[14px] ${cls === "node-lock" ? "lock" : ""}`}>{t}</div><small>{s}</small></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuizSnippet() {
  return (
    <div className="qcard !p-4" style={hue(1)} aria-hidden="true">
      <span className="tag">Pytanie 4 z 8</span>
      <div className="qq !text-[17px] !mb-3">Gdzie zachodzi faza jasna fotosyntezy?</div>
      <div className="opts !gap-2">
        <div className="opt dim !py-2.5 !text-[13.5px]"><span className="k">A</span>W stromie chloroplastu</div>
        <div className="opt correct !py-2.5 !text-[13.5px]"><span className="k">B</span>W błonach tylakoidów</div>
        <div className="opt wrong !py-2.5 !text-[13.5px]"><span className="k">C</span>W mitochondriach</div>
      </div>
      <div className="explain !mt-3 !text-[13px]"><b>Dlaczego:</b> Barwniki fotosyntetyczne siedzą w tylakoidach — tam światło zamienia się w ATP i NADPH.</div>
    </div>
  );
}

function PlanSnippet() {
  return (
    <div className="card !p-4" style={hue(3)} aria-hidden="true">
      <span className="tag">Sprawdzian</span>
      <h3>Kartkówka z fotosyntezy</h3>
      <p>za 5 dni · 4 poziomy do zrobienia</p>
      <ol className="mt-3 list-none p-0 m-0 divide-y divide-[var(--line)] text-[13px]">
        {(
          [
            ["dziś", "Podstawy: gdzie, z czego, co powstaje", true],
            ["sb 13.09", "Czynniki i doświadczenia", true],
            ["nd 14.09", "Powtórka fiszek", false],
            ["pn 15.09", "Symulacja sprawdzianu", false],
          ] as [string, string, boolean][]
        ).map(([d, t, lvl]) => (
          <li key={d} className="flex gap-3 py-2"><span className="eyebrow w-[60px] shrink-0 pt-0.5">{d}</span><span className={lvl ? "hue font-semibold" : "text-muted"}>{t}</span></li>
        ))}
      </ol>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="land min-h-dvh">
      <LandingHeader />
      <main>
        {/* hero */}
        <section className="land-hero">
          <div className="land-wrap grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center">
            <div>
              <span className="tag badge gold">Nowość · AI z Twoich materiałów</span>
              <h1 className="mt-5">Wrzucasz notatki albo wpisujesz temat — AI robi z tego lekcje jak w Duolingo.</h1>
              <p className="land-p mt-6 text-[17px]">Poziomy do odblokowania, feed „po ludzku”, fiszki z powtórkami, mini-gry, quiz z wyjaśnieniami i egzamin próbny na czas. Z Twoich przedmiotów, dla Twojego etapu.</p>
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <Link href="/login" className="pill sm:w-auto sm:px-8">Zacznij za darmo</Link>
                <a href="#jak" className="pill ghost sm:w-auto sm:px-8">Jak to działa</a>
              </div>
              <p className="text-muted text-sm mt-4">{PLANS.free.generationsPerMonth} tematy w miesiącu gratis · bez karty</p>
            </div>
            <div className="hidden sm:block"><DeviceMock /></div>
          </div>
        </section>

        {/* how */}
        <section className="land-section" id="jak">
          <div className="land-wrap">
            <span className="tag">Jak to działa</span>
            <h2 className="land-h2">Trzy kroki, zero konfiguracji.</h2>
            <div className="grid md:grid-cols-3 gap-5 mt-8">
              {[
                ["01", "Wybierz przedmioty", "Matematyka, biologia, makroekonomia — z listy dla Twojego etapu albo własne. Każdy dostaje swoją półkę."],
                ["02", "Dodaj temat", "Zdjęcia zeszytu, PDF od nauczyciela albo samo hasło („fotosynteza, klasa 7”). AI robi z tego poziomy: feed, fiszki, mini-gry, quiz."],
                ["03", "Ucz się 10 minut dziennie", "Sesja „Dziś” sama wybiera powtórki, pytania, które nie weszły, i jeden nowy poziom. Streak i XP robią resztę."],
              ].map(([n, t, d]) => (
                <div className="card" key={n}>
                  <div className="display text-[13px] font-bold text-[var(--accent)] tracking-[0.12em] mb-3">{n}</div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* product */}
        <section className="land-section">
          <div className="land-wrap">
            <span className="tag">Produkt</span>
            <h2 className="land-h2">Nie „materiały”, tylko lekcje.</h2>
            <p className="land-p">Każdy temat zamienia się w ścieżkę poziomów. Każdy poziom to feed, fiszki, mini-gry i quiz z wyjaśnieniem przy każdej odpowiedzi.</p>
            <div className="grid md:grid-cols-3 gap-5 mt-10 items-start">
              <div>
                <PathSnippet />
                <h3 className="mt-4">Ścieżka poziomów</h3>
                <p className="text-muted text-[14.5px] mt-1">Od podstaw do rzeczy trudniejszych. Kolejny poziom odblokowuje się po zaliczonym quizie.</p>
              </div>
              <div>
                <QuizSnippet />
                <h3 className="mt-4">Quiz, który tłumaczy</h3>
                <p className="text-muted text-[14.5px] mt-1">Każda odpowiedź ma „dlaczego”. Pytania, które nie weszły, wracają jutro w sesji „Dziś”.</p>
              </div>
              <div>
                <PlanSnippet />
                <h3 className="mt-4">Plan na sprawdzian</h3>
                <p className="text-muted text-[14.5px] mt-1">Podajesz datę — NAUKA rozkłada poziomy na dni, dorzuca powtórki i symulację dzień wcześniej.</p>
              </div>
            </div>
          </div>
        </section>

        {/* stages */}
        <section className="land-section" id="etapy">
          <div className="land-wrap">
            <span className="tag">Dla kogo</span>
            <h2 className="land-h2">Od podstawówki po sesję.</h2>
            <p className="land-p">Wybierasz etap, a AI dopasowuje przedmioty, język, poziom pytań i siatkę ocen.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {STAGES.map((s, i) => (
                <div className="card" key={s.id} style={hue(i + 4)}>
                  <div className="tile sm mb-3" aria-hidden="true">{s.emoji}</div>
                  <h3>{s.label}</h3>
                  <p>{s.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* pricing */}
        <section className="land-section" id="cennik">
          <div className="land-wrap">
            <span className="tag">Cennik</span>
            <h2 className="land-h2">Zacznij za darmo. Pro, kiedy sesja nadchodzi.</h2>
            <div className="grid md:grid-cols-2 gap-5 mt-8 max-w-3xl">
              <div className="card !p-6">
                <span className="tag">Free</span>
                <div className="price">0 zł</div>
                <div className="flex flex-col gap-2.5 mt-6">
                  <div className="check">{PLANS.free.generationsPerMonth} tematy AI miesięcznie</div>
                  <div className="check">do {PLANS.free.filesPerGeneration} plików, max {PLANS.free.maxFileMb} MB każdy</div>
                  <div className="check">nielimitowane przedmioty, sesja „Dziś”, plan na sprawdzian</div>
                  <div className="check">tutor AI · 30 wiadomości dziennie</div>
                </div>
                <Link href="/login" className="pill ghost mt-7">Załóż konto</Link>
              </div>
              <div className="card gold !p-6">
                <span className="tag badge gold">Pro</span>
                <div className="price mt-3">{PLANS.pro.priceMonthlyPln} zł <small>/ miesiąc</small></div>
                <div className="text-muted text-sm mt-1">albo {PLANS.pro.priceYearlyPln} zł / rok — 2 miesiące gratis</div>
                <div className="flex flex-col gap-2.5 mt-6">
                  <div className="check">{PLANS.pro.generationsPerMonth} tematów AI miesięcznie</div>
                  <div className="check">do {PLANS.pro.filesPerGeneration} plików, max {PLANS.pro.maxFileMb} MB każdy</div>
                  <div className="check">tutor AI bez limitu</div>
                  <div className="check">BLIK i karta, anulujesz kiedy chcesz</div>
                </div>
                <Link href="/login?next=/app/account" className="pill mt-7">Przejdź na Pro</Link>
              </div>
            </div>
          </div>
        </section>

        {/* faq */}
        <section className="land-section" id="faq">
          <div className="land-wrap grid md:grid-cols-[1fr_2fr] gap-10">
            <div>
              <span className="tag">FAQ</span>
              <h2 className="land-h2">Pytania, które padają najczęściej.</h2>
            </div>
            <div>
              {FAQ.map((f) => (
                <details className="faq" key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="land-section">
          <div className="land-wrap">
            <div className="card glow-head glow-gold !p-8 md:!p-12 flex flex-col md:flex-row md:items-center gap-6 justify-between">
              <div>
                <h2 className="land-h2">Gotowy na sprawdzian?</h2>
                <p className="land-p">Pierwsze {PLANS.free.generationsPerMonth} tematy robisz za darmo.</p>
              </div>
              <Link href="/login" className="pill md:w-auto md:px-10 flex-none">Zacznij teraz</Link>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
