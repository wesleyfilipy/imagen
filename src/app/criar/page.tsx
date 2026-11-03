import type { Metadata } from "next";
import { Wizard } from "@/components/Wizard";
import { getExampleImages } from "@/lib/examples";
import { STYLE_IDS, type StyleId } from "@/lib/styles";

export const metadata: Metadata = { title: "Criar meu ensaio — Birthday AI Studio" };

export default async function CriarPage({ searchParams }: { searchParams: Promise<{ estilo?: string }> }) {
  const { estilo } = await searchParams;
  const initialStyle = STYLE_IDS.includes(estilo as StyleId) ? (estilo as StyleId) : null;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Wizard examples={getExampleImages()} initialStyle={initialStyle} />
    </div>
  );
}
