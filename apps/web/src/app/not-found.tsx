import Link from "next/link";
import { Icon } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 land">
      <div className="auth max-w-md w-full">
        <div className="mono solid" style={{ marginBottom: 14 }} aria-hidden="true"><Icon name="question" size={22} stroke={2.6} /></div>
        <h2>404 — nie ma takiej strony</h2>
        <p className="sp mt-2">Może temat został usunięty albo link jest krzywy.</p>
        <Link href="/app" className="pill a-glow mt-5">Do apki</Link>
      </div>
    </main>
  );
}
