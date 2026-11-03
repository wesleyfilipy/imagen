import { jsonError, loadOwnedGeneration } from "@/lib/generations";
import { claimOrphanPayment, isUnlocked } from "@/lib/payments";
import { repo, storage } from "@/lib/repo";

export const runtime = "nodejs";

/**
 * Download em alta resolução — somente para a sessão dona do ensaio e após pagamento
 * confirmado por webhook. O arquivo nunca fica em pasta pública.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let g = await loadOwnedGeneration(id);
  if (!g || g.status !== "completed" || !g.result_path) return jsonError("Ensaio não encontrado.", 404);

  if (!g.paid_at && (await claimOrphanPayment(g))) g = (await repo().getGeneration(id)) ?? g;
  if (!isUnlocked(g)) return jsonError("Pagamento ainda não confirmado.", 402);

  const data = await storage().download(g.result_path!);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(data.byteLength),
      "Content-Disposition": `attachment; filename="ensaio-aniversario-${g.age}-anos.jpg"`,
      "Cache-Control": "private, no-store",
    },
  });
}
