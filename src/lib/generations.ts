import "server-only";
import { NextResponse } from "next/server";
import { generateEnsaio, GenerationError } from "./ai";
import { makeFinal, makePreview } from "./image";
import { claimOrphanPayment, isUnlocked } from "./payments";
import { repo, storage, type Generation } from "./repo";
import { getSessionHash } from "./session";
import { getStyle } from "./styles";

const STALE_MS = 9 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const paths = (id: string) => ({
  original: `${id}/original.jpg`,
  result: `${id}/ensaio.jpg`,
  preview: `${id}/preview.jpg`,
});

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Carrega um ensaio garantindo que pertence à sessão atual.
 * Ensaio de outra sessão → mesmo erro de "não encontrado" (não revela que existe).
 */
export async function loadOwnedGeneration(id: string): Promise<Generation | null> {
  if (!UUID_RE.test(id)) return null;
  const session = await getSessionHash();
  if (!session) return null;
  const g = await repo().getGeneration(id);
  if (!g || g.session_hash !== session) return null;

  // Processamento travado (função encerrada antes de terminar)
  if ((g.status === "pending" || g.status === "processing") && Date.now() - Date.parse(g.updated_at) > STALE_MS) {
    return (await repo().updateGeneration(g.id, { status: "failed", error: "O processamento demorou mais que o esperado. Tente novamente." })) ?? g;
  }
  return g;
}

export async function processGeneration(id: string): Promise<void> {
  const r = repo();
  const s = storage();
  const g = await r.getGeneration(id);
  if (!g || g.status !== "pending" || !g.original_path || !g.prompt) return;
  await r.updateGeneration(id, { status: "processing" });

  try {
    const original = await s.download(g.original_path);
    const output = await generateEnsaio(original, g.prompt, g.session_hash, g.age);
    const [finalImg, preview] = await Promise.all([makeFinal(output), makePreview(output)]);
    const p = paths(id);
    await s.upload(p.result, finalImg, "image/jpeg");
    await s.upload(p.preview, preview, "image/jpeg");
    await r.updateGeneration(id, { status: "completed", result_path: p.result, preview_path: p.preview, error: null });
  } catch (err) {
    console.error("[generation] falhou", id, err);
    const message = err instanceof GenerationError ? err.userMessage : "Não foi possível criar seu ensaio agora. Tente novamente.";
    await r.updateGeneration(id, { status: "failed", error: message });
  }
}

export interface GenerationView {
  id: string;
  status: Generation["status"];
  error: string | null;
  age: number;
  style: string;
  styleName: string;
  createdAt: string;
  expiresAt: string;
  paid: boolean;
  refunded: boolean;
  email: string | null;
  checkoutStarted: boolean;
}

export async function toView(g: Generation): Promise<GenerationView> {
  if (!g.paid_at && g.email) {
    if (await claimOrphanPayment(g)) g = (await repo().getGeneration(g.id)) ?? g;
  }
  return {
    id: g.id,
    status: g.status,
    error: g.error,
    age: g.age,
    style: g.style,
    styleName: getStyle(g.style)?.name ?? g.style,
    createdAt: g.created_at,
    expiresAt: g.expires_at,
    paid: isUnlocked(g),
    refunded: Boolean(g.refunded_at),
    email: g.email,
    checkoutStarted: Boolean(g.checkout_started_at),
  };
}
