import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="result">
        <div className="big">🫠</div>
        <h2>404 — nie ma takiej strony</h2>
        <p>Może przedmiot został usunięty albo link jest krzywy.</p>
        <Link href="/app" className="pill sm:w-auto sm:px-8">Do apki</Link>
      </div>
    </main>
  );
}
