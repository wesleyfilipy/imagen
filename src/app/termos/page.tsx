import type { Metadata } from "next";
import { PRICE_LABEL } from "@/lib/pricing";

export const metadata: Metadata = { title: "Termos de uso — Birthday AI Studio" };

export default function TermosPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="eyebrow">Regras claras</p>
      <h1 className="mt-3 font-serif text-4xl font-semibold">Termos de uso</h1>
      <div className="card mt-8 space-y-5 p-8 leading-relaxed text-ink-soft [&_h2]:mt-6 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink">
        <h2>Uso da foto</h2>
        <p>
          Você declara ter direito de uso da foto enviada e autorização de todas as pessoas que aparecem nela (ou de seus
          responsáveis legais, no caso de menores). É proibido enviar fotos de terceiros sem consentimento ou conteúdo impróprio.
        </p>
        <h2>Imagens geradas por IA</h2>
        <p>
          As fotografias são criadas por inteligência artificial e podem conter pequenas variações em relação à foto original.
          A prévia gratuita existe para que você avalie o resultado antes de pagar.
        </p>
        <h2>Pagamento</h2>
        <p>
          O valor de {PRICE_LABEL} é cobrado uma única vez, por ensaio, para liberar o download em alta resolução. O pagamento é
          processado pela Lastlink e o download é liberado somente após a confirmação da transação.
        </p>
        <h2>Disponibilidade</h2>
        <p>Os arquivos ficam disponíveis por tempo limitado e são excluídos automaticamente. Faça o download assim que liberado.</p>
      </div>
    </article>
  );
}
