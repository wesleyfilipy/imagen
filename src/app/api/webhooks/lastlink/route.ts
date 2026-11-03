import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { parseLastlinkEvent } from "@/lib/lastlink";
import { handleLastlinkWebhook } from "@/lib/payments";
import { repo, storage } from "@/lib/repo";

export const runtime = "nodejs";

const MAX_BODY = 256 * 1024;

const REJECTED_PATH = "diag/webhook-last-rejected.json";
const g = globalThis as unknown as { __basLastRejectedAt?: number };

/** Guarda a última tentativa recusada (no máx. 1 gravação/min por instância) para diagnóstico. */
async function recordRejected(info: object) {
  if (g.__basLastRejectedAt && Date.now() - g.__basLastRejectedAt < 60_000) return;
  g.__basLastRejectedAt = Date.now();
  await storage()
    .upload(REJECTED_PATH, Buffer.from(JSON.stringify(info)), "application/json")
    .catch((err) => console.error("[lastlink] falha ao registrar recusa", err));
}

const maskEmail = (e: string | null) => (e ? e.replace(/^(.).*?(@.*)$/, "$1***$2") : null);

/**
 * Diagnóstico (protegido pelo mesmo token): últimos avisos recebidos e a última tentativa recusada.
 *   GET /api/webhooks/lastlink?token=LASTLINK_WEBHOOK_TOKEN
 */
export async function GET(req: Request) {
  const expected = env.webhookToken.trim();
  const provided = new URL(req.url).searchParams.get("token") ?? "";
  if (!expected || !safeEqual(provided, expected)) return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const received = (await repo().recentPayments(10)).map((p) => ({
    at: p.created_at,
    eventType: p.event_type,
    status: p.status,
    isTest: p.is_test,
    note: p.note,
    email: maskEmail(p.email),
    generationId: p.generation_id,
    topKeys: p.raw && typeof p.raw === "object" ? Object.keys(p.raw as object).slice(0, 20) : null,
  }));
  const lastRejected = await storage()
    .download(REJECTED_PATH)
    .then((b) => JSON.parse(b.toString()))
    .catch(() => null);
  return NextResponse.json({ received, lastRejected }, { headers: { "Cache-Control": "no-store" } });
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Webhook da Lastlink. Cadastre no painel da Lastlink a URL:
 *   https://SEU-DOMINIO/api/webhooks/lastlink?token=LASTLINK_WEBHOOK_TOKEN
 * Recomenda-se usar como LASTLINK_WEBHOOK_TOKEN o próprio "Token" exibido pela Lastlink no webhook:
 * assim o aviso é aceito tanto pelo token na URL quanto se a Lastlink o enviar no cabeçalho ou no corpo.
 * Sem o token correto, nada é processado (proteção contra pagamentos falsos).
 */
export async function POST(req: Request) {
  const expected = env.webhookToken.trim();
  if (!expected || expected.length < 16) {
    console.error("[lastlink] LASTLINK_WEBHOOK_TOKEN ausente ou curto demais — webhook recusado");
    return NextResponse.json({ error: "webhook não configurado" }, { status: 503 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "payload grande demais" }, { status: 413 });

  let payload: unknown = null;
  let validJson = true;
  try {
    payload = JSON.parse(raw);
  } catch {
    validJson = false;
  }

  // Token: na URL (?token=), em qualquer cabeçalho (ex.: Authorization: Bearer …) ou em algum campo do JSON.
  const url = new URL(req.url);
  const candidates = [
    url.searchParams.get("token") ?? "",
    ...[...req.headers.values()].map((v) => v.replace(/^Bearer\s+/i, "").trim()),
    ...(validJson ? parseLastlinkEvent(payload).scalars : []),
  ];
  if (!candidates.some((c) => c && safeEqual(c, expected))) {
    const info = {
      at: new Date().toISOString(),
      hasQueryToken: url.searchParams.has("token"),
      headerNames: [...req.headers.keys()].filter((k) => !/^(x-vercel|x-forwarded|x-real-ip|forwarded|cookie)/i.test(k)),
      topKeys: validJson && payload && typeof payload === "object" ? Object.keys(payload).slice(0, 20) : null,
    };
    console.warn("[lastlink] webhook recusado: token ausente ou incorreto", info);
    await recordRejected(info);
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!validJson) {
    console.warn("[lastlink] corpo não é JSON", raw.slice(0, 200));
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const result = await handleLastlinkWebhook(raw, payload);
    console.info("[lastlink] resultado", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[lastlink] erro ao processar webhook", err);
    // 500 → a Lastlink pode reenviar; o processamento é idempotente.
    return NextResponse.json({ error: "erro interno" }, { status: 500 });
  }
}
