import type { Metadata, Viewport } from "next";
import { CargaInicial } from "@/components/CargaInicial";
import { NavInferior } from "@/components/NavInferior";
import { RegistroSW } from "@/components/RegistroSW";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campo",
  description: "Roteiro, CRM e vendas de rua — Gerais Solidificação",
  applicationName: "Campo",
  // O iOS ignora o manifest; estas duas chaves são o que faz ele abrir em
  // modo standalone quando adicionado à tela de início.
  appleWebApp: {
    capable: true,
    title: "Campo",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0b3fa8",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <CargaInicial />
        <RegistroSW />
        <div className="mx-auto min-h-dvh max-w-md pb-24">{children}</div>
        <NavInferior />
      </body>
    </html>
  );
}
