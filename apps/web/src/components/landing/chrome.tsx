import Link from "next/link";

export function LandingHeader() {
  return (
    <header className="land-header">
      <div className="land-wrap flex items-center justify-between h-16">
        <Link href="/" className="logo" aria-label="NAUKA — strona główna">NAUKA</Link>
        <nav className="flex items-center gap-1 sm:gap-2 text-sm font-semibold" aria-label="Główna nawigacja">
          <a href="#jak" className="hidden sm:inline px-3 py-2 text-muted hover:text-txt">Jak to działa</a>
          <a href="#cennik" className="hidden sm:inline px-3 py-2 text-muted hover:text-txt">Cennik</a>
          <a href="#faq" className="hidden sm:inline px-3 py-2 text-muted hover:text-txt">FAQ</a>
          <Link href="/login" className="pill ghost sm ml-2">Zaloguj</Link>
          <Link href="/login" className="pill sm hidden sm:inline-flex">Zacznij</Link>
        </nav>
      </div>
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--line)] mt-8">
      <div className="land-wrap py-10 text-sm text-muted flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="logo text-[15px]">NAUKA</span><span>© {new Date().getFullYear()}</span></div>
        <nav className="flex gap-5" aria-label="Stopka">
          <Link href="/regulamin" className="hover:text-txt">Regulamin</Link>
          <Link href="/prywatnosc" className="hover:text-txt">Prywatność</Link>
          <a href="mailto:hej@nauka.app" className="hover:text-txt">Kontakt</a>
        </nav>
      </div>
    </footer>
  );
}
