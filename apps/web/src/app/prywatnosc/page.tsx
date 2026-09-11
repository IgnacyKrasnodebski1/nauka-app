import type { Metadata } from "next";
import { LandingFooter, LandingHeader } from "@/components/landing/chrome";

export const metadata: Metadata = { title: "Polityka prywatności" };

export default function Prywatnosc() {
  return (
    <div className="min-h-dvh">
      <LandingHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 prose">
        <h1 className="text-3xl font-black tracking-tight mb-6">Polityka prywatności</h1>
        <h2>Jakie dane zbieramy</h2>
        <ul>
          <li>Konto: adres e-mail, nazwa wyświetlana, etap edukacji.</li>
          <li>Materiały, które wrzucasz (zdjęcia, PDF, tekst) — przechowywane w Twoim prywatnym folderze.</li>
          <li>Postępy w nauce (XP, seria, zaliczone poziomy, powtórki fiszek).</li>
          <li>Dane rozliczeniowe obsługuje Stripe — my przechowujemy tylko identyfikator klienta i status subskrypcji.</li>
        </ul>
        <h2>Po co</h2>
        <p>Żeby wygenerować Twoje przedmioty, zapamiętać postępy i rozliczyć subskrypcję. Materiały są przesyłane do dostawcy modelu AI (Anthropic) wyłącznie w celu wygenerowania treści i nie służą do trenowania modeli.</p>
        <h2>Gość bez konta</h2>
        <p>Jeśli uczysz się bez logowania, postępy zapisujemy tylko w Twojej przeglądarce (localStorage). Nic nie trafia na nasze serwery.</p>
        <h2>Twoje prawa</h2>
        <p>Możesz w każdej chwili usunąć przedmioty i materiały w aplikacji oraz poprosić o usunięcie konta pisząc na hej@nauka.app. Masz prawo dostępu, sprostowania, przeniesienia i usunięcia danych (RODO).</p>
        <h2>Cookies</h2>
        <p>Używamy wyłącznie cookies niezbędnych do utrzymania sesji logowania. Bez trackerów reklamowych.</p>
      </main>
      <LandingFooter />
    </div>
  );
}
