import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dzięki!" };

export default function BillingSuccess() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="card max-w-md w-full glow-head glow-gold">
        <div className="tile gold mb-4" aria-hidden="true">✦</div>
        <h2>Witaj w Pro</h2>
        <p className="mt-2">Płatność przeszła. Limity odblokują się w ciągu kilku sekund. Jeśli płaciłeś z telefonu — wróć do apki, wszystko już czeka.</p>
        <Link href="/app?upgraded=1" className="pill mt-5">Do apki</Link>
      </div>
    </main>
  );
}
