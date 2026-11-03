#!/usr/bin/env node
/**
 * Teste ponta a ponta do fluxo completo contra um servidor rodando (`npm run dev`).
 * Sem OPENAI_API_KEY o servidor (fora de produção) usa o modo demonstração, sem custo.
 *
 * Requer no ambiente do servidor E deste script: LASTLINK_WEBHOOK_TOKEN, CRON_SECRET,
 * LASTLINK_CHECKOUT_URL e LASTLINK_ACCEPT_TEST_EVENTS=false.
 *
 * Uso: BASE_URL=http://localhost:3000 node --env-file=.env.local scripts/e2e-local.mjs
 */
import sharp from "sharp";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const TOKEN = process.env.LASTLINK_WEBHOOK_TOKEN;
const CRON = process.env.CRON_SECRET;
const EMAIL = `cliente.${Date.now()}@exemplo.com`;
const TX = `pay_${Date.now()}`; // sem o id do ensaio: força o vínculo pelo e-mail

let passed = 0;
function check(cond, label, extra) {
  if (!cond) {
    console.error(`  ✗ ${label}`, extra ?? "");
    process.exit(1);
  }
  passed++;
  console.log(`  ✓ ${label}`);
}

let cookie = "";
async function http(path, init = {}, useCookie = true) {
  const res = await fetch(BASE + path, {
    redirect: "manual",
    ...init,
    headers: { ...(init.headers || {}), ...(useCookie && cookie ? { cookie } : {}) },
  });
  const set = res.headers.get("set-cookie");
  if (useCookie && set) cookie = set.split(";")[0];
  return res;
}

const webhook = (body, token = TOKEN) =>
  http(`/api/webhooks/lastlink?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, false);

async function status(id) {
  return (await http(`/api/generations/${id}`)).json();
}

console.log(`E2E contra ${BASE}\n`);

// ── 1. Validação de upload ───────────────────────────────────
console.log("Upload");
const photo = await sharp({ create: { width: 900, height: 1200, channels: 3, background: "#e9c9b8" } })
  .composite([{ input: Buffer.from('<svg width="900" height="1200"><circle cx="450" cy="480" r="220" fill="#c99a83"/></svg>') }])
  .jpeg()
  .toBuffer();

function form({ file = photo, name = "foto.jpg", type = "image/jpeg", age = "30", style = "luxo-dourado" } = {}) {
  const f = new FormData();
  if (file) f.append("photo", new Blob([file], { type }), name);
  f.append("age", age);
  f.append("style", style);
  return f;
}

check((await http("/api/generations", { method: "POST", body: form({ file: null }) })).status === 400, "sem foto → 400");
check(
  (await http("/api/generations", { method: "POST", body: form({ file: Buffer.from("isto não é imagem".repeat(100)), name: "x.png", type: "image/png" }) })).status === 400,
  "arquivo falso com extensão .png → 400",
);
check((await http("/api/generations", { method: "POST", body: form({ age: "0" }) })).status === 400, "idade inválida → 400");
check((await http("/api/generations", { method: "POST", body: form({ style: "hack" }) })).status === 400, "estilo inválido → 400");

const created = await http("/api/generations", { method: "POST", body: form() });
const { id } = await created.json();
check(created.status === 201 && /^[0-9a-f-]{36}$/.test(id), "foto válida → 201 com id", created.status);
check(cookie.startsWith("bas_sid="), "cookie de sessão HttpOnly emitido");

// ── 2. Isolamento entre usuários ─────────────────────────────
console.log("Isolamento");
check((await http(`/api/generations/${id}`, {}, false)).status === 404, "outra sessão não vê o ensaio");
check((await http(`/api/generations/${id}/preview`, {}, false)).status === 404, "outra sessão não vê a prévia");
check((await http(`/api/generations/${id}/download`, {}, false)).status === 404, "outra sessão não baixa");

// ── 3. Processamento ─────────────────────────────────────────
console.log("Processamento");
let s;
for (let i = 0; i < 120; i++) {
  s = await status(id);
  if (s.status === "completed" || s.status === "failed") break;
  await new Promise((r) => setTimeout(r, 1500));
}
check(s.status === "completed", "ensaio concluído", s);
check(s.paid === false, "começa não pago");

const prev = await http(`/api/generations/${id}/preview`);
const prevBuf = Buffer.from(await prev.arrayBuffer());
const prevMeta = await sharp(prevBuf).metadata();
check(prev.status === 200 && prev.headers.get("content-type") === "image/jpeg", "prévia disponível");
check(prevMeta.width === 640, `prévia em baixa resolução (${prevMeta.width}px)`);
check((await http(`/api/generations/${id}/download`)).status === 402, "download bloqueado antes do pagamento");

// ── 4. Checkout ──────────────────────────────────────────────
console.log("Checkout");
const badEmail = await http(`/api/generations/${id}/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "x" }) });
check(badEmail.status === 400, "e-mail inválido → 400");
const co = await http(`/api/generations/${id}/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL.toUpperCase() }) });
const { url } = await co.json();
check(co.status === 200 && new URL(url).searchParams.get("utm_content") === id, "link de checkout com id do ensaio");

// ── 5. Retornar à página de sucesso NÃO libera ───────────────
check((await status(id)).paid === false, "voltar do checkout sem webhook não libera");

// ── 6. Webhook: proteção contra pagamentos falsos ────────────
console.log("Webhook");
const approved = (extra = {}) => ({
  Id: `evt_${Math.random().toString(36).slice(2)}`,
  IsTest: false,
  Event: "Purchase_Order_Confirmed",
  Data: { Buyer: { Email: EMAIL }, Purchase: { PaymentId: TX, Price: { Value: 19.9 } } },
  ...extra,
});
check((await http("/api/webhooks/lastlink", { method: "POST", body: JSON.stringify(approved()) }, false)).status === 401, "sem token → 401");
check((await webhook(approved(), "token-errado-1234567890")).status === 401, "token errado → 401");
check((await status(id)).paid === false, "continua bloqueado após tentativas falsas");

const neutral = { Id: `evt_n_${Date.now()}`, Event: "Fatura Criada", Data: { Buyer: { Email: EMAIL } } };
const viaHeader = await http("/api/webhooks/lastlink", { method: "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(neutral) }, false);
check(viaHeader.status === 200, "token no cabeçalho Authorization é aceito");
const viaBody = await http("/api/webhooks/lastlink", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...neutral, Id: `${neutral.Id}b`, Token: TOKEN }) }, false);
check(viaBody.status === 200, "token dentro do JSON é aceito");
check((await status(id)).paid === false, "evento neutro (fatura criada) não libera");

await webhook({ ...approved(), IsTest: true });
check((await status(id)).paid === false, "evento de teste não libera (LASTLINK_ACCEPT_TEST_EVENTS=false)");

await webhook({ ...approved(), Event: "Purchase_Request_Created" });
check((await status(id)).paid === false, "pedido pendente não libera");

await webhook({ ...approved(), Data: { Buyer: { Email: "outra.pessoa@exemplo.com" } } });
check((await status(id)).paid === false, "pagamento de outro e-mail não libera este ensaio");

const real = approved();
const wr = await (await webhook(real)).json();
check(wr.status === "approved" && wr.generationId === id, "pagamento aprovado vinculado ao ensaio", wr);
check((await status(id)).paid === true, "ensaio liberado");

const dup = await (await webhook(real)).json();
check(dup.status === "duplicate", "reenvio do mesmo evento é idempotente");

// ── 7. Download ──────────────────────────────────────────────
console.log("Download");
const dl = await http(`/api/generations/${id}/download`);
let dlBuf;
if (dl.status === 302) {
  dlBuf = Buffer.from(await (await fetch(dl.headers.get("location"))).arrayBuffer());
  check(false, "download não deve redirecionar");
} else {
  check(dl.status === 200 && /attachment/.test(dl.headers.get("content-disposition") || ""), "download como anexo");
  dlBuf = Buffer.from(await dl.arrayBuffer());
}
const dlMeta = await sharp(dlBuf).metadata();
check(dlMeta.format === "jpeg" && dlMeta.width > prevMeta.width, `arquivo final JPG em alta (${dlMeta.width}x${dlMeta.height})`);

// ── 8. Estorno revoga ────────────────────────────────────────
console.log("Estorno");
await webhook({ Id: `evt_refund_${TX}`, Event: "Payment_Refund", Data: { Buyer: { Email: EMAIL }, Purchase: { PaymentId: TX } } });
const afterRefund = await status(id);
check(afterRefund.paid === false && afterRefund.refunded === true, "estorno bloqueia o download");
check((await http(`/api/generations/${id}/download`)).status === 402, "download → 402 após estorno");

// ── 9. Cron de limpeza ───────────────────────────────────────
console.log("Limpeza");
check((await http("/api/cron/cleanup", {}, false)).status === 401, "cron sem segredo → 401");
const cr = await http("/api/cron/cleanup", { headers: { authorization: `Bearer ${CRON}` } }, false);
check(cr.status === 200, "cron autorizado → 200", await cr.text());

console.log(`\n${passed} verificações passaram ✔`);
