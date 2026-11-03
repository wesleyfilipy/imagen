import "server-only";
import { createHash } from "node:crypto";
import { env } from "./env";
import { parseLastlinkEvent } from "./lastlink";
import { repo, type Generation, type PaymentStatus } from "./repo";

export interface WebhookResult {
  status: PaymentStatus | "duplicate";
  generationId?: string | null;
  note?: string;
}

/**
 * Processa um webhook JÁ AUTENTICADO (token verificado na rota).
 * Libera o download somente para eventos de pagamento aprovado e reais (não-teste em produção).
 */
export async function handleLastlinkWebhook(rawBody: string, payload: unknown): Promise<WebhookResult> {
  const ev = parseLastlinkEvent(payload, { approvedEvents: env.approvedEvents, refundEvents: env.refundEvents });
  const r = repo();

  console.info("[lastlink] evento recebido", {
    eventType: ev.eventType,
    kind: ev.kind,
    isTest: ev.isTest,
    hasEmail: Boolean(ev.email),
    transactionId: ev.transactionId,
    amountCents: ev.amountCents,
    topKeys: payload && typeof payload === "object" ? Object.keys(payload).slice(0, 20) : typeof payload,
  });

  let status: PaymentStatus = ev.kind;
  let note: string | null = null;

  if (status === "approved" && ev.isTest && !env.acceptTestEvents) {
    status = "ignored";
    note = "evento de teste ignorado (LASTLINK_ACCEPT_TEST_EVENTS=false)";
  }
  if (status === "approved" && env.productId && !ev.scalars.includes(env.productId)) {
    status = "ignored";
    note = "produto diferente de LASTLINK_PRODUCT_ID";
  }

  // Chave de idempotência: id do evento + tipo; sem id, hash do corpo bruto.
  const eventKey = ev.eventId
    ? `${ev.eventId}:${(ev.eventType ?? "").toLowerCase()}`
    : `sha256:${createHash("sha256").update(rawBody).digest("hex")}`;

  const payment = await r.insertPayment({
    provider: "lastlink",
    provider_event_id: eventKey,
    event_type: ev.eventType,
    status,
    transaction_id: ev.transactionId,
    email: ev.email,
    amount_cents: ev.amountCents,
    is_test: ev.isTest,
    note,
    raw: payload,
  });
  if (!payment) return { status: "duplicate" };

  if (status === "refunded") {
    const revoked = await revokeForRefund(ev.transactionId, ev.uuids);
    return { status, generationId: revoked, note: revoked ? "download revogado" : "nenhum ensaio vinculado" };
  }
  if (status !== "approved") return { status, note: note ?? undefined };

  // 1) Id do ensaio enviado via utm_content no link de checkout (se a Lastlink repassar no payload)
  let target: Generation | null = null;
  for (const id of ev.uuids) {
    const g = await r.getGeneration(id);
    if (g && g.status === "completed" && !g.paid_at) {
      target = g;
      break;
    }
  }
  const byUtm = Boolean(target);
  // 2) E-mail informado pelo cliente antes de ir ao checkout
  if (!target && ev.email) {
    target = (await r.unpaidGenerationsByEmail(ev.email))[0] ?? null;
  }

  console.info("[lastlink] vínculo", { generationId: target?.id ?? null, via: target ? (byUtm ? "utm" : "email") : null });
  if (!target) {
    console.warn("[lastlink] pagamento aprovado sem ensaio correspondente — ficará pendente para o e-mail", ev.email);
    return { status, generationId: null, note: "pagamento aguardando vínculo" };
  }

  const linked = await linkPayment(payment.id, target.id);
  return { status, generationId: linked ? target.id : null };
}

async function linkPayment(paymentId: string, generationId: string): Promise<boolean> {
  const r = repo();
  if (!(await r.assignPayment(paymentId, generationId))) return false;
  if (await r.markGenerationPaid(generationId, paymentId)) return true;
  await r.releasePayment(paymentId); // ensaio já estava pago: devolve o pagamento para não consumi-lo à toa
  return false;
}

async function revokeForRefund(transactionId: string | null, uuids: string[]): Promise<string | null> {
  const r = repo();
  const ids = new Set<string>();
  if (transactionId) {
    for (const p of await r.approvedPaymentsByTransaction(transactionId)) if (p.generation_id) ids.add(p.generation_id);
  }
  for (const id of uuids) {
    const g = await r.getGeneration(id);
    if (g?.paid_at) ids.add(g.id);
  }
  let last: string | null = null;
  for (const id of ids) {
    await r.updateGeneration(id, { refunded_at: new Date().toISOString() });
    last = id;
  }
  return last;
}

/**
 * Se um pagamento aprovado chegou ANTES de existir vínculo (ex.: e-mail diferente informado depois),
 * tenta vincular um pagamento órfão com o mesmo e-mail ao ensaio. Cada pagamento libera um único ensaio.
 */
export async function claimOrphanPayment(g: Generation): Promise<boolean> {
  if (g.paid_at || !g.email || g.status !== "completed" || !g.checkout_started_at) return false;
  for (const p of await repo().unassignedApprovedPaymentsByEmail(g.email)) {
    // só pagamentos feitos depois que este checkout foi iniciado
    if (p.created_at < g.checkout_started_at) continue;
    if (await linkPayment(p.id, g.id)) return true;
  }
  return false;
}

export function isUnlocked(g: Generation): boolean {
  return Boolean(g.paid_at) && !g.refunded_at;
}
