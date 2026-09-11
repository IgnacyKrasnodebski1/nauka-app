import Link from "next/link";
import { PLANS, STAGES } from "@nauka/shared";
import { LandingHeader, LandingFooter } from "@/components/landing/chrome";

const STEPS = [
  { emoji: "📚", title: "1. Wybierz przedmioty", text: "Matematyka, biologia, makroekonomia — z listy dla Twojego etapu albo własne. Każdy dostaje swoją półkę." },
  { emoji: "📸", title: "2. Dodaj temat", text: "Zdjęcia zeszytu, PDF od nauczyciela albo samo hasło („fotosynteza, klasa 7”). AI robi z tego poziomy: feed, fiszki, mini-gry, quiz." },
  { emoji: "⚡", title: "3. Ucz się 10 min dziennie", text: "Sesja „Dziś” sama wybiera powtórki, pytania, które nie weszły, i jeden nowy poziom. Streak i XP robią resztę." },
];

const FAQ = [
  { q: "Czy to działa z moimi bazgrołami z zeszytu?", a: "Tak, o ile da się je przeczytać. AI ogarnia zdjęcia notatek, slajdy, strony podręcznika i PDF-y. Im wyraźniej, tym lepiej." },
  { q: "Nie mam notatek — da się?", a: "Wpisz samo hasło, np. „tryby warunkowe” albo „pochodne”. AI ułoży temat zgodnie z polską podstawą programową dla Twojego etapu." },
  { q: "Czy AI nie zmyśla?", a: "Z materiałów uczy tylko tego, co w nich jest, a nieczytelne fragmenty pomija. Każde pytanie ma wyjaśnienie, więc łatwo zweryfikować." },
  { q: "Ile to kosztuje?", a: `Free: ${PLANS.free.generationsPerMonth} tematy miesięcznie za darmo. Pro: ${PLANS.pro.priceMonthlyPln} zł/mies. albo ${PLANS.pro.priceYearlyPln} zł/rok za ${PLANS.pro.generationsPerMonth} tematów, większe pliki i tutora bez limitu.` },
  { q: "Co z moimi plikami?", a: "Pliki lądują w Twoim prywatnym folderze i widzi je tylko Twoje konto. Przedmiot możesz usunąć w każdej chwili razem z tematami i postępami." },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <LandingHeader />
      <main className="mx-auto max-w-5xl px-4">
        <section className="pt-10 pb-8 sm:pt-20 sm:pb-16 text-center">
          <span className="tag">nowość · AI z Twoich materiałów</span>
          <h1 className="text-[36px] sm:text-[56px] font-black leading-[1.02] tracking-[-1.5px] mt-2">
            Wrzucasz notatki albo wpisujesz temat — <span className="g">AI robi z tego lekcje jak w Duolingo</span>
          </h1>
          <p className="land-p mt-5 max-w-2xl mx-auto text-[17px]">
            Poziomy do odblokowania, feed „po ludzku”, fiszki z powtórkami, mini-gry, quiz z wyjaśnieniami i egzamin próbny na czas. Wszystko z Twoich przedmiotów.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link href="/login" className="pill sm:w-auto sm:px-8">Zacznij za darmo 🚀</Link>
            <a href="#jak" className="pill ghost sm:w-auto sm:px-8">Jak to działa</a>
          </div>
          <p className="text-muted text-sm mt-4">{PLANS.free.generationsPerMonth} tematy w miesiącu gratis · bez karty</p>
        </section>

        <section className="land-section" id="jak">
          <h2 className="land-h2">Jak to działa</h2>
          <p className="land-p mb-6">Trzy kroki, zero konfiguracji.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <div className="card" key={s.title}>
                <div className="text-4xl mb-3">{s.emoji}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="land-section" id="etapy">
          <h2 className="land-h2">Dla kogo</h2>
          <p className="land-p mb-6">Wybierasz etap, a AI dopasowuje przedmioty, język, poziom pytań i siatkę ocen.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STAGES.map((s) => (
              <div className="card" key={s.id}>
                <div className="text-3xl mb-2">{s.emoji}</div>
                <h3>{s.label}</h3>
                <p>{s.hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="land-section" id="sprawdzian">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card">
              <div className="text-4xl mb-3">📅</div>
              <h3>Mam sprawdzian</h3>
              <p>Podajesz datę, a NAUKA rozkłada niezrobione poziomy na dni, dorzuca codzienną powtórkę fiszek i symulację sprawdzianu dzień wcześniej. Odliczanie na karcie przedmiotu.</p>
            </div>
            <div className="card">
              <div className="text-4xl mb-3">⚡</div>
              <h3>Dzisiejsza sesja</h3>
              <p>Jedna karta na start: fiszki, które właśnie „wychodzą z głowy” (SRS), pytania, które ostatnio nie weszły, i jeden nowy poziom. Około 10 minut. Seria 🔥 rośnie sama.</p>
            </div>
          </div>
        </section>

        <section className="land-section" id="cennik">
          <h2 className="land-h2">Cennik</h2>
          <p className="land-p mb-6">Zacznij za darmo. Pro, kiedy sesja nadchodzi.</p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
            <div className="card">
              <span className="tag">Free</span>
              <div className="price">0 zł</div>
              <ul className="mt-4 space-y-2 text-[14.5px] text-[#e7e7f4]">
                <li>✅ {PLANS.free.generationsPerMonth} tematy AI / miesiąc</li>
                <li>✅ do {PLANS.free.filesPerGeneration} plików, max {PLANS.free.maxFileMb} MB każdy</li>
                <li>✅ nielimitowane przedmioty, sesja „Dziś”, plan na sprawdzian</li>
                <li>✅ tutor AI (30 wiadomości / dzień)</li>
              </ul>
              <Link href="/login" className="pill ghost mt-5">Załóż konto</Link>
            </div>
            <div className="card" style={{ borderColor: "#a855f7aa" }}>
              <span className="tag" style={{ background: "var(--accent)" }}>Pro</span>
              <div className="price">{PLANS.pro.priceMonthlyPln} zł <small>/ mies.</small></div>
              <div className="text-muted text-sm mt-1">albo {PLANS.pro.priceYearlyPln} zł / rok (2 miesiące gratis)</div>
              <ul className="mt-4 space-y-2 text-[14.5px] text-[#e7e7f4]">
                <li>⚡ {PLANS.pro.generationsPerMonth} tematów AI / miesiąc</li>
                <li>⚡ do {PLANS.pro.filesPerGeneration} plików, max {PLANS.pro.maxFileMb} MB każdy</li>
                <li>⚡ tutor AI bez limitu</li>
                <li>⚡ BLIK i karta, anulujesz kiedy chcesz</li>
              </ul>
              <Link href="/login?next=/app/account" className="pill mt-5">Przejdź na Pro</Link>
            </div>
          </div>
        </section>

        <section className="land-section" id="faq">
          <h2 className="land-h2">FAQ</h2>
          <div className="max-w-2xl mt-4">
            {FAQ.map((f) => (
              <details className="faq" key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="land-section text-center">
          <h2 className="land-h2">Gotowy na sprawdzian?</h2>
          <p className="land-p mb-6">Pierwsze {PLANS.free.generationsPerMonth} tematy robisz za darmo.</p>
          <Link href="/login" className="pill sm:w-auto sm:px-10">Zacznij teraz 🚀</Link>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
