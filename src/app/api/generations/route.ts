import { NextResponse, after } from "next/server";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { isMockAi } from "@/lib/ai";
import { jsonError, paths, processGeneration } from "@/lib/generations";
import { normalizeUpload, UploadError, MAX_UPLOAD_BYTES } from "@/lib/image";
import { buildPrompt, sanitizeCustomPrompt } from "@/lib/prompts";
import { bindBlobAuth, ConfigError, maybeCleanup, repo, storage } from "@/lib/repo";
import { getClientIpHash, getOrCreateSessionHash } from "@/lib/session";
import { getStyle, MAX_AGE, MIN_AGE } from "@/lib/styles";

export const runtime = "nodejs";
// A geração continua em segundo plano (after). maxDuration só tem efeito em plataformas serverless.
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    return await create(req);
  } catch (err) {
    console.error("[generations] erro ao criar ensaio", err);
    if (err instanceof ConfigError) return jsonError(err.message, 503);
    return jsonError("Erro no servidor ao iniciar seu ensaio. Tente novamente em instantes.", 500);
  }
}

async function create(req: Request) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) return jsonError("A foto é muito grande. Envie uma imagem de até 4 MB.", 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Requisição inválida.", 400);
  }

  const photo = form.get("photo");
  const age = Number(form.get("age"));
  const style = getStyle(String(form.get("style") ?? ""));
  const custom = style?.id === "personalizado" ? sanitizeCustomPrompt(String(form.get("customPrompt") ?? "")) : null;

  if (!(photo instanceof File)) return jsonError("Envie uma foto.", 400);
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) return jsonError(`Informe uma idade entre ${MIN_AGE} e ${MAX_AGE}.`, 400);
  if (!style) return jsonError("Escolha um estilo de ensaio.", 400);

  let normalized: Buffer;
  try {
    normalized = await normalizeUpload(Buffer.from(await photo.arrayBuffer()));
  } catch (err) {
    if (err instanceof UploadError) return jsonError(err.message, 400);
    throw err;
  }

  const session = await getOrCreateSessionHash();
  const ip = await getClientIpHash();
  const r = repo();

  // Limites anti-abuso (cada geração tem custo real na OpenAI)
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [bySession, byIp] = await Promise.all([
    r.countGenerationsSince("session_hash", session, since),
    r.countGenerationsSince("ip_hash", ip, since),
  ]);
  if (bySession >= env.maxPerSessionPerDay || byIp >= env.maxPerIpPerDay) {
    return jsonError("Você atingiu o limite de prévias gratuitas por hoje. Tente novamente amanhã.", 429);
  }

  const id = randomUUID();
  const p = paths(id);
  await storage().upload(p.original, normalized, "image/jpeg");
  await r.createGeneration({
    id,
    session_hash: session,
    ip_hash: ip,
    age,
    style: style.id,
    custom_prompt: custom,
    prompt: buildPrompt(style, age, custom),
    model: isMockAi() ? "mock" : env.imageModel,
    expires_at: new Date(Date.now() + env.retentionDays * 24 * 3600 * 1000).toISOString(),
  });
  await r.updateGeneration(id, { original_path: p.original });

  const withAuth = await bindBlobAuth(); // credencial do Blob válida também em segundo plano
  after(() =>
    withAuth(async () => {
      await processGeneration(id);
      await maybeCleanup();
    }),
  );

  return NextResponse.json({ id }, { status: 201 });
}
