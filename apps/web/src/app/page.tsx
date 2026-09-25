import Link from "next/link";
import { PLANS, STAGES } from "@nauka/shared";
import { LandingHeader, LandingFooter } from "@/components/landing/chrome";
import { Icon } from "@/components/ui/icons";

const FAQ = [
  { q: "Czy to działa z moimi bazgrołami z zeszytu?", a: "Tak, o ile da się je przeczytać. AI ogarnia zdjęcia notatek, slajdy, strony podręcznika i PDF-y. Im wyraźniej, tym lepiej." },
  { q: "Nie mam notatek — da się?", a: "Wpisz samo hasło, np. „tryby warunkowe” albo „pochodne”. AI ułoży temat zgodnie z polską podstawą programową dla Twojego etapu." },
  { q: "Czy AI nie zmyśla?", a: "Z materiałów uczy tylko tego, co w nich jest, a nieczytelne fragmenty pomija. Każde pytanie ma wyjaśnienie i źródło, a złe pytanie poprawisz jednym dotknięciem." },
  { q: "Po co serca i gemy?", a: "Serca sprawiają, że myślisz przed odpowiedzią (błąd w lekcji = −1, regeneracja co 30 min, Pro = bez limitu). Gemy zbierasz za poziomy, skrzynie i misje, a wydajesz w plecaku: serca, zamrożenie serii, podwójne XP, motywy." },
  { q: "Ile to kosztuje?", a: `Free: ${PLANS.free.generationsPerMonth} tematy miesięcznie za darmo. Pro: ${PLANS.pro.priceMonthlyPln} zł/mies. albo ${PLANS.pro.priceYearlyPln} zł/rok za ${PLANS.pro.generationsPerMonth} tematów, nieskończone serca, większe pliki i tutora bez limitu.` },
  { q: "Co z moimi plikami?", a: "Pliki lądują w Twoim prywatnym folderze i widzi je tylko Twoje konto. Przedmiot możesz usunąć w każdej chwili razem z tematami i postępami." },
];

const FEATURES: { ic: string; t: string; d: string; cls: string }[] = [
  { ic: "map", t: "Ścieżka", d: "Poziomy jak w Duolingo: roladka, pytania i zadania, skrzynie co trzy poziomy, boss rozdziału na końcu.", cls: "acid" },
  { ic: "heart", t: "Serca i combo", d: "5 serc, błąd w lekcji to −1. Seria poprawnych mnoży XP ×2 i ×3.", cls: "red" },
  { ic: "refresh", t: "Powtórka", d: "Fiszki i pytania wracają tuż przed zapomnieniem. Album pojęć rośnie, gdy naprawdę je znasz.", cls: "cyan" },
  { ic: "calendar", t: "Mam sprawdzian", d: "Podajesz datę, dostajesz plan dzień po dniu: nauka, powtórki, próbny, noc przed egzaminem.", cls: "amber" },
  { ic: "gem", t: "Gemy i plecak", d: "Za poziomy, skrzynie, misje i plan dnia. Wydajesz na serca, zamrożenie serii, podwójne XP i motywy.", cls: "pink" },
  { ic: "trophy", t: "Liga tygodnia", d: "Ranking XP resetuje się w niedzielę. Tylko nazwa i wynik, opt-out jednym przełącznikiem.", cls: "gold" },
];

/** Phone mockup built from the app's own 2.0 classes (no images). */
function DeviceMock() {
  return (
    <div className="device" aria-hidden="true">
      <div className="screen2">
        <div className="topbar" style={{ padding: 0 }}>
          <div className="logo brand">Recall<span className="g">.</span></div>
          <div className="pills"><span className="streak"><Icon name="flame" size={16} className="ic-flame" /><span>7</span> <small>dni</small></span><span className="streak gems"><Icon name="gem" size={16} className="ic-cyan" /><span>240</span></span></div>
        </div>
        <div><div className="eyebrow">Wtorek, 22 września</div><h1 style={{ fontSize: 26 }}>Plan na dziś</h1></div>
        <div className="planbar"><div className="bar"><i style={{ width: "33%" }} /></div><span>1 z 3</span></div>
        <div className="plan">
          <div className="plan-row done"><div className="plan-tile"><Icon name="check" size={19} stroke={3.4} /></div><div className="pt"><div className="t">Powtórka — 12 fiszek</div></div><span className="rw">+20</span></div>
          <div className="plan-sep" />
          <div className="plan-row cur"><div className="plan-tile"><Icon name="book" size={19} stroke={3} /></div><div className="pt"><div className="t">Roladka — Fotosynteza</div><div className="s">6 dawek · 6 pytań · +15</div></div><Icon name="chevron-right" size={20} className="chev" /></div>
          <div className="plan-sep" />
          <div className="plan-row later"><div className="plan-tile"><Icon name="question" size={19} stroke={2.6} /></div><div className="pt"><div className="t">Quiz — Komórka</div><div className="s">10 pytań · 5 min · +25</div></div><Icon name="chevron-right" size={20} className="chev" /></div>
        </div>
        <div className="grid2">
          <div className="subjtile"><div className="mono solid">B</div><div className="name">Biologia</div><div className="bar"><i style={{ width: "64%" }} /></div><small>9/14 poziomów</small></div>
          <div className="subjtile"><div className="mono solid">M</div><div className="name">Matematyka</div><div className="bar"><i style={{ width: "40%" }} /></div><small>4/10 poziomów</small></div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="land">
      <LandingHeader />
      <main>
        <section className="land-hero">
          <div className="blob a-float acid" aria-hidden="true" />
          <div className="land-wrap grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center" style={{ position: "relative" }}>
            <div>
              <span className="tag">Nauka z notatek · AI · gra</span>
              <h1>Notatki albo hasło — a AI robi z tego lekcje jak w Duolingo.</h1>
              <p className="land-p mt-6 text-[17px]">Ścieżka poziomów ze skrzyniami i bossem, fiszki z powtórkami, 16 typów zadań, quiz z sercami i combo, misje dnia, plan do sprawdzianu i liga tygodnia. Z Twoich przedmiotów, dla Twojego etapu.</p>
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <Link href="/login" className="pill auto a-glow">Zacznij za darmo</Link>
                <a href="#jak" className="pill ghost auto">Jak to działa</a>
              </div>
              <p className="text-muted text-sm mt-4 font-semibold">{PLANS.free.generationsPerMonth} tematy w miesiącu gratis · bez karty</p>
            </div>
            <div className="hidden sm:block"><DeviceMock /></div>
          </div>
        </section>

        <section className="land-section" id="jak">
          <div className="land-wrap">
            <span className="tag">Jak to działa</span>
            <h2 className="land-h2">Trzy kroki, zero konfiguracji.</h2>
            <div className="grid3 mt-8">
              {[
                ["01", "Dodaj materiał", "Zdjęcie strony, PDF od nauczyciela, wklejony tekst albo samo hasło („fotosynteza, klasa 7”). Trzy minuty i temat jest gotowy.", "acid"],
                ["02", "Sprawdź poziomy", "Wyłącz to, czego nie było na zajęciach, popraw pytanie, które ci nie pasuje. Każde ma źródło i wyjaśnienie.", "cyan"],
                ["03", "Ucz się 10 minut dziennie", "Plan dnia sam wybiera roladkę, powtórkę i quiz. Seria, XP, gemy i misje robią resztę.", "pink"],
              ].map(([n, t, d, cls]) => (
                <div className={`ftile ${cls}`} key={n}>
                  <div className="eyebrow">{n}</div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="land-section" id="gra">
          <div className="land-wrap">
            <span className="tag">Gra</span>
            <h2 className="land-h2">Nie „materiały”, tylko gra o wiedzę.</h2>
            <p className="land-p">Każdy temat zamienia się w wijącą się ścieżkę poziomów. Każdy poziom to roladka, pytania i zadania — z wyjaśnieniem przy każdej odpowiedzi i punktacją, która wciąga.</p>
            <div className="grid3 mt-10">
              {FEATURES.map((f) => (
                <div key={f.t} className={`ftile ${f.cls}`}>
                  <span className="ic"><Icon name={f.ic} size={26} /></span>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="land-section" id="etapy">
          <div className="land-wrap">
            <span className="tag">Dla kogo</span>
            <h2 className="land-h2">Podstawówka, liceum, studia.</h2>
            <div className="grid4 mt-8">
              {STAGES.map((s) => (
                <div key={s.id} className="ftile"><span className="ic"><Icon name={s.id === "podstawowa" ? "edit" : s.id === "liceum" ? "book" : s.id === "studia" ? "cap" : "globe"} size={24} /></span><h3>{s.label}</h3><p>{s.hint}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section className="land-section" id="cennik">
          <div className="land-wrap">
            <span className="tag">Cennik</span>
            <h2 className="land-h2">Zacznij za darmo. Pro, gdy wciągnie.</h2>
            <div className="grid md:grid-cols-2 gap-5 mt-8 max-w-3xl">
              <div className="ftile">
                <div className="eyebrow">Free</div>
                <div className="price">0 zł</div>
                <div className="space-y-2 mt-2">
                  {[`${PLANS.free.generationsPerMonth} tematy w miesiącu`, `pliki do ${PLANS.free.maxFileMb} MB, ${PLANS.free.filesPerGeneration} na temat`, "ścieżka, fiszki, zadania, quiz, egzamin", "5 serc, gemy, misje, liga", "tutor: 30 wiadomości dziennie"].map((t) => <div key={t} className="check"><Icon name="check" size={18} stroke={3} /><span>{t}</span></div>)}
                </div>
                <Link href="/login" className="pill ghost mt-auto">Zacznij</Link>
              </div>
              <div className="ftile acid">
                <div className="eyebrow">Pro</div>
                <div className="price">{PLANS.pro.priceMonthlyPln} zł<small> / mies. · {PLANS.pro.priceYearlyPln} zł / rok</small></div>
                <div className="space-y-2 mt-2">
                  {[`${PLANS.pro.generationsPerMonth} tematów w miesiącu`, `pliki do ${PLANS.pro.maxFileMb} MB, ${PLANS.pro.filesPerGeneration} na temat`, "nieskończone serca", "tutor bez limitu", "BLIK, karta, anulujesz kiedy chcesz"].map((t) => <div key={t} className="check"><Icon name="check" size={18} stroke={3} /><span>{t}</span></div>)}
                </div>
                <Link href="/login" className="pill mt-auto a-glow">Wybierz Pro</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="land-section" id="faq">
          <div className="land-wrap">
            <span className="tag">FAQ</span>
            <h2 className="land-h2">Pytania, które i tak byś zadał.</h2>
            <div className="mt-6 max-w-3xl">
              {FAQ.map((f) => (
                <details className="faq" key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
