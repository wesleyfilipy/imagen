"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Página de retorno do checkout (configure como URL de obrigado na Lastlink, se disponível).
 * NÃO libera nada: apenas leva o cliente de volta ao ensaio, onde o download só aparece
 * depois que o webhook confirmar o pagamento.
 */
export default function ObrigadoPage() {
  const router = useRouter();
  const [none, setNone] = useState(false);

  useEffect(() => {
    fetch("/api/generations/latest", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { id: string | null }) => (d.id ? router.replace(`/ensaio/${d.id}`) : setNone(true)))
      .catch(() => setNone(true));
  }, [router]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <span className="text-5xl">💖</span>
      <h1 className="mt-4 font-serif text-3xl font-semibold">Obrigado pela sua compra!</h1>
      {none ? (
        <>
          <p className="mt-3 text-ink-soft">
            Não encontramos um ensaio neste navegador. Abra o site no mesmo dispositivo e navegador em que você criou seu ensaio.
          </p>
          <Link href="/" className="btn-ghost mt-8">Voltar ao início</Link>
        </>
      ) : (
        <p className="mt-3 text-ink-soft">Estamos confirmando seu pagamento e levando você até seu ensaio…</p>
      )}
    </div>
  );
}
