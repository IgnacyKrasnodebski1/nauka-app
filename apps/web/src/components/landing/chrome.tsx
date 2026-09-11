import Link from "next/link";

export function LandingHeader() {
  return (
    <header className="mx-auto max-w-5xl px-4 topbar !px-4">
      <Link href="/" className="logo" aria-label="NAUKA — strona główna">📚 <span className="g">NAUKA</span></Link>
      <nav className="flex items-center gap-2 sm:gap-4 text-sm font-bold" aria-label="Główna nawigacja">
        <a href="#jak" className="hidden sm:inline text-muted hover:text-txt">Jak to działa</a>
        <a href="#cennik" className="hidden sm:inline text-muted hover:text-txt">Cennik</a>
        <a href="#faq" className="hidden sm:inline text-muted hover:text-txt">FAQ</a>
        <Link href="/login" className="pill sm">Zaloguj</Link>
      </nav>
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted border-t border-white/10 mt-10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
      <div>© {new Date().getFullYear()} NAUKA · zrobione z ❤️ i kawą przed sesją</div>
      <nav className="flex gap-4" aria-label="Stopka">
        <Link href="/regulamin" className="hover:text-txt">Regulamin</Link>
        <Link href="/prywatnosc" className="hover:text-txt">Polityka prywatności</Link>
        <a href="mailto:hej@nauka.app" className="hover:text-txt">Kontakt</a>
      </nav>
    </footer>
  );
}
