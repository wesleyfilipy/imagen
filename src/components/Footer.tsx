import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gold-100 bg-white/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-ink-soft sm:flex-row sm:px-6">
        <p>© {new Date().getFullYear()} Birthday AI Studio. Imagens criadas com inteligência artificial.</p>
        <nav className="flex gap-5">
          <Link href="/privacidade" className="hover:text-ink transition">Privacidade</Link>
          <Link href="/termos" className="hover:text-ink transition">Termos de uso</Link>
        </nav>
      </div>
    </footer>
  );
}
