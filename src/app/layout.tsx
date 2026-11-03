import type { Metadata, Viewport } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Birthday AI Studio — Ensaio fotográfico de aniversário com IA",
  description:
    "Transforme sua foto em um ensaio fotográfico de aniversário profissional e realista com inteligência artificial.",
  openGraph: {
    title: "Birthday AI Studio",
    description: "Transforme sua foto em um ensaio fotográfico de aniversário com IA.",
    type: "website",
    locale: "pt_BR",
  },
};

export const viewport: Viewport = { themeColor: "#fffaf6" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${playfair.variable} ${manrope.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -left-32 h-[480px] w-[480px] rounded-full bg-blush-200/50 blur-3xl" />
          <div className="absolute top-1/3 -right-40 h-[520px] w-[520px] rounded-full bg-gold-100/80 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 h-[360px] w-[360px] rounded-full bg-blush-100/70 blur-3xl" />
        </div>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
