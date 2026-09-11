import Link from "next/link";
import { PLANS, STAGES } from "@nauka/shared";
import { seedSubjects } from "@/lib/subjects";
import { LandingHeader, LandingFooter } from "@/components/landing/chrome";

const STEPS = [
  { emoji: "📸", title: "1. Wrzucasz", text: "Zdjęcia zeszytu, screeny z prezki, PDF od wykładowcy albo wklejony tekst. Byle było czytelne." },
  { emoji: "🤖", title: "2. AI czyta i układa", text: "Dzieli materiał na poziomy, pisze mikro-dawki wiedzy „po ludzku”, fiszki, mini-gry i pytania z wyjaśnieniami." },
  { emoji: "🎮", title: "3. Ty grasz", text: "Ścieżka jak w Duolingo, gwiazdki, XP i seria dni. Na koniec egzamin próbny na czas z oceną wg siatki." },
];

const FAQ = [
  { q: "Czy to działa z moimi bazgrołami z zeszytu?", a: "Tak, o ile da się je przeczytać. AI ogarnia zdjęcia notatek, slajdy, strony podręcznika i PDF-y. Im wyraźniej, tym lepiej." },
  { q: "Czy AI nie zmyśla?", a: "Model dostaje twardą zasadę: uczy tylko tego, co jest w materiałach. Nieczytelne fragmenty pomija zamiast zgadywać. Każde pytanie ma wyjaśnienie, więc łatwo zweryfikować." },
  { q: "Ile to kosztuje?", a: `Free: ${PLANS.free.generationsPerMonth} generacje miesięcznie za darmo. Pro: ${PLANS.pro.priceMonthlyPln} zł/mies. albo ${PLANS.pro.priceYearlyPln} zł/rok za ${PLANS.pro.generationsPerMonth} generacji, większe pliki i tutora bez limitu.` },
  { q: "Czy mogę uczyć się bez konta?", a: "Tak. Biblioteka gotowych przedmiotów działa bez logowania, postępy trzymamy w Twojej przeglądarce. Po zalogowaniu wszystko się scala z kontem." },
  { q: "Co z moimi plikami?", a: "Pliki lądują w Twoim prywatnym folderze w naszym storage i widzi je tylko Twoje konto. Możesz usunąć przedmiot i materiały kiedy chcesz." },
];

export default function Landing() {
  const seeds = seedSubjects();
  return (
    <div className="min-h-dvh">
      <LandingHeader />
      <main className="mx-auto max-w-5xl px-4">
        {/* hero */}
        <section className="pt-10 pb-8 sm:pt-20 sm:pb-16 text-center">
          <span className="tag">nowość · AI z Twoich materiałów</span>
          <h1 className="text-[36px] sm:text-[56px] font-black leading-[1.02] tracking-[-1.5px] mt-2">
            Wrzucasz screeny, notatki, PDF — <span className="g">AI robi z tego quizy, fiszki i mini-gry</span>
          </h1>
          <p className="land-p mt-5 max-w-2xl mx-auto text-[17px]">
            NAUKA zamienia nudny materiał w ścieżkę poziomów jak w Duolingo. Feed „po ludzku”, fiszki z powtórkami, gry, quiz z wyjaśnieniami i egzamin próbny na czas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link href="/login" className="pill sm:w-auto sm:px-8">Zacznij za darmo 🚀</Link>
            <Link href="/app" className="pill ghost sm:w-auto sm:px-8">Wypróbuj bez konta</Link>
          </div>
          <p className="text-muted text-sm mt-4">{PLANS.free.generationsPerMonth} generacje w miesiącu gratis · bez karty</p>
        </section>

        {/* how */}
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

        {/* stages */}
        <section className="land-section" id="etapy">
          <h2 className="land-h2">Dla kogo</h2>
          <p className="land-p mb-6">Wybierasz etap, a AI dopasowuje język, poziom pytań i siatkę ocen.</p>
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

        {/* demo */}
        <section className="land-section" id="demo">
          <h2 className="land-h2">Zobacz, jak to wygląda</h2>
          <p className="land-p mb-6">Gotowe przedmioty z prawdziwych zajęć. Klikasz i się uczysz — bez konta.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {seeds.map((s) => (
              <Link key={s.id} href={`/app/s/${s.slug ?? s.id}`} className="subjcard !mb-0" style={{ ["--sa" as string]: s.accent }}>
                <div className="subjemoji">{s.emoji}</div>
                <div className="subjmeta">
                  <h3>{s.name}</h3>
                  <div className="sub">{s.tagline}</div>
                  <div className="subjprog"><small>{s.levels.length} poziomów · {s.levels.reduce((a, l) => a + l.quiz.length, 0)} pytań</small></div>
                </div>
                <div className="chev">›</div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link href="/app" className="pill ghost sm:w-auto sm:px-8">Wypróbuj bez konta →</Link>
          </div>
        </section>

        {/* pricing */}
        <section className="land-section" id="cennik">
          <h2 className="land-h2">Cennik</h2>
          <p className="land-p mb-6">Zacznij za darmo. Pro, kiedy sesja nadchodzi.</p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
            <div className="card">
              <span className="tag">Free</span>
              <div className="price">0 zł</div>
              <ul className="mt-4 space-y-2 text-[14.5px] text-[#e7e7f4]">
                <li>✅ {PLANS.free.generationsPerMonth} generacje AI / miesiąc</li>
                <li>✅ do {PLANS.free.filesPerGeneration} plików, max {PLANS.free.maxFileMb} MB każdy</li>
                <li>✅ do {PLANS.free.maxSubjects} własnych przedmiotów</li>
                <li>✅ cała biblioteka gotowych przedmiotów</li>
                <li>✅ tutor AI (30 wiadomości / dzień)</li>
              </ul>
              <Link href="/login" className="pill ghost mt-5">Załóż konto</Link>
            </div>
            <div className="card" style={{ borderColor: "#a855f7aa" }}>
              <span className="tag" style={{ background: "var(--accent)" }}>Pro</span>
              <div className="price">{PLANS.pro.priceMonthlyPln} zł <small>/ mies.</small></div>
              <div className="text-muted text-sm mt-1">albo {PLANS.pro.priceYearlyPln} zł / rok (2 miesiące gratis)</div>
              <ul className="mt-4 space-y-2 text-[14.5px] text-[#e7e7f4]">
                <li>⚡ {PLANS.pro.generationsPerMonth} generacji AI / miesiąc</li>
                <li>⚡ do {PLANS.pro.filesPerGeneration} plików, max {PLANS.pro.maxFileMb} MB każdy</li>
                <li>⚡ nielimitowane przedmioty</li>
                <li>⚡ tutor AI bez limitu</li>
                <li>⚡ BLIK i karta, anulujesz kiedy chcesz</li>
              </ul>
              <Link href="/login?next=/app/account" className="pill mt-5">Przejdź na Pro</Link>
            </div>
          </div>
        </section>

        {/* faq */}
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
          <h2 className="land-h2">Gotowy na sesję?</h2>
          <p className="land-p mb-6">Pierwsze {PLANS.free.generationsPerMonth} przedmioty robisz za darmo.</p>
          <Link href="/login" className="pill sm:w-auto sm:px-10">Zacznij teraz 🚀</Link>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
