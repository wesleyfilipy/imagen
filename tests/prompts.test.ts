import { describe, expect, it } from "vitest";
import { buildPrompt, sanitizeCustomPrompt } from "@/lib/prompts";
import { STYLES, getStyle } from "@/lib/styles";

describe("buildPrompt", () => {
  it("inclui a idade e a cena de todos os estilos", () => {
    for (const s of STYLES) {
      const p = buildPrompt(s, 30, null);
      expect(p).toContain('forming the number "30"');
      expect(p).toContain(s.scene);
      expect(p).toMatch(/preserve facial identity/i);
      expect(p).toMatch(/Do not replace the person/);
    }
  });

  it("adiciona cuidado extra para menores de idade", () => {
    expect(buildPrompt(getStyle("rosa-glamour")!, 15)).toMatch(/age-appropriate/);
    expect(buildPrompt(getStyle("rosa-glamour")!, 25)).not.toMatch(/age-appropriate/);
  });

  it("inclui o texto personalizado sanitizado", () => {
    const p = buildPrompt(getStyle("personalizado")!, 40, 'jardim\n\nencantado "lilás"');
    expect(p).toContain("jardim encantado 'lilás'");
  });

  it("sanitizeCustomPrompt limita tamanho e remove controles", () => {
    expect(sanitizeCustomPrompt("a".repeat(500))!.length).toBe(240);
    expect(sanitizeCustomPrompt("  \n\t ")).toBeNull();
    expect(sanitizeCustomPrompt(undefined)).toBeNull();
  });
});
