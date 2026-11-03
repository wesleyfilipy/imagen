import "server-only";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { env, isProduction } from "./env";
import { ConfigError } from "./repo/driver";

export class GenerationError extends Error {
  constructor(public userMessage: string, cause?: unknown) {
    super(userMessage, { cause });
  }
}

let client: OpenAI | null = null;
function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env.openaiKey, timeout: 270_000, maxRetries: 1 });
  return client;
}

export function isMockAi(): boolean {
  if (env.openaiKey) return false;
  if (isProduction) throw new ConfigError("OPENAI_API_KEY não configurada no servidor (Settings → Environment Variables) — faça Redeploy após cadastrar.");
  return true;
}

/**
 * Envia a foto ORIGINAL do usuário como imagem de referência para o endpoint de edição
 * (images.edit) — não é geração só por texto — e retorna a imagem gerada.
 */
export async function generateEnsaio(photo: Buffer, prompt: string, safetyId: string, age: number): Promise<Buffer> {
  if (isMockAi()) return mockEnsaio(photo, age);

  try {
    const res = await openai().images.edit({
      model: env.imageModel,
      image: await toFile(photo, "foto.jpg", { type: "image/jpeg" }),
      prompt,
      size: env.imageSize,
      quality: env.imageQuality,
      output_format: "png",
      n: 1,
      safety_identifier: safetyId.slice(0, 64),
      ...(env.inputFidelity ? { input_fidelity: env.inputFidelity } : {}),
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new GenerationError("A IA não retornou nenhuma imagem. Tente novamente.");
    return Buffer.from(b64, "base64");
  } catch (err) {
    if (err instanceof GenerationError) throw err;
    if (err instanceof OpenAI.APIError) {
      console.error("[openai] erro", err.status, err.code, err.message);
      const text = `${err.code ?? ""} ${err.message}`.toLowerCase();
      if (text.includes("moderation") || text.includes("safety")) {
        throw new GenerationError(
          "Esta foto não pôde ser processada pelo filtro de segurança da IA. Tente outra foto, de rosto visível e roupas comuns.",
          err,
        );
      }
      if (err.status === 429) throw new GenerationError("Estamos com muita demanda agora. Tente novamente em alguns minutos.", err);
    } else {
      console.error("[openai] erro inesperado", err);
    }
    throw new GenerationError("Não foi possível criar seu ensaio agora. Tente novamente em instantes.", err);
  }
}

/**
 * MODO DEMONSTRAÇÃO (somente desenvolvimento, sem OPENAI_API_KEY): monta uma composição simples
 * com a própria foto para permitir testar o fluxo completo sem custo. Nunca roda em produção.
 */
async function mockEnsaio(photo: Buffer, age: number): Promise<Buffer> {
  await new Promise((r) => setTimeout(r, 2500));
  const W = 1024;
  const H = 1536;
  const portrait = await sharp(photo).resize(760, 1000, { fit: "cover" }).toBuffer();
  const balloons = [
    [140, 220, "#e7799a"], [880, 260, "#d4a64a"], [110, 560, "#f7c1cf"], [920, 620, "#e9c77b"], [180, 1320, "#d4a64a"], [860, 1300, "#f29bb3"],
  ]
    .map(([x, y, c]) => `<ellipse cx="${x}" cy="${y}" rx="78" ry="94" fill="${c}"/><ellipse cx="${Number(x) - 24}" cy="${Number(y) - 34}" rx="16" ry="24" fill="#fff" fill-opacity=".45"/>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4f6"/><stop offset="1" stop-color="#f3d9c4"/></linearGradient>
    <linearGradient id="au" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7e2a8"/><stop offset="1" stop-color="#b8862f"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>${balloons}
    <text x="${W / 2}" y="250" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="220" fill="url(#au)" stroke="#a87a26" stroke-width="3">${age}</text>
    <text x="${W / 2}" y="1480" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#a87a26" letter-spacing="6">MODO DEMONSTRAÇÃO — SEM IA</text>
  </svg>`;
  return sharp(Buffer.from(svg))
    .composite([{ input: portrait, top: 330, left: (W - 760) / 2 }])
    .png()
    .toBuffer();
}
