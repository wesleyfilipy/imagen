import "server-only";
import { blobRepo, blobStorage } from "./blob";
import { fileRepo, fileStorage } from "./file";
import type { Repo, Storage } from "./types";

/** Erro de configuração do servidor — a mensagem é segura para mostrar ao usuário. */
export class ConfigError extends Error {}

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
