import "server-only";
import { fileRepo as r, fileStorage as s } from "./file";

const g = globalThis as unknown as { __basLastCleanup?: number };
const EVERY_MS = 60 * 60 * 1000;

/** Remove fotos (original, gerada, prévia) e registros de ensaios expirados. */
export async function cleanupExpired(): Promise<{ deleted: number; failed: number }> {
  const expired = await r.listExpiredGenerations(new Date().toISOString(), 500);
  let deleted = 0;
  for (const gen of expired) {
    try {
      await s.remove([gen.original_path, gen.result_path, gen.preview_path].filter((p): p is string => Boolean(p)));
      await r.deleteGeneration(gen.id);
      deleted++;
    } catch (err) {
      console.error("[cleanup] falha ao excluir", gen.id, err);
    }
  }
  if (deleted) console.info(`[cleanup] ${deleted} ensaio(s) expirado(s) excluído(s)`);
  return { deleted, failed: expired.length - deleted };
}

/** Executa a limpeza no máximo uma vez por hora (chamada em segundo plano pelas rotas). */
export async function maybeCleanup(): Promise<void> {
  const now = Date.now();
  if (g.__basLastCleanup && now - g.__basLastCleanup < EVERY_MS) return;
  g.__basLastCleanup = now;
  await cleanupExpired().catch((err) => console.error("[cleanup] erro", err));
}
