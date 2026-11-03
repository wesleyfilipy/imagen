import { jsonError, loadOwnedGeneration } from "@/lib/generations";
import { storage } from "@/lib/repo";

export const runtime = "nodejs";

/** Prévia em baixa resolução com marca d'água — nunca o arquivo em alta. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await loadOwnedGeneration(id);
  if (!g || g.status !== "completed" || !g.preview_path) return jsonError("Prévia não encontrada.", 404);

  const data = await storage().download(g.preview_path);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}
