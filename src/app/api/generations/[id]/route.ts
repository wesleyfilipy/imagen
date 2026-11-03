import { NextResponse } from "next/server";
import { jsonError, loadOwnedGeneration, toView } from "@/lib/generations";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await loadOwnedGeneration(id);
  if (!g) return jsonError("Ensaio não encontrado.", 404);
  const check = new URL(req.url).searchParams.get("check") === "1";
  return NextResponse.json(await toView(g, check), { headers: { "Cache-Control": "no-store" } });
}
