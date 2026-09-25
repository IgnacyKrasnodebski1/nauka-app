import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Dzięki!" };

export default function BillingSuccess() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 land">
      <div className="auth max-w-md w-full">
        <div className="mono solid" style={{ background: "var(--gold)", borderColor: "var(--gold)", color: "var(--on-gold)", marginBottom: 14 }} aria-hidden="true"><Icon name="star" size={22} /></div>
        <h2>Witaj w Pro</h2>
        <p className="sp mt-2">Płatność przeszła. Limity odblokują się w ciągu kilku sekund. Jeśli płaciłeś z telefonu — wróć do apki, wszystko już czeka.</p>
        <Link href="/app?upgraded=1" className="pill a-glow mt-5">Do apki</Link>
      </div>
    </main>
  );
}
