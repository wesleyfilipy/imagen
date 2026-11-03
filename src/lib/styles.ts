export type StyleId =
  | "luxo-dourado"
  | "rosa-glamour"
  | "preto-dourado"
  | "branco-elegante"
  | "festa-premium"
  | "personalizado";

export interface EnsaioStyle {
  id: StyleId;
  name: string;
  description: string;
  /** Paleta usada nas ilustrações dos cards */
  art: { bg: [string, string]; balloons: string[]; number: [string, string]; dark?: boolean };
  /** Trechos do prompt enviados à OpenAI */
  scene: string;
  wardrobe: string;
  lighting: string;
}

export const STYLES: EnsaioStyle[] = [
  {
    id: "luxo-dourado",
    name: "Luxo Dourado",
    description: "Cenário elegante, balões dourados, iluminação profissional e decoração sofisticada.",
    art: { bg: ["#fbf3e4", "#f1dcb4"], balloons: ["#d4a64a", "#e9c77b", "#b8862f"], number: ["#f7e2a8", "#b8862f"] },
    scene:
      "an elegant luxury photo studio set with a warm champagne-gold backdrop, clusters of glossy gold and champagne balloons, gold confetti on the floor, a refined gold-accented pedestal with candles and fresh white flowers",
    wardrobe: "an elegant outfit in champagne, gold or neutral tones",
    lighting: "warm, soft key light with a large octabox, subtle golden rim light and gentle bokeh highlights",
  },
  {
    id: "rosa-glamour",
    name: "Rosa Glamour",
    description: "Balões rosas, flores, decoração delicada e iluminação de estúdio.",
    art: { bg: ["#fff1f4", "#fbd3de"], balloons: ["#f29bb3", "#f7c1cf", "#e7799a"], number: ["#ffe1ea", "#e7799a"] },
    scene:
      "a delicate glamorous studio set in blush pink, an organic garland of pastel pink, rose-gold and white balloons, lush pink roses and peonies, soft fabric drapes and a small velvet seat",
    wardrobe: "a chic outfit in soft pink, nude or white tones",
    lighting: "bright, soft beauty-dish studio lighting with gentle fill, airy and flattering",
  },
  {
    id: "preto-dourado",
    name: "Preto e Dourado",
    description: "Cenário escuro, balões dourados e fotografia de luxo.",
    art: { bg: ["#1b1714", "#0d0b0a"], balloons: ["#c9a14a", "#1f1f1f", "#e3c27a"], number: ["#f3dd9e", "#a87a26"], dark: true },
    scene:
      "a dramatic dark luxury studio with a deep black backdrop, glossy black and metallic gold balloons, gold sparkles, a black-and-gold pedestal with a champagne tower",
    wardrobe: "a sophisticated black or black-and-gold outfit",
    lighting: "low-key cinematic lighting, a sculpted key light, golden rim lights and high-contrast luxurious mood",
  },
  {
    id: "branco-elegante",
    name: "Branco Elegante",
    description: "Cenário branco, balões brancos e dourados, decoração minimalista.",
    art: { bg: ["#ffffff", "#f1ece4"], balloons: ["#ffffff", "#e8d6ad", "#f5efe4"], number: ["#f7e7c0", "#c39a45"] },
    scene:
      "a clean minimalist white studio, pearl-white and soft gold balloons in a tasteful arrangement, a white plinth, a few white orchids, lots of negative space",
    wardrobe: "a refined white, cream or light neutral outfit",
    lighting: "high-key, even, soft daylight-balanced lighting with very soft shadows",
  },
  {
    id: "festa-premium",
    name: "Festa Premium",
    description: "Muitos balões, bolo de aniversário, iluminação cinematográfica e decoração profissional.",
    art: { bg: ["#fdf0f3", "#f3d5c5"], balloons: ["#e7799a", "#d4a64a", "#f7c1cf", "#ffffff"], number: ["#f7e2a8", "#c58a35"] },
    scene:
      "a lavish premium birthday party set with an abundant ceiling and wall of balloons in pink, gold and white, a beautiful multi-tier birthday cake with sparklers on a decorated table, fairy lights and festive professional decoration",
    wardrobe: "a stylish party outfit that matches the festive palette",
    lighting: "cinematic party lighting with warm practical lights, sparkler glow and soft fill on the face",
  },
  {
    id: "personalizado",
    name: "Personalizado",
    description: "Cenário criativo com elementos de aniversário. Descreva sua ideia, se quiser.",
    art: { bg: ["#f5eefc", "#fde4ec"], balloons: ["#b79ce8", "#f29bb3", "#e9c77b"], number: ["#fbe9ff", "#a77bd6"] },
    scene:
      "a creative, original professional birthday photoshoot set with tasteful birthday elements (balloons, confetti, flowers or cake) in a harmonious color palette",
    wardrobe: "a stylish outfit that harmonizes with the scene",
    lighting: "professional studio lighting that flatters the face",
  },
];

export const STYLE_IDS = STYLES.map((s) => s.id);

export function getStyle(id: string): EnsaioStyle | undefined {
  return STYLES.find((s) => s.id === id);
}

export const MIN_AGE = 1;
export const MAX_AGE = 120;
export const CUSTOM_PROMPT_MAX = 240;
