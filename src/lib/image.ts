import "server-only";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // abaixo do limite de 4,5 MB do corpo de requisição da Vercel
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const MIN_SIDE = 256;
const INPUT_MAX_SIDE = 2048;
const PREVIEW_WIDTH = 640;

export class UploadError extends Error {}

/**
 * Valida a imagem pelo CONTEÚDO (não pela extensão/mime enviados), corrige a orientação EXIF,
 * remove metadados (GPS etc.) e normaliza para JPEG.
 */
export async function normalizeUpload(data: Buffer): Promise<Buffer> {
  if (data.byteLength === 0) throw new UploadError("Arquivo vazio.");
  if (data.byteLength > MAX_UPLOAD_BYTES) throw new UploadError("A foto é muito grande. Envie uma imagem de até 4 MB.");

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(data, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw new UploadError("Arquivo de imagem inválido ou corrompido.");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
    throw new UploadError("Formato não suportado. Use JPG, JPEG, PNG ou WEBP.");
  }
  if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < MIN_SIDE) {
    throw new UploadError(`A foto precisa ter pelo menos ${MIN_SIDE}px de largura e altura.`);
  }

  return sharp(data, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize(INPUT_MAX_SIDE, INPUT_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

/** Arquivo final para download (alta resolução, sem marca d'água). */
export async function makeFinal(data: Buffer): Promise<Buffer> {
  return sharp(data).flatten({ background: "#ffffff" }).jpeg({ quality: 94, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer();
}

/**
 * Prévia pública: baixa resolução + marca d'água desenhada só com formas (sem texto,
 * para não depender de fontes instaladas no servidor). A interface sobrepõe um selo "PRÉVIA".
 */
export async function makePreview(data: Buffer): Promise<Buffer> {
  const resized = await sharp(data).resize({ width: PREVIEW_WIDTH }).toBuffer({ resolveWithObject: true });
  const { width, height } = resized.info;
  const heart =
    "M0,-6 C-4,-14 -16,-12 -16,-2 C-16,6 -6,12 0,18 C6,12 16,6 16,-2 C16,-12 4,-14 0,-6 Z";
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <pattern id="p" width="120" height="120" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
      <path d="${heart}" transform="translate(30,30) scale(0.9)" fill="#ffffff" fill-opacity="0.38" stroke="#b8862f" stroke-opacity="0.35" stroke-width="1.2"/>
      <circle cx="90" cy="90" r="5" fill="#ffffff" fill-opacity="0.35"/>
      <rect x="0" y="58" width="120" height="3" fill="#ffffff" fill-opacity="0.22"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#p)"/>
  <rect x="0" y="${Math.round(height * 0.44)}" width="${width}" height="${Math.round(height * 0.12)}" fill="#ffffff" fill-opacity="0.18"/>
</svg>`;
  return sharp(resized.data)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer();
}
