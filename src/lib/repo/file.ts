import "server-only";
/**
 * Armazenamento em disco, sem serviços externos:
 *   DATA_DIR/db.json   → ensaios e pagamentos
 *   DATA_DIR/storage/  → fotos (fora de /public: só saem pelas rotas protegidas da API)
 * Requer UM processo Node com disco persistente (VPS, Railway/Render/Fly com volume).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Generation, NewGeneration, NewPayment, Payment, Repo, Storage } from "./types";

const ROOT = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), ".data"));
const DB_FILE = path.join(ROOT, "db.json");
const FILES = path.join(ROOT, "storage");

interface Db {
  generations: Generation[];
  payments: Payment[];
}

// Mutex global: no `next dev` cada rota pode ter sua própria cópia do módulo.
const g = globalThis as unknown as { __basLocalLock?: Promise<unknown> };

async function withDb<T>(fn: (db: Db) => T | Promise<T>, write = false): Promise<T> {
  const run = async () => {
    let db: Db;
    try {
      db = JSON.parse(await fs.readFile(DB_FILE, "utf8"));
    } catch (err) {
      // Só começa vazio se o arquivo não existir; JSON corrompido nunca é sobrescrito.
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      db = { generations: [], payments: [] };
    }
    const result = await fn(db);
    if (write) {
      await fs.mkdir(ROOT, { recursive: true });
      const tmp = `${DB_FILE}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(db, null, 2));
      await fs.rename(tmp, DB_FILE);
    }
    return result;
  };
  const next = (g.__basLocalLock ?? Promise.resolve()).then(run, run);
  g.__basLocalLock = next.catch(() => undefined);
  return next;
}

const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));
const now = () => new Date().toISOString();

export const fileRepo: Repo = {
  createGeneration: (n: NewGeneration) =>
    withDb((db) => {
      const row: Generation = {
        ...n,
        status: "pending",
        error: null,
        original_path: null,
        result_path: null,
        preview_path: null,
        email: null,
        checkout_started_at: null,
        paid_at: null,
        payment_id: null,
        refunded_at: null,
        created_at: now(),
        updated_at: now(),
      };
      db.generations.push(row);
      return clone(row);
    }, true),

  getGeneration: (id) => withDb((db) => clone(db.generations.find((x) => x.id === id) ?? null)),

  updateGeneration: (id, patch) =>
    withDb((db) => {
      const row = db.generations.find((x) => x.id === id);
      if (!row) return null;
      Object.assign(row, patch, { updated_at: now() });
      return clone(row);
    }, true),

  countGenerationsSince: (field, value, since) =>
    withDb((db) => db.generations.filter((x) => x[field] === value && x.created_at >= since).length),

  latestGenerationForSession: (sessionHash) =>
    withDb((db) =>
      clone(
        db.generations
          .filter((x) => x.session_hash === sessionHash)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null,
      ),
    ),

  unpaidGenerationsByEmail: (email) =>
    withDb((db) =>
      clone(
        db.generations
          .filter((x) => x.email === email && x.status === "completed" && !x.paid_at && x.checkout_started_at)
          .sort((a, b) => b.checkout_started_at!.localeCompare(a.checkout_started_at!)),
      ),
    ),

  markGenerationPaid: (id, paymentId) =>
    withDb((db) => {
      const row = db.generations.find((x) => x.id === id);
      if (!row || row.paid_at) return false;
      Object.assign(row, { paid_at: now(), payment_id: paymentId, refunded_at: null, updated_at: now() });
      return true;
    }, true),

  listExpiredGenerations: (nowIso, limit) =>
    withDb((db) => clone(db.generations.filter((x) => x.expires_at < nowIso).slice(0, limit))),

  deleteGeneration: (id) =>
    withDb((db) => {
      db.generations = db.generations.filter((x) => x.id !== id);
      for (const p of db.payments) if (p.generation_id === id) p.generation_id = null;
    }, true),

  insertPayment: (p: NewPayment) =>
    withDb((db) => {
      if (db.payments.some((x) => x.provider === p.provider && x.provider_event_id === p.provider_event_id)) return null;
      const row: Payment = { ...p, id: randomUUID(), generation_id: null, created_at: now() };
      db.payments.push(row);
      return clone(row);
    }, true),

  assignPayment: (paymentId, generationId) =>
    withDb((db) => {
      const row = db.payments.find((x) => x.id === paymentId);
      if (!row || row.generation_id) return false;
      row.generation_id = generationId;
      return true;
    }, true),

  releasePayment: (paymentId) =>
    withDb((db) => {
      const row = db.payments.find((x) => x.id === paymentId);
      if (row) row.generation_id = null;
    }, true),

  unassignedApprovedPaymentsByEmail: (email) =>
    withDb((db) => clone(db.payments.filter((x) => x.email === email && x.status === "approved" && !x.generation_id))),

  approvedPaymentsByTransaction: (tx) =>
    withDb((db) => clone(db.payments.filter((x) => x.transaction_id === tx && x.status === "approved"))),
};

function safePath(p: string): string {
  const full = path.resolve(FILES, p);
  if (!full.startsWith(path.resolve(FILES) + path.sep)) throw new Error("caminho inválido");
  return full;
}

export const fileStorage: Storage = {
  async upload(p, data) {
    const full = safePath(p);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  },
  download: (p) => fs.readFile(safePath(p)),
  async remove(paths) {
    await Promise.all(paths.map((p) => fs.rm(safePath(p), { force: true })));
  },
};
