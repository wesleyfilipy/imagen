import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidade — Birthday AI Studio" };

export default function PrivacidadePage() {
  const days = Number(process.env.RETENTION_DAYS) > 0 ? Number(process.env.RETENTION_DAYS) : 7;
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="eyebrow">Transparência</p>
      <h1 className="mt-3 font-serif text-4xl font-semibold">Política de privacidade</h1>
      <div className="card mt-8 space-y-5 p-8 leading-relaxed text-ink-soft [&_h2]:mt-6 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink">
        <h2>Quais dados coletamos</h2>
        <p>
          A foto que você envia, a idade e o estilo escolhidos, o e-mail informado para o pagamento e dados técnicos mínimos
          (um identificador de sessão anônimo e um hash irreversível do seu IP, usado apenas para evitar abusos).
        </p>
        <h2>Como usamos</h2>
        <p>
          Sua foto é enviada à API da OpenAI exclusivamente para criar o seu ensaio. O e-mail é usado apenas para associar o
          pagamento feito na Lastlink ao seu ensaio. Não vendemos nem compartilhamos seus dados para publicidade.
        </p>
        <h2>Armazenamento e acesso</h2>
        <p>
          As imagens ficam em armazenamento privado. Somente o navegador que criou o ensaio consegue visualizá-lo, e os
          downloads usam links temporários que expiram em poucos minutos.
        </p>
        <h2>Exclusão automática</h2>
        <p>
          A foto original, a foto gerada e os dados do ensaio são excluídos automaticamente após {days} dias. Registros de
          pagamento podem ser mantidos pelo período exigido por lei.
        </p>
        <h2>Seus direitos (LGPD)</h2>
        <p>Você pode solicitar acesso, correção ou exclusão antecipada dos seus dados pelo nosso canal de atendimento.</p>
      </div>
    </article>
  );
}
