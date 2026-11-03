#!/usr/bin/env node
/**
 * Gera as fotos ILUSTRATIVAS da vitrine (public/examples/<estilo>.jpg) com a OpenAI.
 * São imagens de marketing de pessoas fictícias; os ensaios dos clientes usam a foto deles.
 *
 * Uso: node --env-file=.env.local scripts/generate-examples.mjs [estilo...]
 */
import OpenAI from "openai";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const EXAMPLES = {
  "luxo-dourado": [25, "a smiling woman in a champagne satin dress, luxury studio with gold and champagne balloons, gold confetti, white flowers"],
  "rosa-glamour": [18, "a young woman in a soft pink dress, blush pink studio with pastel pink and rose-gold balloon garland, roses and peonies"],
  "preto-dourado": [40, "an elegant man in a black suit, dark luxury studio with black and gold balloons, gold sparkles, champagne tower"],
  "branco-elegante": [30, "a woman in a white elegant outfit, minimalist white studio with white and soft gold balloons, white orchids"],
  "festa-premium": [15, "a cheerful teenage girl in a festive modest dress, lavish party set with pink, gold and white balloons, tiered birthday cake with sparklers"],
  personalizado: [60, "a joyful senior woman in a lilac blouse, enchanted garden at golden hour with lilac balloons and string lights"],
};

if (!process.env.OPENAI_API_KEY) {
  console.error("Defina OPENAI_API_KEY (ex.: node --env-file=.env.local scripts/generate-examples.mjs)");
  process.exit(1);
}

const client = new OpenAI();
const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const only = process.argv.slice(2);
const outDir = path.join(process.cwd(), "public", "examples");
await mkdir(outDir, { recursive: true });

for (const [id, [age, scene]] of Object.entries(EXAMPLES)) {
  if (only.length && !only.includes(id)) continue;
  console.log(`Gerando ${id}…`);
  const res = await client.images.generate({
    model,
    size: "1024x1536",
    quality: "medium",
    prompt: `Professional birthday photoshoot portrait photograph of ${scene}. Large metallic foil number balloons clearly forming the number "${age}", no other text. Shot on full-frame camera 85mm f/2, natural skin texture, realistic, premium editorial photography, vertical framing.`,
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error(`Sem imagem para ${id}`);
  const jpg = await sharp(Buffer.from(b64, "base64")).resize({ width: 720 }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  await writeFile(path.join(outDir, `${id}.jpg`), jpg);
}
console.log("Pronto. Reinicie/rebuild o site para exibir as fotos.");
