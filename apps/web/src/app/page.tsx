import Link from "next/link";
import type { CSSProperties } from "react";
import { PLANS, STAGES, SUBJECT_HUES } from "@nauka/shared";
import { LandingHeader, LandingFooter } from "@/components/landing/chrome";
import { Icon, type IconName } from "@/components/ui/icons";
import { Mascot } from "@/components/mascot/mascot";
import { Ring } from "@/components/ui/ring";

const FAQ = [
  { q: "Czy to działa z moimi bazgrołami z zeszytu?", a: "Tak, o ile da się je przeczytać. AI ogarnia zdjęcia notatek, slajdy, strony podręcznika i PDF-y. Im wyraźniej, tym lepiej." },
  { q: "Nie mam notatek — da się?", a: "Wpisz samo hasło, np. „tryby warunkowe” albo „pochodne”. AI ułoży temat zgodnie z polską podstawą programową dla Twojego etapu." },
  { q: "Czy AI nie zmyśla?", a: "Z materiałów uczy tylko tego, co w nich jest, a nieczytelne fragmenty pomija. Każde pytanie ma wyjaśnienie, więc łatwo zweryfikować." },
  { q: "Po co serca i klejnoty?", a: "Serca sprawiają, że myślisz przed odpowiedzią (błąd w quizie = −1, regeneracja co 30 min, Pro = nieskończone). Klejnoty zbierasz za poziomy, skrzynki i misje, a wydajesz na serca albo zamrożenie serii." },
  { q: "Ile to kosztuje?", a: `Free: ${PLANS.free.generationsPerMonth} tematy miesięcznie za darmo. Pro: ${PLANS.pro.priceMonthlyPln} zł/mies. albo ${PLANS.pro.priceYearlyPln} zł/rok za ${PLANS.pro.generationsPerMonth} tematów, nieskończone serca, większe pliki i tutora bez limitu.` },
  { q: "Co z moimi plikami?", a: "Pliki lądują w Twoim prywatnym folderze i widzi je tylko Twoje konto. Przedmiot możesz usunąć w każdej chwili razem z tematami i postępami." },
];

const hue = (i: number) => ({ "--hue": SUBJECT_HUES[i]!.color, "--hue-deep": SUBJECT_HUES[i]!.deep } as CSSProperties);

/** Phone mockup built from the real app components' CSS (no images). */
function DeviceMock() {
  return (
    <div className="device" style={hue(2)} aria-hidden="true">
      <div className="screen">
        <div className="flex items-center justify-between mb-4">
          <span className="display font-extrabold text-txt text-[15px]">Recall</span>
          <div className="hud">
            <span className="hudpill pill-flame !text-[12px] !py-1 !px-2"><Icon name="flame" size={14} />7</span>
            <span className="hudpill pill-gem !text-[12px] !py-1 !px-2"><Icon name="gem" size={14} />240</span>
            <span className="hudpill pill-heart !text-[12px] !py-1 !px-2"><Icon name="heart" size={14} />5</span>
          </div>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <Ring pct={64} size={64} stroke={8} color="var(--play-orange)" animate={false}><span className="display text-[13px] font-extrabold text-txt">32</span></Ring>
          <div>
            <div className="display font-extrabold text-txt text-[17px] leading-tight">Cześć, Ola!</div>
            <div className="text-muted text-[12px] font-bold">Jeszcze 18 XP do celu dnia.</div>
          </div>
        </div>
        <div className="card3d green !p-3.5 mb-3">
          <div className="eyebrow !text-[10px]" style={{ color: "rgba(255,255,255,0.8)" }}>Dzienna misja</div>
          <div className="display font-extrabold text-[20px] leading-tight" style={{ color: "#fff" }}>~9 min nauki</div>
          <div className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.85)" }}>Nowy poziom: <b style={{ color: "#fff" }}>Fotosynteza · czynniki</b></div>
          <div className="btn3d gold sm mt-3 !w-full">Start</div>
        </div>
        <div className="card3d !p-3.5 mb-3">
          <div className="flex items-center justify-between mb-1"><span className="display font-bold text-txt text-[13px]">Misje dnia</span><span className="tag badge !mb-0 !text-[10px]">1/3</span></div>
          {[["Zdobądź 50 XP", 64, false], ["5 poprawnych z rzędu", 100, true], ["Powtórz 10 fiszek", 30, false]].map(([t, p, d]) => (
            <div key={t as string} className="quest-row !py-2">
              <div className="quest-ic !w-8 !h-8 !rounded-lg"><Icon name={d ? "check" : "bolt"} size={14} /></div>
              <div className="flex-1 min-w-0"><div className="quest-title !text-[12px]">{t}</div><div className="quest-bar !h-2 !mt-1"><i style={{ width: `${p}%` }} /></div></div>
              <span className="reward !text-[11px]"><Icon name="gem" size={11} />+10</span>
            </div>
          ))}
        </div>
        <div className="subj-grid !gap-2">
          {[
            ["🧬", "Biologia", 66, 2],
            ["➗", "Matematyka", 40, 1],
          ].map(([e, n, p, h]) => (
            <div key={n as string} className="card3d subj-tile !min-h-0 !p-3" style={hue(h as number)}>
              <div className="flex items-start justify-between"><span className="emo !text-[26px]">{e}</span><Ring pct={p as number} size={30} stroke={5} color="var(--hue)" animate={false} /></div>
              <h3 className="!text-[13px]">{n}</h3>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const FEATURES: { ic: IconName; t: string; d: string; cls: string }[] = [
  { ic: "zap", t: "Combo", d: "5 poprawnych z rzędu = XP ×2, 10 = ×3. Odznaka „Na fali” za dziesiątkę.", cls: "blue" },
  { ic: "heart", t: "Serca", d: "5 serc, błąd w quizie to −1. Regeneracja co 30 min, Pro = nieskończone.", cls: "orange" },
  { ic: "gem", t: "Klejnoty", d: "Za poziomy, skrzynki na ścieżce, trofea i misje. Wydajesz na serca i zamrożenie serii.", cls: "purple" },
  { ic: "target", t: "Misje dnia", d: "3 zadania dziennie, zawsze inne. Cel dzienny 20/50/100 XP z bonusem.", cls: "green" },
  { ic: "trophy", t: "Ranking tygodnia", d: "Liga resetuje się w poniedziałek. Tylko nazwa i XP, opt-out jednym kliknięciem.", cls: "gold" },
  { ic: "medal", t: "Odznaki i rangi", d: "16 odznak, 8 rang od Nowicjusza po Recall. Maskotka Rec kibicuje.", cls: "orange" },
];

export default function Landing() {
  return (
    <div className="land min-h-dvh">
      <LandingHeader />
      <main>
        {/* hero */}
        <section className="land-hero">
          <div className="land-wrap grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center">
            <div>
              <div className="flex items-center gap-4 mb-5">
                <Mascot state="happy" size={96} />
                <span className="bubble-say">Cześć, jestem Rec. Wrzuć notatki, ja zrobię z nich grę.</span>
              </div>
              <h1>Notatki albo hasło — a AI robi z tego lekcje jak w Duolingo.</h1>
              <p className="land-p mt-6 text-[17px]">Ścieżka poziomów ze skrzynkami, fiszki z powtórkami, mini-gry, quiz z sercami i combo, misje dnia, ranking tygodnia i maskotka, która kibicuje. Z Twoich przedmiotów, dla Twojego etapu.</p>
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <Link href="/login" className="btn3d green lg sm:w-auto sm:px-8">Zacznij za darmo</Link>
                <a href="#jak" className="btn3d ghost lg sm:w-auto sm:px-8">Jak to działa</a>
              </div>
              <p className="text-muted text-sm mt-4 font-semibold">{PLANS.free.generationsPerMonth} tematy w miesiącu gratis · bez karty</p>
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
                ["01", "Wybierz przedmioty", "Matematyka, biologia, makroekonomia — z listy dla Twojego etapu albo własne. Każdy dostaje swoją półkę.", "soft-purple"],
                ["02", "Dodaj temat", "Zdjęcia zeszytu, PDF od nauczyciela albo samo hasło („fotosynteza, klasa 7”). AI robi z tego poziomy: feed, fiszki, mini-gry, quiz.", "soft-blue"],
                ["03", "Ucz się 10 minut dziennie", "Dzienna misja sama wybiera powtórki, pytania, które nie weszły, i jeden nowy poziom. Seria, XP i klejnoty robią resztę.", "soft-green"],
              ].map(([n, t, d, cls]) => (
                <div className={`card3d ${cls}`} key={n}>
                  <div className="display text-[13px] font-extrabold text-[var(--play-yellow)] tracking-[0.12em] mb-3">{n}</div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* game */}
        <section className="land-section" id="gra">
          <div className="land-wrap">
            <span className="tag">Gra</span>
            <h2 className="land-h2">Nie „materiały”, tylko gra o wiedzę.</h2>
            <p className="land-p">Każdy temat zamienia się w wijącą się ścieżkę poziomów. Każdy poziom to feed, fiszki, mini-gry i quiz z wyjaśnieniem przy każdej odpowiedzi — i punktacja, która wciąga.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
              {FEATURES.map((f) => (
                <div key={f.t} className={`card3d feature-tile ${f.cls}`}>
                  <span className="ic"><Icon name={f.ic} size={26} /></span>
                  <h3 style={{ color: f.cls === "gold" ? "#2A1F00" : "#fff" }}>{f.t}</h3>
                  <p>{f.d}</p>
                </div>
              ))}
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
                <div className="card3d hue" key={s.id} style={hue(i + 4)}>
                  <div className="text-[34px] leading-none mb-3" aria-hidden="true">{s.emoji}</div>
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
              <div className="card3d !p-6">
                <span className="tag">Free</span>
                <div className="price">0 zł</div>
                <div className="flex flex-col gap-2.5 mt-6">
                  <div className="check">{PLANS.free.generationsPerMonth} tematy AI miesięcznie</div>
                  <div className="check">5 serc, +1 co 30 minut</div>
                  <div className="check">do {PLANS.free.filesPerGeneration} plików, max {PLANS.free.maxFileMb} MB każdy</div>
                  <div className="check">misje, ranking, odznaki, plan na sprawdzian</div>
                  <div className="check">tutor AI · 30 wiadomości dziennie</div>
                </div>
                <Link href="/login" className="btn3d ghost mt-7">Załóż konto</Link>
              </div>
              <div className="card3d soft-purple !p-6">
                <span className="tag badge gold">Pro</span>
                <div className="price mt-3">{PLANS.pro.priceMonthlyPln} zł <small>/ miesiąc</small></div>
                <div className="text-muted text-sm mt-1 font-semibold">albo {PLANS.pro.priceYearlyPln} zł / rok — 2 miesiące gratis</div>
                <div className="flex flex-col gap-2.5 mt-6">
                  <div className="check">nieskończone serca</div>
                  <div className="check">{PLANS.pro.generationsPerMonth} tematów AI miesięcznie</div>
                  <div className="check">do {PLANS.pro.filesPerGeneration} plików, max {PLANS.pro.maxFileMb} MB każdy</div>
                  <div className="check">tutor AI bez limitu</div>
                  <div className="check">BLIK i karta, anulujesz kiedy chcesz</div>
                </div>
                <Link href="/login?next=/app/account" className="btn3d purple mt-7">Przejdź na Pro</Link>
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
              <Mascot state="think" size={120} className="mt-4" />
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
            <div className="card3d green !p-8 md:!p-12 flex flex-col md:flex-row md:items-center gap-6 justify-between">
              <div className="flex items-center gap-5">
                <Mascot state="cheer" size={110} />
                <div>
                  <h2 className="land-h2" style={{ color: "#fff" }}>Gotowy na sprawdzian?</h2>
                  <p className="land-p" style={{ color: "rgba(255,255,255,0.85)" }}>Pierwsze {PLANS.free.generationsPerMonth} tematy robisz za darmo.</p>
                </div>
              </div>
              <Link href="/login" className="btn3d gold lg md:w-auto md:px-10 flex-none">Zacznij teraz</Link>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
