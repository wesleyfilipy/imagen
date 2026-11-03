import Link from "next/link";
import { StyleVisual } from "@/components/StyleVisual";
import { getExampleImages } from "@/lib/examples";
import { PRICE_LABEL } from "@/lib/pricing";
import { STYLES, getStyle } from "@/lib/styles";

const STEPS = [
  { n: "01", title: "Envie sua foto", text: "Uma selfie ou foto comum, com o rosto bem visível e boa iluminação." },
  { n: "02", title: "Informe a idade", text: "O número vira balões metalizados e decoração do seu ensaio." },
  { n: "03", title: "Escolha o estilo", text: "Luxo dourado, rosa glamour, preto e dourado e muito mais." },
  { n: "04", title: "Receba seu ensaio", text: "Veja a prévia grátis e libere a foto em alta qualidade." },
];

const FAQ = [
  {
    q: "A pessoa da foto continua sendo eu?",
    a: "Sim. Sua foto original é enviada como referência para a IA, com instruções rigorosas para preservar rosto, cabelo e características naturais. Fotos nítidas, de frente e bem iluminadas dão os melhores resultados.",
  },
  {
    q: "Preciso pagar para ver o resultado?",
    a: `Não. Você vê a prévia gratuitamente. Se gostar, paga ${PRICE_LABEL} uma única vez para baixar a fotografia em alta resolução, sem marca d'água.`,
  },
  {
    q: "Quanto tempo demora?",
    a: "Normalmente de 1 a 2 minutos. Você acompanha o progresso na tela.",
  },
  {
    q: "Minhas fotos ficam salvas?",
    a: "Suas fotos ficam em armazenamento privado, acessível apenas pela sua sessão, e são excluídas automaticamente após alguns dias. Veja nossa política de privacidade.",
  },
];

export default function Home() {
  const examples = getExampleImages();
  const heroStyles = (["rosa-glamour", "luxo-dourado", "preto-dourado"] as const).map((id) => getStyle(id)!);
  const heroAges = [18, 30, 50];

  return (
    <>
      {/* HERO */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div className="animate-fade-up text-center lg:text-left">
          <p className="eyebrow">Ensaio fotográfico com inteligência artificial</p>
          <h1 className="mt-5 font-serif text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Transforme sua foto em um <span className="italic gold-text">ensaio fotográfico</span> de aniversário!
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-soft lg:mx-0">
            Crie fotos incríveis e realistas com inteligência artificial. Escolha sua idade, personalize seu ensaio e
            surpreenda-se com o resultado.
          </p>
          <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
            <Link href="/criar" className="btn-primary">
              Criar meu ensaio
              <span aria-hidden>→</span>
            </Link>
            <span className="text-sm text-ink-soft">Prévia grátis · {PRICE_LABEL} para baixar em HD</span>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-ink-soft lg:justify-start">
            <span className="flex items-center gap-2"><Dot /> Rosto preservado</span>
            <span className="flex items-center gap-2"><Dot /> Pronto em ~2 minutos</span>
            <span className="flex items-center gap-2"><Dot /> Fotos privadas</span>
          </div>
        </div>

        <div className="relative mx-auto h-[420px] w-full max-w-[460px] sm:h-[500px]">
          {heroStyles.map((s, i) => (
            <div
              key={s.id}
              className="absolute top-0 w-[58%] overflow-hidden rounded-[28px] border-4 border-white shadow-[0_30px_60px_-25px_rgba(43,32,36,0.45)] animate-float"
              style={
                {
                  left: ["0%", "21%", "42%"][i],
                  top: ["12%", "0%", "14%"][i],
                  zIndex: i === 1 ? 3 : 1,
                  "--r": ["-7deg", "0deg", "7deg"][i],
                  animationDelay: `${i * 0.8}s`,
                  aspectRatio: "3 / 4",
                } as React.CSSProperties
              }
            >
              <StyleVisual style={s} age={heroAges[i]} exampleSrc={examples[s.id]} />
            </div>
          ))}
          <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-gold-200 bg-white/90 px-5 py-2.5 text-sm font-semibold shadow-lg backdrop-blur">
            ✨ Do celular para o estúdio em minutos
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="scroll-mt-20 bg-white/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle eyebrow="Simples assim" title="Como funciona" />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="card p-7 transition duration-300 hover:-translate-y-1">
                <span className="font-serif text-3xl font-semibold gold-text">{s.n}</span>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ESTILOS */}
      <section id="estilos" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle eyebrow="Exemplos de ensaios" title="Escolha o cenário dos seus sonhos" />
          <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
            {STYLES.map((s, i) => (
              <Link
                key={s.id}
                href={`/criar?estilo=${s.id}`}
                className="group card overflow-hidden p-2 transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(226,107,143,0.55)]"
              >
                <div className="aspect-[3/4] overflow-hidden rounded-[20px]">
                  <StyleVisual
                    style={s}
                    age={[25, 18, 40, 30, 15, 60][i]}
                    exampleSrc={examples[s.id]}
                    className="transition duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="px-3 pb-3 pt-4">
                  <h3 className="font-serif text-lg font-semibold sm:text-xl">{s.name}</h3>
                  <p className="mt-1 hidden text-sm leading-relaxed text-ink-soft sm:block">{s.description}</p>
                </div>
              </Link>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-ink-soft">
            {Object.keys(examples).length ? "Imagens ilustrativas geradas por IA." : "Ilustrações dos cenários disponíveis."}
          </p>
        </div>
      </section>

      {/* PREÇO */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="card relative overflow-hidden p-10 text-center sm:p-14">
            <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blush-100 blur-2xl" />
            <div aria-hidden className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-gold-100 blur-2xl" />
            <div className="relative">
              <p className="eyebrow">Pagamento único</p>
              <h2 className="mt-4 font-serif text-3xl font-semibold sm:text-4xl">Veja grátis. Pague só se amar.</h2>
              <p className="mt-6 font-serif text-6xl font-semibold gold-text">{PRICE_LABEL}</p>
              <ul className="mx-auto mt-8 grid max-w-md gap-3 text-left text-ink-soft">
                {["Prévia gratuita antes de pagar", "Foto em alta resolução", "Sem marca d'água", "Sem assinatura ou mensalidade"].map((t) => (
                  <li key={t} className="flex items-center gap-3"><Check /> {t}</li>
                ))}
              </ul>
              <Link href="/criar" className="btn-primary mt-10">Criar meu ensaio</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionTitle eyebrow="Dúvidas" title="Perguntas frequentes" />
          <div className="mt-10 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="card group p-6 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <span className="text-xl text-gold-500 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
    </div>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-blush-400 to-gold-400" />;
}

function Check() {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blush-400 to-gold-400 text-xs text-white">
      ✓
    </span>
  );
}
