import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { jsonError, loadOwnedGeneration } from "@/lib/generations";
import { repo } from "@/lib/repo";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;

/**
 * Registra o e-mail do cliente no ensaio e devolve o link de checkout da Lastlink.
 * O e-mail é a chave usada para associar o webhook de pagamento a este ensaio.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await loadOwnedGeneration(id);
  if (!g) return jsonError("Ensaio não encontrado.", 404);
  if (g.status !== "completed") return jsonError("Seu ensaio ainda não está pronto.", 409);
  if (g.paid_at && !g.refunded_at) return jsonError("Este ensaio já foi pago.", 409);
  if (!env.checkoutUrl) return jsonError("Pagamento indisponível no momento (checkout não configurado).", 503);

  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) return jsonError("Informe um e-mail válido.", 400);

  await repo().updateGeneration(g.id, { email, checkout_started_at: new Date().toISOString() });

  // Link fornecido pela Lastlink; apenas acrescentamos UTMs de rastreio com o id do ensaio.
  const url = new URL(env.checkoutUrl);
  url.searchParams.set("utm_source", "birthday-ai-studio");
  url.searchParams.set("utm_medium", "site");
  url.searchParams.set("utm_content", g.id);

  return NextResponse.json({ url: url.toString() }, { headers: { "Cache-Control": "no-store" } });
}
