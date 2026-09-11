import type { Metadata } from "next";
import { LandingFooter, LandingHeader } from "@/components/landing/chrome";

export const metadata: Metadata = { title: "Regulamin" };

export default function Regulamin() {
  return (
    <div className="min-h-dvh land">
      <LandingHeader />
      <main className="land-wrap !max-w-3xl py-12 prose">
        <h1 className="mb-8">Regulamin serwisu NAUKA</h1>
        <h2>1. Czym jest NAUKA</h2>
        <p>NAUKA to aplikacja do nauki, która na podstawie materiałów przesłanych przez użytkownika generuje treści edukacyjne (poziomy, fiszki, quizy, mini-gry) z pomocą modeli AI. Usługa jest dostępna w wersji bezpłatnej (Free) i płatnej (Pro).</p>
        <h2>2. Konto</h2>
        <p>Do korzystania z generowania potrzebne jest konto (e-mail lub Google). Konto jest osobiste. Odpowiadasz za to, co wrzucasz.</p>
        <h2>3. Materiały użytkownika</h2>
        <p>Przesyłaj wyłącznie materiały, do których masz prawo (własne notatki, materiały udostępnione Ci na zajęciach do użytku osobistego). Nie wrzucaj danych osobowych osób trzecich ani treści niezgodnych z prawem. Wygenerowane przedmioty są prywatne, chyba że sam je udostępnisz.</p>
        <h2>4. Treści AI</h2>
        <p>Treści generowane przez AI mogą zawierać błędy. NAUKA to narzędzie pomocnicze — zawsze weryfikuj kluczowe informacje z materiałem źródłowym. Nie ponosimy odpowiedzialności za wynik egzaminu.</p>
        <h2>5. Plan Pro i płatności</h2>
        <p>Subskrypcja Pro jest rozliczana miesięcznie lub rocznie przez Stripe (karta, Apple Pay, Google Pay). Możesz ją anulować w każdej chwili w panelu konta — pozostaje aktywna do końca opłaconego okresu. Limity planów opisane są w cenniku.</p>
        <h2>6. Zakończenie</h2>
        <p>Możesz usunąć konto i swoje przedmioty w ustawieniach. Możemy zablokować konto naruszające regulamin.</p>
        <h2>7. Kontakt</h2>
        <p>hej@nauka.app</p>
      </main>
      <LandingFooter />
    </div>
  );
}
