"use client";

export const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const ACCEPTED_EXT = /\.(jpe?g|png|webp)$/i;
export const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024;
const TARGET_MAX_SIDE = 2048;
const TARGET_MAX_BYTES = 3.5 * 1024 * 1024;

export function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXT.test(file.name)) {
    return "Formato não suportado. Envie uma foto JPG, JPEG, PNG ou WEBP.";
  }
  if (file.size > MAX_ORIGINAL_BYTES) return "A foto é muito grande. O limite é 15 MB.";
  if (file.size < 10 * 1024) return "A foto parece pequena demais. Envie uma imagem com mais qualidade.";
  return null;
}

/**
 * Redimensiona/comprime no navegador antes do upload (respeita orientação EXIF)
 * para caber no limite de requisição do servidor. A validação definitiva acontece no backend.
 */
export async function prepareForUpload(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, TARGET_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    for (const q of [0.92, 0.85, 0.75, 0.65]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
      if (blob && blob.size <= TARGET_MAX_BYTES) return blob;
    }
    throw new Error("Não foi possível comprimir a foto.");
  } finally {
    bitmap.close();
  }
}
