import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="font-serif text-7xl font-semibold gold-text">404</p>
      <h1 className="mt-4 font-serif text-2xl font-semibold">Página não encontrada</h1>
      <Link href="/" className="btn-primary mt-8">Voltar ao início</Link>
    </div>
  );
}
