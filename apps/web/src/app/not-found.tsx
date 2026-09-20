import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="card max-w-md w-full glow-head glow-gold">
        <div className="tile gold mb-4" aria-hidden="true">?</div>
        <h2>404 — nie ma takiej strony</h2>
        <p className="mt-2">Może temat został usunięty albo link jest krzywy.</p>
        <Link href="/app" className="btn3d green mt-5">Do apki</Link>
      </div>
    </main>
  );
}
