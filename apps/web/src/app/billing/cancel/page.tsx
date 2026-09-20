import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Anulowano" };

export default function BillingCancel() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="card max-w-md w-full glow-head glow-gold">
        <div className="tile gold mb-4" aria-hidden="true">↩</div>
        <h2>Nic nie pobraliśmy</h2>
        <p className="mt-2">Plan Free działa dalej. Pro czeka, kiedy tylko będziesz gotowy.</p>
        <Link href="/app" className="btn3d green mt-5">Wróć do apki</Link>
      </div>
    </main>
  );
}
