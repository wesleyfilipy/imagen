import { NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { getSessionHash } from "@/lib/session";

export const runtime = "nodejs";

/** Último ensaio da sessão atual (usado na página de retorno do checkout). */
export async function GET() {
  const session = await getSessionHash();
  const g = session ? await repo().latestGenerationForSession(session) : null;
  return NextResponse.json({ id: g?.id ?? null }, { headers: { "Cache-Control": "no-store" } });
}
