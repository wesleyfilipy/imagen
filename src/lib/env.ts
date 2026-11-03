import "server-only";
import { createHash } from "node:crypto";

function int(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const isProduction = process.env.NODE_ENV === "production";

/** Lido sob demanda para que mudanças de ambiente (ex.: testes) sejam respeitadas. */
export const env = {
  get openaiKey() {
    return process.env.OPENAI_API_KEY || "";
  },
  get imageModel() {
    return process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  },
  get imageSize() {
    return process.env.OPENAI_IMAGE_SIZE || "1536x2304";
  },
  get imageQuality() {
    return (process.env.OPENAI_IMAGE_QUALITY || "high") as "low" | "medium" | "high" | "xhigh" | "max" | "auto";
  },
  get inputFidelity() {
    const v = process.env.OPENAI_INPUT_FIDELITY;
    return v === "high" || v === "low" ? v : undefined;
  },

  get checkoutUrl() {
    return process.env.LASTLINK_CHECKOUT_URL || "https://lastlink.com/p/C3AA92C82/checkout-payment/";
  },
  get webhookToken() {
    return process.env.LASTLINK_WEBHOOK_TOKEN || "";
  },
  get productId() {
    return (process.env.LASTLINK_PRODUCT_ID || "").trim();
  },
  // Nomes reais enviados pela Lastlink (confirmados com webhooks de teste em 03/11/2026):
  // Compra Completa → Purchase_Order_Confirmed; Reembolsado → Payment_Refund; Estornado → Payment_Chargeback.
  get approvedEvents() {
    const v = list("LASTLINK_APPROVED_EVENTS");
    return v.length ? v : ["purchase_order_confirmed"];
  },
  get refundEvents() {
    const v = list("LASTLINK_REFUND_EVENTS");
    return v.length ? v : ["payment_refund", "payment_chargeback"];
  },
  get acceptTestEvents() {
    return process.env.LASTLINK_ACCEPT_TEST_EVENTS === "true";
  },

  get sessionSecret() {
    // Opcional: sem SESSION_SECRET, deriva um segredo estável da chave da OpenAI (usado só para hash de IP).
    const s = process.env.SESSION_SECRET;
    if (s) return s;
    return createHash("sha256").update(`bas-session:${process.env.OPENAI_API_KEY || "dev"}`).digest("hex");
  },
  get cronSecret() {
    return process.env.CRON_SECRET || "";
  },
  get retentionDays() {
    return int("RETENTION_DAYS", 7);
  },
  get maxPerIpPerDay() {
    return int("MAX_GENERATIONS_PER_IP_PER_DAY", 4);
  },
  get maxPerSessionPerDay() {
    return int("MAX_GENERATIONS_PER_SESSION_PER_DAY", 3);
  },
};
