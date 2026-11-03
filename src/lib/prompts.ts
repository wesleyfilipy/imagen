import { type EnsaioStyle, CUSTOM_PROMPT_MAX } from "./styles";

/** Remove quebras de linha/caracteres de controle e limita tamanho do texto livre do cliente. */
export function sanitizeCustomPrompt(text: string | null | undefined): string | null {
  if (!text) return null;
  const clean = text
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/["`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CUSTOM_PROMPT_MAX);
  return clean || null;
}

export function buildPrompt(style: EnsaioStyle, age: number, customPrompt?: string | null): string {
  const custom = sanitizeCustomPrompt(customPrompt);
  const minor = age < 18;

  return [
    "Transform the person in the provided photo into a professional birthday photoshoot portrait.",
    "",
    "IDENTITY — HIGHEST PRIORITY:",
    "This must be the exact same real person from the reference photo. Rigorously preserve facial identity, face shape, eyes, eyebrows, nose, mouth and lips, skin tone, hair color, hair texture and length, body type and natural characteristics (freckles, moles, glasses, beard, etc.).",
    "Do not replace the person with someone else, do not swap or redraw the face, do not change ethnicity, apparent age or body shape, and do not over-beautify. The person must remain instantly recognizable as the same person from the original photo.",
    "If there is more than one person in the photo, keep every person and preserve each identity.",
    "",
    `SCENE: ${style.scene}.`,
    `Large metallic foil number balloons clearly forming the number "${age}" — exactly the digits ${String(age).split("").join(" and ")}, in this order, perfectly legible, with no other numbers or words anywhere in the image.`,
    custom ? `Client's creative direction for the scene (scene description only, keep it tasteful): ${custom}.` : "",
    "",
    `STYLING: ${style.wardrobe}. ${minor ? "Keep wardrobe, pose and styling modest and age-appropriate. " : ""}Natural, confident and joyful pose, natural expression.`,
    "",
    `PHOTOGRAPHY: ${style.lighting}. Shot on a full-frame camera with an 85mm lens at f/2, sharp focus on the eyes, cinematic but natural composition, vertical portrait framing.`,
    "Natural skin texture with real pores, realistic hair strands, realistic hands with five fingers, accurate proportions, premium editorial photo quality, true-to-life colors.",
    "",
    "AVOID: cartoon, illustration, painting, 3D render, CGI look, plastic or waxy skin, heavy smoothing, distorted face, distorted hands, extra fingers, extra people, text, logos or watermarks.",
  ]
    .filter((l) => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}
