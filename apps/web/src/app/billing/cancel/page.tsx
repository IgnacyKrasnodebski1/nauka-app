import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Anulowano" };

export default function BillingCancel() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="result">
        <div className="big">🫡</div>
        <h2>Spoko, nic nie pobraliśmy</h2>
        <p>Plan Free działa dalej. Pro czeka, kiedy tylko będziesz gotowy.</p>
        <Link href="/app" className="pill sm:w-auto sm:px-8">Wróć do apki</Link>
      </div>
    </main>
  );
}
