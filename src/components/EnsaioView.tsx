"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PRICE_LABEL } from "@/lib/pricing";
import { Spinner } from "./Wizard";

interface View {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  error: string | null;
  age: number;
  styleName: string;
  paid: boolean;
  refunded: boolean;
  email: string | null;
  checkoutStarted: boolean;
  expiresAt: string;
}

const LOADING_MESSAGES = [
  "Preparando seu cenário",
  "Inflando os balões",
  "Ajustando a iluminação do estúdio",
  "Criando sua fotografia",
  "Preservando cada detalhe do seu rosto",
  "Finalizando seu ensaio",
];
const EXPECTED_SECONDS = 100;

export function EnsaioView({ id }: { id: string }) {
  const [view, setView] = useState<View | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [awaitingPayment, setAwaitingPayment] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/generations/${id}`, { cache: "no-store" });
    if (res.status === 404) return setNotFound(true);
    if (res.ok) setView(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Polling: rápido durante a geração; mais lento aguardando pagamento.
  const processing = view?.status === "pending" || view?.status === "processing";
  const waitingPay = view?.status === "completed" && !view.paid && (awaitingPayment || view.checkoutStarted);
  useEffect(() => {
    if (!processing && !waitingPay) return;
    const t = setInterval(load, processing ? 2500 : 5000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [processing, waitingPay, load]);

  if (notFound) {
    return (
      <Centered>
        <h1 className="font-serif text-3xl font-semibold">Ensaio não encontrado</h1>
        <p className="mt-3 text-ink-soft">
          Este link pode ter expirado ou ter sido aberto em outro navegador. Por segurança, cada ensaio só pode ser visto no
          dispositivo em que foi criado.
        </p>
        <Link href="/criar" className="btn-primary mt-8">Criar novo ensaio</Link>
      </Centered>
    );
  }

  if (!view) {
    return (
      <Centered>
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-blush-100 border-t-blush-400" />
      </Centered>
    );
  }

  if (processing) return <Loading />;

  if (view.status === "failed") {
    return (
      <Centered>
        <span className="text-5xl">😔</span>
        <h1 className="mt-4 font-serif text-3xl font-semibold">Não conseguimos criar seu ensaio</h1>
        <p className="mt-3 max-w-md text-ink-soft">{view.error || "Ocorreu um erro inesperado."}</p>
        <Link href="/criar" className="btn-primary mt-8">Tentar novamente</Link>
      </Centered>
    );
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12 animate-fade-up">
      <PreviewImage id={view.id} locked={!view.paid} />
      <div className="lg:sticky lg:top-24">
        {view.paid ? (
          <Unlocked view={view} />
        ) : (
          <Paywall view={view} onCheckoutOpened={() => setAwaitingPayment(true)} waiting={waitingPay} onRefresh={load} />
        )}
      </div>
    </div>
  );
}

function PreviewImage({ id, locked }: { id: string; locked: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="relative mx-auto w-full max-w-md select-none overflow-hidden rounded-[32px] border-[6px] border-white bg-blush-50 shadow-[0_40px_80px_-40px_rgba(43,32,36,0.55)]"
      onContextMenu={(e) => locked && e.preventDefault()}
    >
      {!loaded && <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,#fff5f7,#fbe8d6,#fff5f7)] bg-[length:200%_100%]" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/generations/${id}/preview`}
        alt="Prévia do seu ensaio de aniversário"
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={`aspect-[2/3] w-full object-cover transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
      {locked && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-24 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <span key={i} className="-rotate-[24deg] whitespace-nowrap font-serif text-3xl font-semibold tracking-[0.3em] text-white/45 [text-shadow:0_1px_3px_rgba(0,0,0,0.25)]">
              PRÉVIA · BIRTHDAY AI STUDIO
            </span>
          ))}
        </div>
      )}
      {locked && (
        <span className="absolute left-4 top-4 rounded-full bg-ink/75 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur">
          🔒 Prévia
        </span>
      )}
    </div>
  );
}

function Paywall({
  view,
  waiting,
  onCheckoutOpened,
  onRefresh,
}: {
  view: View;
  waiting: boolean;
  onCheckoutOpened: () => void;
  onRefresh: () => void;
}) {
  const [email, setEmail] = useState(view.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    // Abre a aba de forma síncrona (evita bloqueio de pop-up) e define a URL depois.
    const win = window.open("", "_blank");
    try {
      const res = await fetch(`/api/generations/${view.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível abrir o pagamento.");
      if (win) {
        win.opener = null;
        win.location.href = data.url;
      }
      else window.location.href = data.url;
      onCheckoutOpened();
    } catch (err) {
      win?.close();
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-7 sm:p-9">
      {view.refunded && (
        <p className="mb-5 rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-600">
          O pagamento deste ensaio foi estornado, por isso o download foi bloqueado.
        </p>
      )}
      <h1 className="font-serif text-3xl font-semibold sm:text-4xl">Seu ensaio está pronto! ❤️</h1>
      <p className="mt-3 text-lg text-ink-soft">Gostou do resultado? Libere agora sua fotografia em alta qualidade.</p>

      <div className="mt-7 flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="whitespace-nowrap font-serif text-4xl font-semibold gold-text sm:text-5xl">{PRICE_LABEL}</span>
        <span className="pb-2 text-sm font-semibold text-ink-soft">pagamento único</span>
      </div>
      <ul className="mt-5 space-y-2 text-sm text-ink-soft">
        <li>✓ Alta resolução, sem marca d&apos;água</li>
        <li>✓ Arquivo JPG pronto para postar e imprimir</li>
        <li>✓ Liberação automática após a confirmação</li>
      </ul>

      <form onSubmit={checkout} className="mt-7">
        <label htmlFor="email" className="text-sm font-semibold">Seu e-mail</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@email.com"
          className="input mt-2"
        />
        <p className="mt-2 text-xs text-ink-soft">Use <strong>o mesmo e-mail</strong> no checkout — é com ele que identificamos seu pagamento.</p>
        <button type="submit" disabled={busy} className="btn-primary mt-5 w-full px-4 text-xs tracking-[0.08em] sm:px-8 sm:text-sm sm:tracking-[0.14em]">
          {busy ? <><Spinner /> Abrindo pagamento…</> : `Liberar minha foto — ${PRICE_LABEL}`}
        </button>
        {error && <p role="alert" className="mt-4 rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-600">{error}</p>}
      </form>

      {waiting && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-gold-200 bg-gold-100/40 p-4 text-sm">
          <span className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gold-300 border-t-gold-600" />
          <div>
            <p className="font-semibold">Aguardando a confirmação do pagamento…</p>
            <p className="mt-1 text-ink-soft">
              Assim que a Lastlink confirmar, o download é liberado aqui automaticamente. Pix costuma levar segundos.
            </p>
            <button type="button" onClick={onRefresh} className="mt-2 font-semibold text-gold-600 underline">Verificar agora</button>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-ink-soft">🔒 Pagamento processado com segurança pela Lastlink</p>
    </div>
  );
}

function Unlocked({ view }: { view: View }) {
  return (
    <div className="card p-7 text-center sm:p-9 lg:text-left">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blush-400 to-gold-400 text-2xl text-white shadow-lg">✓</span>
      <h1 className="mt-5 font-serif text-3xl font-semibold">Pagamento confirmado! Sua fotografia está liberada.</h1>
      <p className="mt-3 text-ink-soft">
        Ensaio {view.styleName} · {view.age} anos. Baixe agora em alta resolução, sem marca d&apos;água.
      </p>
      <a href={`/api/generations/${view.id}/download`} className="btn-primary mt-7 w-full">
        Baixar minha foto
      </a>
      <p className="mt-4 text-xs text-ink-soft">
        Disponível até {new Date(view.expiresAt).toLocaleDateString("pt-BR")}. Depois disso o arquivo é excluído automaticamente.
      </p>
      <Link href="/criar" className="btn-ghost mt-6">Criar outro ensaio</Link>
    </div>
  );
}

function Loading() {
  const [i, setI] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const start = useRef(Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      const s = (Date.now() - start.current) / 1000;
      setElapsed(s);
      setI(Math.min(LOADING_MESSAGES.length - 1, Math.floor((s / EXPECTED_SECONDS) * LOADING_MESSAGES.length)));
    }, 500);
    return () => clearInterval(t);
  }, []);

  // Progresso assintótico: nunca chega a 100% antes de terminar.
  const progress = Math.min(96, 100 * (1 - Math.exp(-elapsed / (EXPECTED_SECONDS * 0.55))));

  return (
    <Centered>
      <div className="relative h-36 w-36">
        {["#ef8fab", "#d4a64a", "#f7b3c6"].map((c, k) => (
          <span
            key={k}
            className="absolute h-16 w-14 rounded-[50%] animate-float"
            style={
              {
                background: `radial-gradient(circle at 30% 30%, #fff8, ${c})`,
                left: `${[8, 42, 74][k]}px`,
                top: `${[30, 6, 34][k]}px`,
                animationDelay: `${k * 0.5}s`,
                "--r": `${[-10, 0, 10][k]}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <h1 key={i} className="mt-6 animate-fade-up font-serif text-3xl font-semibold">{LOADING_MESSAGES[i]}…</h1>
      <p className="mt-3 text-ink-soft">Isso costuma levar de 1 a 2 minutos. Pode deixar esta página aberta.</p>
      <div className="mt-8 h-2 w-full max-w-sm overflow-hidden rounded-full bg-blush-100">
        <div className="h-full rounded-full bg-gradient-to-r from-blush-400 to-gold-400 transition-[width] duration-500" style={{ width: `${progress}%` }} />
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">{children}</div>;
}
