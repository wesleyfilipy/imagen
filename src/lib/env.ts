import "server-only";

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
    return process.env.LASTLINK_CHECKOUT_URL || "";
  },
  get webhookToken() {
    return process.env.LASTLINK_WEBHOOK_TOKEN || "";
  },
  get productId() {
    return (process.env.LASTLINK_PRODUCT_ID || "").trim();
  },
  get approvedEvents() {
    return list("LASTLINK_APPROVED_EVENTS");
  },
  get refundEvents() {
    return list("LASTLINK_REFUND_EVENTS");
  },
  get acceptTestEvents() {
    return process.env.LASTLINK_ACCEPT_TEST_EVENTS === "true";
  },

  get sessionSecret() {
    const s = process.env.SESSION_SECRET;
    if (!s && isProduction) throw new Error("SESSION_SECRET não configurado");
    return s || "dev-only-session-secret";
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
