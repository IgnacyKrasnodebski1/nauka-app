import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dzięki!" };

export default function BillingSuccess() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="result">
        <div className="big">🎉</div>
        <h2>Witaj w Pro!</h2>
        <p>Płatność przeszła. Limity odblokują się w ciągu kilku sekund. Jeśli płaciłeś z telefonu — wróć do apki, wszystko już czeka.</p>
        <Link href="/app?upgraded=1" className="pill sm:w-auto sm:px-8">Do apki →</Link>
      </div>
    </main>
  );
}
