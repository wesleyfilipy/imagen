import "server-only";
import { BlobError } from "@vercel/blob";
import { blobRepo, blobStorage } from "./blob";
import { fileRepo, fileStorage } from "./file";
import type { Repo, Storage } from "./types";

/** Erro de configuração do servidor — a mensagem é segura para mostrar ao usuário. */
export class ConfigError extends Error {}

/**
 * Mensagem exibível para erros de configuração/armazenamento (não contém segredos);
 * null para erros inesperados, que ficam só no log.
 */
export function describeServerError(err: unknown): string | null {
  if (err instanceof ConfigError) return err.message;
  const message = err instanceof Error ? err.message : "";
  if (err instanceof BlobError || /blob|oidc|credential/i.test(message)) {
    return `Erro no armazenamento (Vercel Blob): ${message.slice(0, 300)}`;
  }
  return null;
}

/**
 * Vercel Blob quando configurado (obrigatório na Vercel, cujo disco não é persistente);
 * caso contrário, disco local em DATA_DIR (VPS, Railway/Render com volume, desenvolvimento).
 */
function useBlob(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return true;
  if (process.env.VERCEL) {
    throw new ConfigError(
      "Armazenamento não configurado: na Vercel, crie um Blob Store em Storage → Create → Blob, conecte-o a este projeto e faça Redeploy.",
    );
  }
  return false;
}

export function repo(): Repo {
  return useBlob() ? blobRepo : fileRepo;
}

export function storage(): Storage {
  return useBlob() ? blobStorage : fileStorage;
}
