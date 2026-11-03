import Link from "next/link";
import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-cream/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Birthday AI Studio — início">
          <Logo className="h-8 w-8" />
          <span className="font-serif text-lg font-semibold tracking-tight">
            Birthday <span className="gold-text">AI</span> Studio
          </span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-6 text-sm font-medium text-ink-soft">
          <Link href="/#como-funciona" className="hidden sm:inline hover:text-ink transition">Como funciona</Link>
          <Link href="/#estilos" className="hidden sm:inline hover:text-ink transition">Estilos</Link>
          <Link href="/criar" className="rounded-full bg-ink px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-blush-600">
            Criar ensaio
          </Link>
        </nav>
      </div>
    </header>
  );
}
