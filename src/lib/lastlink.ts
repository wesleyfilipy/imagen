/**
 * Interpretação TOLERANTE do payload de webhook da Lastlink.
 *
 * O formato exato do payload não está documentado neste projeto, então não presumimos nomes
 * fixos de campos: percorremos o JSON inteiro e procuramos chaves conhecidas (e-mail do comprador,
 * tipo/status do evento, id da transação, valor, flag de teste). Para máxima segurança defina
 * LASTLINK_APPROVED_EVENTS com o(s) nome(s) exato(s) do evento de pagamento aprovado.
 */

export type EventKind = "approved" | "refunded" | "other";

export interface ParsedLastlinkEvent {
  eventId: string | null;
  eventType: string | null;
  kind: EventKind;
  email: string | null;
  transactionId: string | null;
  amountCents: number | null;
  isTest: boolean;
  /** Todos os UUIDs encontrados no payload (ex.: utm_content=<id do ensaio>) */
  uuids: string[];
  /** Todos os valores escalares (para conferir LASTLINK_PRODUCT_ID) */
  scalars: string[];
}

export interface ParseOptions {
  approvedEvents?: string[];
  refundEvents?: string[];
}

interface Entry {
  path: string[]; // chaves em minúsculas, sem _ e -
  key: string;
  value: unknown;
}

const norm = (k: string) => k.toLowerCase().replace(/[_\-\s]/g, "");

function walk(node: unknown, path: string[] = [], out: Entry[] = [], depth = 0): Entry[] {
  if (depth > 12 || node == null) return out;
  if (Array.isArray(node)) {
    node.forEach((v) => walk(v, path, out, depth + 1));
  } else if (typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const key = norm(k);
      const p = [...path, key];
      if (v !== null && typeof v === "object") walk(v, p, out, depth + 1);
      else out.push({ path: p, key, value: v });
    }
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

const REFUND_RE = /(refund|chargeback|reembols|estorn|devolu|cancel|revers|dispute|contest)/i;
// Eventos que citam reembolso/cancelamento mas NÃO são um estorno efetivado
// (ex.: "Reembolso solicitado", "Período de reembolso terminado", "Pedido de compra cancelado").
const REFUND_NOT_FINAL_RE = /(request|pedido|solicit|period|per[ií]odo|terminad|ended|over\b|expir)/i;
const NOT_PAID_RE = /(pending|pendente|aguard|waiting|created|criad|expir|abandon|fail|falh|recus|refus|declin|denied|negad|unpaid|overdue|atras|request)/i;
const APPROVED_RE = /(approv|aprovad|confirm|paid|pago|complet|conclu|success|sucesso|captur|authoriz|autoriz)/i;

const KIND_KEYS = new Set(["event", "eventtype", "eventname", "type", "evento", "tipo", "status", "paymentstatus", "purchasestatus", "orderstatus", "situacao", "trigger", "action"]);

export function parseLastlinkEvent(payload: unknown, opts: ParseOptions = {}): ParsedLastlinkEvent {
  const entries = walk(payload);
  const strings = entries.filter((e) => typeof e.value === "string") as (Entry & { value: string })[];

  // Evento: prefere chaves de topo (event/type), depois as aninhadas.
  const kindCandidates = strings
    .filter((e) => KIND_KEYS.has(e.key))
    .sort((a, b) => a.path.length - b.path.length)
    .map((e) => e.value.trim())
    .filter(Boolean);
  const eventType =
    strings.find((e) => e.path.length === 1 && ["event", "eventtype", "eventname", "type", "evento"].includes(e.key))?.value.trim() ??
    kindCandidates[0] ??
    null;

  let kind: EventKind = "other";
  const lowerType = eventType?.toLowerCase() ?? "";
  if (opts.approvedEvents?.length || opts.refundEvents?.length) {
    if (opts.refundEvents?.includes(lowerType)) kind = "refunded";
    else if (opts.approvedEvents?.includes(lowerType)) kind = "approved";
  } else {
    // Heurística: qualquer sinal de estorno/cancelamento vence; depois "não pago"; só então "aprovado".
    if (kindCandidates.some((v) => REFUND_RE.test(v) && !REFUND_NOT_FINAL_RE.test(v))) kind = "refunded";
    else if (kindCandidates.some((v) => NOT_PAID_RE.test(v))) kind = "other";
    else if (kindCandidates.some((v) => APPROVED_RE.test(v))) kind = "approved";
  }

  // E-mail do comprador
  const emails = strings.filter((e) => e.key.includes("email") && EMAIL_RE.test(e.value.trim()));
  const buyerEmail =
    emails.find((e) => e.path.some((p) => /(buyer|customer|comprador|cliente|client|payer|user|contact)/.test(p))) ??
    emails[0];
  const email = buyerEmail ? buyerEmail.value.trim().toLowerCase() : null;

  // Id do evento (topo) e da transação
  const top = entries.filter((e) => e.path.length === 1);
  const idVal = top.find((e) => ["id", "eventid", "webhookid", "notificationid"].includes(e.key))?.value;
  const eventId = idVal != null && idVal !== "" ? String(idVal) : null;

  const txEntry = entries.find(
    (e) =>
      (typeof e.value === "string" || typeof e.value === "number") &&
      /^(transaction|payment|purchase|order|sale|pedido|compra|venda|charge|invoice)(id|code|codigo)$/.test(e.key),
  );
  const transactionId = txEntry ? String(txEntry.value) : null;

  // Valor
  let amountCents: number | null = null;
  const amountEntry = entries.find(
    (e) =>
      /(price|amount|total|valor|value)/.test(e.key) &&
      !/(original|discount|desconto|fee|taxa|tax|commission|comiss|installment)/.test(e.path.join(".")) &&
      (typeof e.value === "number" || (typeof e.value === "string" && /^\d+([.,]\d{1,2})?$/.test(e.value.trim()))),
  );
  if (amountEntry) {
    const raw = typeof amountEntry.value === "number" ? amountEntry.value : Number(String(amountEntry.value).replace(",", "."));
    if (Number.isFinite(raw)) amountCents = Number.isInteger(raw) && raw >= 1000 ? raw : Math.round(raw * 100);
  }

  const isTest = entries.some(
    (e) => ["istest", "test", "sandbox", "testmode"].includes(e.key) && (e.value === true || e.value === "true" || e.value === 1),
  );

  const uuids = [...new Set(strings.flatMap((e) => e.value.match(UUID_RE) ?? []).map((u) => u.toLowerCase()))];
  const scalars = entries
    .filter((e) => typeof e.value === "string" || typeof e.value === "number")
    .map((e) => String(e.value).trim());

  return { eventId, eventType, kind, email, transactionId, amountCents, isTest, uuids, scalars };
}
