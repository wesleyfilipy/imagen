import type { EnsaioStyle } from "@/lib/styles";
import { StyleArt } from "./StyleArt";

/** Foto de exemplo (se existir em /public/examples) ou ilustração vetorial. */
export function StyleVisual({
  style,
  exampleSrc,
  age,
  className = "",
}: {
  style: EnsaioStyle;
  exampleSrc?: string | null;
  age?: number | string;
  className?: string;
}) {
  if (exampleSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={exampleSrc} alt={`Exemplo de ensaio ${style.name}`} className={`h-full w-full object-cover ${className}`} loading="lazy" />;
  }
  return <StyleArt style={style} age={age} className={`h-full w-full ${className}`} />;
}
