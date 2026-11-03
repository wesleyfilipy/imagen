import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cleanupExpired } from "@/lib/repo";

export const runtime = "nodejs";

/**
 * Exclusão automática (política de privacidade). A limpeza já roda sozinha a cada hora
 * enquanto o site recebe acessos; esta rota permite forçá-la por um cron externo:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://SEU-DOMINIO/api/cron/cleanup
 */
export async function GET(req: Request) {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  return NextResponse.json(await cleanupExpired());
}
