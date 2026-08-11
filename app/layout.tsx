import type { Metadata, Viewport } from "next";
import { NavInferior } from "@/components/NavInferior";
import { ProvedorDados } from "@/components/Dados";
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
        <RegistroSW />
        {/* Uma base de código para os dois usos. No celular é a coluna única de
            448px para a qual tudo foi desenhado; a partir de `md` o container
            abre e as listas viram grade de duas colunas — sem isso, num monitor
            de 1440px sobrariam mil pixels de branco dos dois lados. */}
        {/* O provedor carrega o banco do servidor uma vez e alimenta as telas.
            A carga inicial dos clientes agora acontece no servidor, na primeira
            chamada de /api/dados — não há mais nada a semear no navegador. */}
        <ProvedorDados>
          <div className="mx-auto min-h-dvh max-w-md pb-24 md:max-w-5xl md:px-4">
            {children}
          </div>
          <NavInferior />
        </ProvedorDados>
      </body>
    </html>
  );
}
