import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Anulowano" };

export default function BillingCancel() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 land">
      <div className="auth max-w-md w-full">
        <div className="mono solid" style={{ marginBottom: 14 }} aria-hidden="true"><Icon name="refresh" size={22} stroke={2.6} /></div>
        <h2>Nic nie pobraliśmy</h2>
        <p className="sp mt-2">Plan Free działa dalej. Pro czeka, kiedy tylko będziesz gotowy.</p>
        <Link href="/app" className="pill ghost mt-5">Wróć do apki</Link>
      </div>
    </main>
  );
}
