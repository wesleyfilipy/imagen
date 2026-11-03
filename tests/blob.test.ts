import { beforeEach, describe, expect, it, vi } from "vitest";

// Simulação em memória do @vercel/blob com as mesmas regras de allowOverwrite / ifMatch.
const store = new Map<string, { body: string; etag: string; access: string }>();
let etagSeq = 0;

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => {
  class BlobPreconditionFailedError extends Error {}
  const toText = async (b: unknown) => (typeof b === "string" ? b : Buffer.from(b as Buffer).toString("latin1"));
  return {
    BlobPreconditionFailedError,
    async put(pathname: string, body: unknown, o: { access: string; allowOverwrite?: boolean; ifMatch?: string }) {
      const text = await toText(body);
      // verificação + gravação sem await no meio (atômico, como no servidor real)
      const cur = store.get(pathname);
      if (o.ifMatch && cur?.etag !== o.ifMatch) throw new BlobPreconditionFailedError();
      if (cur && !o.allowOverwrite && !o.ifMatch) throw new Error("This blob already exists");
      const etag = `e${++etagSeq}`;
      store.set(pathname, { body: text, etag, access: o.access });
      return { pathname, etag };
    },
    async get(pathname: string, o: { access: string }) {
      const cur = store.get(pathname);
      if (!cur) return null;
      if (cur.access !== o.access) throw new Error("access mismatch");
      return { statusCode: 200, stream: new Response(cur.body).body, blob: { etag: cur.etag } };
    },
    async head(pathname: string) {
      if (!store.has(pathname)) throw new Error("not found");
      return { pathname };
    },
    async list({ prefix = "", cursor, limit = 1000 }: { prefix?: string; cursor?: string; limit?: number }) {
      const all = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = all.slice(start, start + limit);
      const hasMore = start + limit < all.length;
      return { blobs: page.map((pathname) => ({ pathname })), hasMore, cursor: hasMore ? String(start + limit) : undefined };
    },
    async del(p: string | string[]) {
      for (const k of Array.isArray(p) ? p : [p]) store.delete(k);
    },
  };
});

const { blobRepo: r, blobStorage: s } = await import("@/lib/repo/blob");

const base = (id: string, extra = {}) => ({
  id,
  session_hash: "sess1",
  ip_hash: "ip1",
  age: 30,
  style: "luxo-dourado",
  custom_prompt: null,
  prompt: "p",
  model: "m",
  expires_at: new Date(Date.now() + 86400e3).toISOString(),
  ...extra,
});

const payment = (eventId: string, extra = {}) => ({
  provider: "lastlink",
  provider_event_id: eventId,
  event_type: "Compra Completa",
  status: "approved" as const,
  transaction_id: "tx1",
  email: "cli@ex.com",
  amount_cents: 1990,
  is_test: false,
  note: null,
  raw: {},
  ...extra,
});

describe("driver Vercel Blob", () => {
  beforeEach(() => store.clear());

  it("tudo é gravado como privado", async () => {
    await r.createGeneration(base("11111111-1111-4111-8111-111111111111"));
    await s.upload("x/a.jpg", Buffer.from("img"), "image/jpeg");
    expect([...store.values()].every((v) => v.access === "private")).toBe(true);
    expect((await s.download("x/a.jpg")).toString()).toBe("img");
  });

  it("cria, lê, atualiza, conta por IP/sessão e acha o último da sessão", async () => {
    await r.createGeneration(base("a1"));
    await new Promise((res) => setTimeout(res, 5));
    await r.createGeneration(base("a2"));
    await r.createGeneration(base("b1", { session_hash: "sess2", ip_hash: "ip2" }));
    expect((await r.updateGeneration("a1", { status: "completed" }))?.status).toBe("completed");
    expect((await r.getGeneration("a1"))?.status).toBe("completed");
    const since = new Date(Date.now() - 3600e3).toISOString();
    expect(await r.countGenerationsSince("ip_hash", "ip1", since)).toBe(2);
    expect(await r.countGenerationsSince("session_hash", "sess2", since)).toBe(1);
    expect(await r.countGenerationsSince("ip_hash", "ip1", new Date(Date.now() + 1000).toISOString())).toBe(0);
    expect((await r.latestGenerationForSession("sess1"))?.id).toBe("a2");
    expect(await r.getGeneration("nao-existe")).toBeNull();
  });

  it("acha ensaios não pagos pelo e-mail do checkout", async () => {
    await r.createGeneration(base("g1"));
    await r.updateGeneration("g1", { status: "completed", email: "cli@ex.com", checkout_started_at: new Date().toISOString() });
    await r.createGeneration(base("g2"));
    await r.updateGeneration("g2", { status: "completed" }); // sem e-mail
    expect((await r.unpaidGenerationsByEmail("cli@ex.com")).map((g) => g.id)).toEqual(["g1"]);
    expect(await r.markGenerationPaid("g1", "p1")).toBe(true);
    expect(await r.unpaidGenerationsByEmail("cli@ex.com")).toEqual([]);
  });

  it("pagamento: idempotente por evento e marca como pago uma única vez (mesmo concorrente)", async () => {
    await r.createGeneration(base("g1"));
    const p = await r.insertPayment(payment("evt1"));
    expect(p).not.toBeNull();
    expect(await r.insertPayment(payment("evt1"))).toBeNull();

    const results = await Promise.all([r.markGenerationPaid("g1", "p1"), r.markGenerationPaid("g1", "p2"), r.markGenerationPaid("g1", "p3")]);
    expect(results.filter(Boolean)).toHaveLength(1);

    const assigns = await Promise.all([r.assignPayment(p!.id, "g1"), r.assignPayment(p!.id, "g2")]);
    expect(assigns.filter(Boolean)).toHaveLength(1);
    await r.releasePayment(p!.id);
    expect(await r.assignPayment(p!.id, "g3")).toBe(true);
  });

  it("pagamentos órfãos por e-mail e por transação", async () => {
    const p1 = await r.insertPayment(payment("e1"));
    await r.insertPayment(payment("e2", { status: "other" }));
    expect((await r.unassignedApprovedPaymentsByEmail("cli@ex.com")).map((p) => p.id)).toEqual([p1!.id]);
    expect((await r.approvedPaymentsByTransaction("tx1")).map((p) => p.id)).toEqual([p1!.id]);
    await r.assignPayment(p1!.id, "gX");
    expect(await r.unassignedApprovedPaymentsByEmail("cli@ex.com")).toEqual([]);
  });

  it("lista expirados e exclui registro + índices", async () => {
    await r.createGeneration(base("old", { expires_at: new Date(Date.now() - 1000).toISOString() }));
    await r.updateGeneration("old", { email: "cli@ex.com" });
    await r.createGeneration(base("new"));
    const expired = await r.listExpiredGenerations(new Date().toISOString(), 10);
    expect(expired.map((g) => g.id)).toEqual(["old"]);
    await r.deleteGeneration("old");
    expect(await r.getGeneration("old")).toBeNull();
    expect([...store.keys()].some((k) => k.includes("old"))).toBe(false);
    expect(await r.getGeneration("new")).not.toBeNull();
  });
});
