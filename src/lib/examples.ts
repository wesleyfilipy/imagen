import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { STYLES, type StyleId } from "./styles";

/**
 * Fotos de exemplo opcionais em public/examples/<estilo>.jpg (geradas com `npm run examples`).
 * Retorna o caminho público de cada uma que existir.
 */
export function getExampleImages(): Partial<Record<StyleId, string>> {
  const out: Partial<Record<StyleId, string>> = {};
  for (const s of STYLES) {
    if (existsSync(path.join(process.cwd(), "public", "examples", `${s.id}.jpg`))) out[s.id] = `/examples/${s.id}.jpg`;
  }
  return out;
}
