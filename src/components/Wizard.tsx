"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CUSTOM_PROMPT_MAX, MAX_AGE, MIN_AGE, STYLES, getStyle, type StyleId } from "@/lib/styles";
import { prepareForUpload, validateFile } from "@/lib/client-image";
import { StyleVisual } from "./StyleVisual";

const STEP_LABELS = ["Sua foto", "Idade", "Estilo", "Gerar"];
const QUICK_AGES = [15, 18, 25, 30, 40, 50, 60];

export function Wizard({
  examples,
  initialStyle,
}: {
  examples: Partial<Record<StyleId, string>>;
  initialStyle: StyleId | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [age, setAge] = useState("");
  const [style, setStyle] = useState<StyleId | null>(initialStyle);
  const [custom, setCustom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const ageNum = Number(age);
  const ageValid = Number.isInteger(ageNum) && ageNum >= MIN_AGE && ageNum <= MAX_AGE;
  const canNext = [Boolean(file), ageValid, Boolean(style), true][step];

  const pickFile = useCallback((f: File | undefined | null) => {
    if (!f) return;
    const err = validateFile(f);
    setFileError(err);
    if (err) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  async function submit() {
    if (!file || !ageValid || !style) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const blob = await prepareForUpload(file);
      const form = new FormData();
      form.append("photo", blob, "foto.jpg");
      form.append("age", String(ageNum));
      form.append("style", style);
      if (style === "personalizado") form.append("customPrompt", custom);
      const res = await fetch("/api/generations", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível iniciar seu ensaio. Tente novamente.");
      router.push(`/ensaio/${data.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Erro inesperado. Tente novamente.");
      setSubmitting(false);
    }
  }

  const selected = style ? getStyle(style)! : null;

  return (
    <div className="animate-fade-up">
      <div className="text-center">
        <p className="eyebrow">Criar ensaio</p>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Monte seu ensaio de aniversário</h1>
      </div>

      {/* Progresso */}
      <ol className="mx-auto mt-10 flex max-w-xl items-center">
        {STEP_LABELS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              onClick={() => i < step && !submitting && setStep(i)}
              className={`flex flex-col items-center gap-2 ${i < step ? "cursor-pointer" : "cursor-default"}`}
              aria-current={i === step ? "step" : undefined}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-500 ${
                  i < step
                    ? "bg-gradient-to-br from-blush-400 to-gold-400 text-white"
                    : i === step
                      ? "bg-ink text-white ring-4 ring-blush-100"
                      : "bg-white text-ink-soft border border-gold-200"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </span>
              <span className={`text-xs font-semibold ${i === step ? "text-ink" : "text-ink-soft"}`}>{label}</span>
            </button>
            {i < STEP_LABELS.length - 1 && (
              <span className="mx-2 mb-6 h-0.5 flex-1 rounded bg-gold-100">
                <span className={`block h-full rounded bg-gradient-to-r from-blush-400 to-gold-400 transition-all duration-500 ${i < step ? "w-full" : "w-0"}`} />
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="card mt-8 p-6 sm:p-10">
        {step === 0 && <PhotoStep preview={preview} error={fileError} onPick={pickFile} fileName={file?.name} />}

        {step === 1 && (
          <div className="mx-auto max-w-md text-center">
            <h2 className="font-serif text-2xl font-semibold">Qual idade aparecerá no ensaio?</h2>
            <p className="mt-2 text-ink-soft">O número será formado pelos balões e pela decoração da fotografia.</p>
            <div className="relative mx-auto mt-8 max-w-[220px]">
              <input
                type="number"
                inputMode="numeric"
                min={MIN_AGE}
                max={MAX_AGE}
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
                onKeyDown={(e) => e.key === "Enter" && ageValid && setStep(2)}
                placeholder="30"
                autoFocus
                className="input text-center font-serif text-6xl font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Idade"
              />
              <span className="mt-2 block text-sm font-semibold uppercase tracking-widest text-gold-500">anos</span>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {QUICK_AGES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAge(String(a))}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    ageNum === a ? "border-blush-400 bg-blush-50 text-blush-600" : "border-gold-200 bg-white hover:border-gold-400"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            {age && !ageValid && <p className="mt-4 text-sm text-blush-600">Informe uma idade entre {MIN_AGE} e {MAX_AGE}.</p>}
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="text-center">
              <h2 className="font-serif text-2xl font-semibold">Escolha o estilo do seu ensaio</h2>
              <p className="mt-2 text-ink-soft">Cada estilo tem cenário, decoração e iluminação próprios.</p>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {STYLES.map((s) => {
                const active = style === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s.id)}
                    aria-pressed={active}
                    className={`group relative overflow-hidden rounded-3xl border-2 bg-white p-1.5 text-left transition-all duration-300 ${
                      active ? "border-blush-400 shadow-[0_20px_40px_-20px_rgba(226,107,143,0.7)]" : "border-transparent hover:border-gold-200"
                    }`}
                  >
                    <div className="aspect-[3/4] overflow-hidden rounded-[18px]">
                      <StyleVisual style={s} age={ageValid ? ageNum : 30} exampleSrc={examples[s.id]} className="transition duration-500 group-hover:scale-105" />
                    </div>
                    <div className="px-2 pb-2 pt-3">
                      <p className="font-semibold leading-tight">{s.name}</p>
                      <p className="mt-1 hidden text-xs leading-snug text-ink-soft sm:block">{s.description}</p>
                    </div>
                    {active && (
                      <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-blush-500 text-white shadow-lg">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
            {style === "personalizado" && (
              <div className="mx-auto mt-8 max-w-xl">
                <label htmlFor="custom" className="text-sm font-semibold">
                  Descreva sua ideia <span className="font-normal text-ink-soft">(opcional)</span>
                </label>
                <textarea
                  id="custom"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.slice(0, CUSTOM_PROMPT_MAX))}
                  rows={3}
                  placeholder="Ex.: jardim encantado ao pôr do sol com balões lilás e luzes penduradas"
                  className="input mt-2 resize-none"
                />
                <p className="mt-1 text-right text-xs text-ink-soft">{custom.length}/{CUSTOM_PROMPT_MAX}</p>
              </div>
            )}
          </div>
        )}

        {step === 3 && selected && (
          <div className="grid items-center gap-8 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-3">
              <figure className="overflow-hidden rounded-2xl bg-blush-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview!} alt="Sua foto" className="aspect-[3/4] w-full object-cover" />
                <figcaption className="py-2 text-center text-xs font-semibold text-ink-soft">Sua foto</figcaption>
              </figure>
              <figure className="overflow-hidden rounded-2xl bg-blush-50">
                <div className="aspect-[3/4]">
                  <StyleVisual style={selected} age={ageNum} exampleSrc={examples[selected.id]} />
                </div>
                <figcaption className="py-2 text-center text-xs font-semibold text-ink-soft">{selected.name}</figcaption>
              </figure>
            </div>
            <div>
              <h2 className="font-serif text-2xl font-semibold">Tudo pronto!</h2>
              <dl className="mt-5 space-y-3 text-sm">
                <Row label="Idade" value={`${ageNum} anos`} />
                <Row label="Estilo" value={selected.name} />
                {style === "personalizado" && custom.trim() && <Row label="Sua ideia" value={custom.trim()} />}
              </dl>
              <p className="mt-5 text-sm leading-relaxed text-ink-soft">
                A prévia é gratuita. Você só paga se quiser baixar a foto em alta qualidade.
              </p>
              <button type="button" onClick={submit} disabled={submitting} className="btn-primary mt-7 w-full">
                {submitting ? (
                  <>
                    <Spinner /> Enviando sua foto…
                  </>
                ) : (
                  "Gerar meu ensaio"
                )}
              </button>
              {submitError && (
                <p role="alert" className="mt-4 rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-600">
                  {submitError}
                </p>
              )}
              <p className="mt-4 text-center text-xs text-ink-soft">
                Ao continuar você confirma ter direito de uso da foto e concorda com os <a href="/termos" className="underline">termos</a>.
              </p>
            </div>
          </div>
        )}

        {/* Navegação */}
        {step < 3 && (
          <div className="mt-10 flex items-center justify-between gap-4 border-t border-gold-100 pt-6">
            <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className={`btn-ghost ${step === 0 ? "invisible" : ""}`}>
              ← Voltar
            </button>
            <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="btn-primary px-6 sm:px-10">
              Continuar →
            </button>
          </div>
        )}
        {step === 3 && !submitting && (
          <div className="mt-8 border-t border-gold-100 pt-6">
            <button type="button" onClick={() => setStep(2)} className="btn-ghost">← Voltar</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoStep({
  preview,
  error,
  onPick,
  fileName,
}: {
  preview: string | null;
  error: string | null;
  onPick: (f: File | undefined | null) => void;
  fileName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="text-center">
      <h2 className="font-serif text-2xl font-semibold">Envie sua foto</h2>
      <p className="mt-2 text-ink-soft">Rosto bem visível, de frente e com boa iluminação. JPG, PNG ou WEBP até 15 MB.</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {preview ? (
        <div className="mx-auto mt-8 max-w-xs">
          <div className="overflow-hidden rounded-3xl border-4 border-white shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Prévia da sua foto" className="aspect-[3/4] w-full object-cover" />
          </div>
          <p className="mt-3 truncate text-xs text-ink-soft">{fileName}</p>
          <button type="button" onClick={() => inputRef.current?.click()} className="btn-ghost mt-4">
            Trocar foto
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onPick(e.dataTransfer.files?.[0]);
          }}
          className={`mx-auto mt-8 flex max-w-lg cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed px-6 py-14 transition-all duration-300 ${
            dragging ? "scale-[1.02] border-blush-400 bg-blush-50" : "border-gold-300 bg-white/60 hover:border-blush-300 hover:bg-blush-50/50"
          }`}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blush-100 to-gold-100 text-3xl">📸</span>
          <p className="mt-5 font-semibold">Arraste sua foto aqui</p>
          <p className="mt-1 text-sm text-ink-soft">ou</p>
          <span className="btn-primary mt-4 px-7 py-3">Escolher da galeria</span>
        </div>
      )}

      {error && (
        <p role="alert" className="mx-auto mt-5 max-w-lg rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-600">
          {error}
        </p>
      )}

      <ul className="mx-auto mt-8 grid max-w-lg gap-2 text-left text-xs text-ink-soft sm:grid-cols-3">
        <li className="rounded-2xl bg-white/70 px-3 py-2">✓ Rosto nítido e sem filtros</li>
        <li className="rounded-2xl bg-white/70 px-3 py-2">✓ Sem óculos escuros</li>
        <li className="rounded-2xl bg-white/70 px-3 py-2">✓ Boa luz natural</li>
      </ul>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-2xl bg-cream px-4 py-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

export function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />;
}
