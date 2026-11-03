#!/usr/bin/env node
/**
 * Envia um webhook de pagamento para o endpoint local, autenticado com o token real
 * (LASTLINK_WEBHOOK_TOKEN). Serve para testar a integração em DESENVOLVIMENTO — em produção
 * o pagamento só é confirmado por webhooks reais enviados pela Lastlink.
 *
 * Uso:
 *   node --env-file=.env.local scripts/simulate-webhook.mjs <email> [approved|refund] [generationId]
 */
const [email, kind = "approved", generationId] = process.argv.slice(2);
const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const token = process.env.LASTLINK_WEBHOOK_TOKEN;

if (!email || !token) {
  console.error("Uso: node --env-file=.env.local scripts/simulate-webhook.mjs <email> [approved|refund] [generationId]");
  console.error("LASTLINK_WEBHOOK_TOKEN precisa estar definido.");
  process.exit(1);
}
if (/^https:\/\//.test(base) && !process.argv.includes("--allow-remote")) {
  console.error(`Recusado: ${base} parece produção. Este script é só para desenvolvimento.`);
  process.exit(1);
}

const payload = {
  Id: `sim_${Date.now()}`,
  IsTest: true,
  Event: kind === "refund" ? "Payment_Refund" : "Purchase_Order_Confirmed",
  Data: {
    Buyer: { Email: email, Name: "Cliente Teste" },
    Purchase: { PaymentId: `pay_sim_${email}`, Price: { Value: 19.9 } },
    ...(generationId ? { Utm: { UtmContent: generationId } } : {}),
  },
};

const res = await fetch(`${base}/api/webhooks/lastlink?token=${encodeURIComponent(token)}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
console.log(res.status, await res.text());
