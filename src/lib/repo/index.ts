import "server-only";
import { fileRepo, fileStorage } from "./file";
import type { Repo, Storage } from "./types";

export * from "./types";
export { cleanupExpired, maybeCleanup } from "./cleanup";

export function repo(): Repo {
  return fileRepo;
}

export function storage(): Storage {
  return fileStorage;
}
