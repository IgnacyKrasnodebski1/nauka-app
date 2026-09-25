import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export function LandingHeader() {
  return (
    <header className="land-header">
      <div className="land-wrap flex items-center justify-between h-16">
        <Link href="/" aria-label="Recall — strona główna"><Logo size={30} /></Link>
        <nav className="flex items-center gap-1 sm:gap-2 text-sm font-bold" aria-label="Główna nawigacja">
          <a href="#jak" className="hidden sm:inline px-3 py-2 text-muted hover:text-txt">Jak to działa</a>
          <a href="#gra" className="hidden sm:inline px-3 py-2 text-muted hover:text-txt">Gra</a>
          <a href="#cennik" className="hidden sm:inline px-3 py-2 text-muted hover:text-txt">Cennik</a>
          <a href="#faq" className="hidden sm:inline px-3 py-2 text-muted hover:text-txt">FAQ</a>
          <Link href="/login" className="pill ghost sm2 ml-2">Zaloguj</Link>
          <Link href="/login" className="pill sm2 hidden sm:inline-flex">Zacznij</Link>
        </nav>
      </div>
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className="mt-8" style={{ borderTop: "2px solid var(--line)" }}>
      <div className="land-wrap py-10 text-sm text-muted flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><Logo size={22} /><span>© {new Date().getFullYear()}</span></div>
        <nav className="flex gap-5 font-semibold" aria-label="Stopka">
          <Link href="/regulamin" className="hover:text-txt">Regulamin</Link>
          <Link href="/prywatnosc" className="hover:text-txt">Prywatność</Link>
          <a href="mailto:hej@recall.study" className="hover:text-txt">Kontakt</a>
        </nav>
      </div>
    </footer>
  );
}
