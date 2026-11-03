import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { handleLastlinkWebhook } from "@/lib/payments";

export const runtime = "nodejs";

const MAX_BODY = 256 * 1024;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Webhook da Lastlink. Cadastre no painel da Lastlink a URL:
 *   https://SEU-DOMINIO/api/webhooks/lastlink?token=LASTLINK_WEBHOOK_TOKEN
 * Sem o token correto, nada é processado (proteção contra pagamentos falsos).
 */
export async function POST(req: Request) {
  const expected = env.webhookToken;
  if (!expected || expected.length < 16) {
    console.error("[lastlink] LASTLINK_WEBHOOK_TOKEN ausente ou curto demais — webhook recusado");
    return NextResponse.json({ error: "webhook não configurado" }, { status: 503 });
  }

  const url = new URL(req.url);
  const provided =
    url.searchParams.get("token") ??
    req.headers.get("x-webhook-token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!safeEqual(provided, expected)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "payload grande demais" }, { status: 413 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const result = await handleLastlinkWebhook(raw, payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[lastlink] erro ao processar webhook", err);
    // 500 → a Lastlink pode reenviar; o processamento é idempotente.
    return NextResponse.json({ error: "erro interno" }, { status: 500 });
  }
}
