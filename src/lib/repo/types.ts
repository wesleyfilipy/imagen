export type GenerationStatus = "pending" | "processing" | "completed" | "failed";

export interface Generation {
  id: string;
  session_hash: string;
  ip_hash: string;
  age: number;
  style: string;
  custom_prompt: string | null;
  status: GenerationStatus;
  error: string | null;
  prompt: string | null;
  model: string | null;
  original_path: string | null;
  result_path: string | null;
  preview_path: string | null;
  email: string | null;
  checkout_started_at: string | null;
  paid_at: string | null;
  payment_id: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export type NewGeneration = Pick<
  Generation,
  "id" | "session_hash" | "ip_hash" | "age" | "style" | "custom_prompt" | "prompt" | "model" | "expires_at"
>;

export type PaymentStatus = "approved" | "refunded" | "other" | "ignored";

export interface Payment {
  id: string;
  provider: string;
  provider_event_id: string;
  event_type: string | null;
  status: PaymentStatus;
  transaction_id: string | null;
  email: string | null;
  amount_cents: number | null;
  generation_id: string | null;
  is_test: boolean;
  note: string | null;
  raw: unknown;
  created_at: string;
}

export type NewPayment = Omit<Payment, "id" | "created_at" | "generation_id">;

export interface Repo {
  createGeneration(g: NewGeneration): Promise<Generation>;
  getGeneration(id: string): Promise<Generation | null>;
  updateGeneration(id: string, patch: Partial<Generation>): Promise<Generation | null>;
  countGenerationsSince(field: "ip_hash" | "session_hash", value: string, sinceIso: string): Promise<number>;
  latestGenerationForSession(sessionHash: string): Promise<Generation | null>;
  /** Ensaios concluídos, não pagos, com checkout iniciado para este e-mail (mais recente primeiro). */
  unpaidGenerationsByEmail(email: string): Promise<Generation[]>;
  /** Marca como pago somente se ainda não estiver pago (atômico). */
  markGenerationPaid(id: string, paymentId: string): Promise<boolean>;
  listExpiredGenerations(nowIso: string, limit: number): Promise<Generation[]>;
  deleteGeneration(id: string): Promise<void>;

  /** Retorna null se o evento já foi registrado (idempotência). */
  insertPayment(p: NewPayment): Promise<Payment | null>;
  /** Vincula um pagamento a um ensaio somente se ainda não estiver vinculado (atômico). */
  assignPayment(paymentId: string, generationId: string): Promise<boolean>;
  releasePayment(paymentId: string): Promise<void>;
  unassignedApprovedPaymentsByEmail(email: string): Promise<Payment[]>;
  approvedPaymentsByTransaction(transactionId: string): Promise<Payment[]>;
}

export interface Storage {
  upload(path: string, data: Buffer, contentType: string): Promise<void>;
  download(path: string): Promise<Buffer>;
  remove(paths: string[]): Promise<void>;
}
