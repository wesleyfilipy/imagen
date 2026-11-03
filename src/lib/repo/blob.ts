import "server-only";
/**
 * Driver Vercel Blob (store PRIVADO) — usado na Vercel, onde o disco não é persistente.
 * Ative em: Vercel → Storage → Create → Blob → conectar ao projeto (cria BLOB_READ_WRITE_TOKEN).
 *
 * Layout:
 *   gen/<id>.json                    registro do ensaio
 *   pay/<id>.json                    registro de pagamento
 *   files/<id>/*.jpg                 fotos
 *   idx/...                          marcadores vazios usados como índices (listados por prefixo)
 *   lock/event/<hash>                idempotência de webhooks (criação exclusiva)
 * Atualizações usam ETag (ifMatch) → sem condições de corrida em pagamento/vínculo.
 */
import { BlobNotFoundError, BlobPreconditionFailedError, del, get, head, list, put } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import type { Generation, NewGeneration, NewPayment, Payment, Repo, Storage } from "./types";

const ACCESS = "private" as const;

/*
 * Autenticação OIDC (BLOB_STORE_ID): o token vem do cabeçalho da requisição. Para tarefas em segundo
 * plano (after), capturamos o token durante a requisição e o repassamos explicitamente.
 */
const authCtx = new AsyncLocalStorage<string>();
const auth = () => {
  const oidcToken = authCtx.getStore();
  return oidcToken && process.env.BLOB_STORE_ID ? { oidcToken, storeId: process.env.BLOB_STORE_ID } : {};
};

/** Chame durante a requisição; devolve um executor que mantém a credencial em segundo plano. */
export async function bindBlobAuth(): Promise<<T>(fn: () => Promise<T>) => Promise<T>> {
  const token = process.env.BLOB_STORE_ID ? await getVercelOidcToken().catch(() => undefined) : undefined;
  return (fn) => (token ? authCtx.run(token, fn) : fn());
}

const h = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 40);
const ts = (iso: string) => String(Date.parse(iso)).padStart(15, "0");
const now = () => new Date().toISOString();

async function readText(pathname: string): Promise<{ text: string; etag: string } | null> {
  const r = await get(pathname, { access: ACCESS, useCache: false, ...auth() });
  if (!r || r.statusCode !== 200) return null;
  return { text: await new Response(r.stream).text(), etag: r.blob.etag };
}

async function readJson<T>(pathname: string): Promise<{ data: T; etag: string } | null> {
  const r = await readText(pathname);
  return r ? { data: JSON.parse(r.text) as T, etag: r.etag } : null;
}

async function writeJson(pathname: string, data: unknown, ifMatch?: string) {
  await put(pathname, JSON.stringify(data), {
    access: ACCESS,
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    ...auth(),
    ...(ifMatch ? { ifMatch } : { allowOverwrite: true }),
  });
}

/** Cria o blob somente se ainda não existir. Retorna false se já existia. */
async function createOnly(pathname: string, body = "1"): Promise<boolean> {
  try {
    await put(pathname, body, { access: ACCESS, addRandomSuffix: false, allowOverwrite: false, contentType: "text/plain", ...auth() });
    return true;
  } catch (err) {
    const exists = await head(pathname, auth()).then(() => true, () => false);
    if (exists) return false;
    throw err;
  }
}

const marker = (pathname: string) =>
  put(pathname, "1", { access: ACCESS, addRandomSuffix: false, allowOverwrite: true, contentType: "text/plain", ...auth() });

async function listPathnames(prefix: string): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix, cursor, limit: 1000, ...auth() });
    out.push(...r.blobs.map((b) => b.pathname));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const normEtag = (e: string) => e.replace(/^W\//, "").replace(/"/g, "");

/**
 * Lê conteúdo + ETag para uma atualização condicional. O ETag do cabeçalho do GET pode vir
 * "fraco" (W/"…", resposta comprimida) e não serve para ifMatch; o de head() vem da mesma API
 * da gravação. Confere que o conteúdo lido corresponde a esse ETag.
 */
async function readForUpdate<T>(pathname: string): Promise<{ data: T; etag: string } | null> {
  for (let i = 0; ; i++) {
    const meta = await head(pathname, auth()).catch((err) => {
      if (err instanceof BlobNotFoundError) return null;
      throw err;
    });
    if (!meta) return null;
    const cur = await readJson<T>(pathname);
    if (!cur) return null;
    if (normEtag(cur.etag) === normEtag(meta.etag) || i >= 2) return { data: cur.data, etag: meta.etag };
    await sleep(150); // gravação concorrente entre head e get: tenta de novo
  }
}

/** Lê-modifica-grava com ETag; repete se outro processo alterou no meio. */
async function mutate<T>(pathname: string, fn: (cur: T) => T | null): Promise<T | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const cur = await readForUpdate<T>(pathname);
    if (!cur) return null;
    const next = fn(cur.data);
    if (next === null) return null; // condição não satisfeita: não grava
    try {
      await writeJson(pathname, next, cur.etag);
      return next;
    } catch (err) {
      if (!(err instanceof BlobPreconditionFailedError)) throw err;
      await sleep(50 + Math.random() * 200 * (attempt + 1));
    }
  }
  throw new Error(`[blob] conflito persistente ao atualizar ${pathname}`);
}

const genPath = (id: string) => `gen/${id}.json`;
const payPath = (id: string) => `pay/${id}.json`;
const idx = {
  session: (v: string) => `idx/session/${v}/`,
  ip: (v: string) => `idx/ip/${v}/`,
  email: (email: string) => `idx/email/${h(email)}/`,
  expires: "idx/expires/",
  payEmail: (email: string) => `idx/payemail/${h(email)}/`,
  payTx: (tx: string) => `idx/paytx/${h(tx)}/`,
  payRecent: "idx/payrecent/",
};
const lastSegment = (p: string) => p.slice(p.lastIndexOf("/") + 1);

async function loadGenerations(ids: string[]): Promise<Generation[]> {
  const rows = await Promise.all(ids.map((id) => readJson<Generation>(genPath(id))));
  return rows.flatMap((r) => (r ? [r.data] : []));
}

export const blobRepo: Repo = {
  async createGeneration(n: NewGeneration) {
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
    await writeJson(genPath(row.id), row);
    const t = ts(row.created_at);
    await Promise.all([
      marker(`${idx.session(row.session_hash)}${t}_${row.id}`),
      marker(`${idx.ip(row.ip_hash)}${t}_${row.id}`),
      marker(`${idx.expires}${ts(row.expires_at)}_${row.id}`),
    ]);
    return row;
  },

  async getGeneration(id) {
    return (await readJson<Generation>(genPath(id)))?.data ?? null;
  },

  async updateGeneration(id, patch) {
    const row = await mutate<Generation>(genPath(id), (cur) => ({ ...cur, ...patch, updated_at: now() }));
    if (row && patch.email) await marker(`${idx.email(patch.email)}${id}`);
    return row;
  },

  async countGenerationsSince(field, value, sinceIso) {
    const prefix = field === "ip_hash" ? idx.ip(value) : idx.session(value);
    const since = ts(sinceIso);
    return (await listPathnames(prefix)).filter((p) => lastSegment(p).split("_")[0] >= since).length;
  },

  async latestGenerationForSession(sessionHash) {
    const names = (await listPathnames(idx.session(sessionHash))).map(lastSegment).sort();
    const last = names.at(-1);
    return last ? this.getGeneration(last.split("_")[1]) : null;
  },

  async unpaidGenerationsByEmail(email) {
    const ids = (await listPathnames(idx.email(email))).map(lastSegment);
    return (await loadGenerations(ids))
      .filter((g) => g.email === email && g.status === "completed" && !g.paid_at && g.checkout_started_at)
      .sort((a, b) => b.checkout_started_at!.localeCompare(a.checkout_started_at!));
  },

  async markGenerationPaid(id, paymentId) {
    const row = await mutate<Generation>(genPath(id), (cur) =>
      cur.paid_at ? null : { ...cur, paid_at: now(), payment_id: paymentId, refunded_at: null, updated_at: now() },
    );
    return Boolean(row);
  },

  async listExpiredGenerations(nowIso, limit) {
    const cutoff = ts(nowIso);
    const ids = (await listPathnames(idx.expires))
      .map(lastSegment)
      .filter((n) => n.split("_")[0] < cutoff)
      .slice(0, limit)
      .map((n) => n.split("_")[1]);
    return loadGenerations(ids);
  },

  async deleteGeneration(id) {
    const g = await this.getGeneration(id);
    if (!g) return;
    const t = ts(g.created_at);
    await del(
      [
        genPath(id),
        `${idx.session(g.session_hash)}${t}_${id}`,
        `${idx.ip(g.ip_hash)}${t}_${id}`,
        `${idx.expires}${ts(g.expires_at)}_${id}`,
        ...(g.email ? [`${idx.email(g.email)}${id}`] : []),
      ],
      auth(),
    );
  },

  async insertPayment(p: NewPayment) {
    if (!(await createOnly(`lock/event/${h(`${p.provider}:${p.provider_event_id}`)}`))) return null;
    const row: Payment = { ...p, id: randomUUID(), generation_id: null, created_at: now() };
    await writeJson(payPath(row.id), row);
    await Promise.all([
      row.email ? marker(`${idx.payEmail(row.email)}${ts(row.created_at)}_${row.id}`) : null,
      row.transaction_id ? marker(`${idx.payTx(row.transaction_id)}${row.id}`) : null,
      marker(`${idx.payRecent}${ts(row.created_at)}_${row.id}`),
    ]);
    return row;
  },

  async assignPayment(paymentId, generationId) {
    const row = await mutate<Payment>(payPath(paymentId), (cur) => (cur.generation_id ? null : { ...cur, generation_id: generationId }));
    return Boolean(row);
  },

  async releasePayment(paymentId) {
    await mutate<Payment>(payPath(paymentId), (cur) => ({ ...cur, generation_id: null }));
  },

  async unassignedApprovedPaymentsByEmail(email) {
    const ids = (await listPathnames(idx.payEmail(email))).map(lastSegment).sort().map((n) => n.split("_")[1]);
    const rows = await Promise.all(ids.map((id) => readJson<Payment>(payPath(id))));
    return rows.flatMap((r) => (r && r.data.status === "approved" && !r.data.generation_id ? [r.data] : []));
  },

  async recentPayments(limit) {
    const ids = (await listPathnames(idx.payRecent)).map(lastSegment).sort().reverse().slice(0, limit).map((n) => n.split("_")[1]);
    const rows = await Promise.all(ids.map((id) => readJson<Payment>(payPath(id))));
    return rows.flatMap((r) => (r ? [r.data] : []));
  },

  async approvedPaymentsByTransaction(tx) {
    const ids = (await listPathnames(idx.payTx(tx))).map(lastSegment);
    const rows = await Promise.all(ids.map((id) => readJson<Payment>(payPath(id))));
    return rows.flatMap((r) => (r && r.data.status === "approved" ? [r.data] : []));
  },
};

export const blobStorage: Storage = {
  async upload(path, data, contentType) {
    await put(`files/${path}`, data, { access: ACCESS, addRandomSuffix: false, allowOverwrite: true, contentType, ...auth() });
  },
  async download(path) {
    const r = await get(`files/${path}`, { access: ACCESS, ...auth() });
    if (!r || r.statusCode !== 200) throw new Error(`[blob] arquivo não encontrado: ${path}`);
    return Buffer.from(await new Response(r.stream).arrayBuffer());
  },
  async remove(paths) {
    if (paths.length) await del(paths.map((p) => `files/${p}`), auth());
  },
};
