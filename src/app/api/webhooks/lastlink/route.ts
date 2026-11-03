import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { parseLastlinkEvent } from "@/lib/lastlink";
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
    console.warn("[lastlink] webhook recusado: token ausente ou incorreto", {
      hasQueryToken: url.searchParams.has("token"),
      headerNames: [...req.headers.keys()].filter((k) => !/^(x-vercel|x-forwarded|x-real-ip|forwarded|cookie)/i.test(k)),
    });
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
