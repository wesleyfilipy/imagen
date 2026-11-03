import type { Metadata } from "next";
import { EnsaioView } from "@/components/EnsaioView";

export const metadata: Metadata = {
  title: "Seu ensaio — Birthday AI Studio",
  robots: { index: false, follow: false },
};

export default async function EnsaioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <EnsaioView id={id} />
    </div>
  );
}
