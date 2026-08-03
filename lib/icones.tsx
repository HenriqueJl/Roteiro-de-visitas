"use client";

/**
 * Conjunto de ícones do app.
 *
 * Emoji foi trocado por SVG desenhado aqui por três razões práticas, além da
 * estética: emoji muda de desenho conforme o sistema (o mesmo 🏥 é uma coisa no
 * Android e outra no iOS), não herda a cor do texto, e não escala junto com a
 * tipografia. Um traço só, `currentColor`, e o ícone passa a obedecer ao
 * contexto em que está.
 *
 * Sem biblioteca: são trinta e poucos glifos simples e a especificação pede para
 * não somar dependência. Todos no mesmo grid de 24, traço 1.75, pontas
 * arredondadas — é o que os faz parecer um conjunto e não uma coleção.
 */

import type { SVGProps } from "react";

const T = ({ children }: { children: React.ReactNode }) => <>{children}</>;

/** Cada entrada é só o conteúdo do <svg>; o invólucro é comum a todos. */
const GLIFOS: Record<string, React.ReactNode> = {
  // --- navegação principal ---
  hoje: (
    <T>
      <path d="M3 10.6 12 3.4l9 7.2" />
      <path d="M5.6 9.4V20.6h12.8V9.4" />
    </T>
  ),
  roteiro: (
    <T>
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <path d="M8.2 16.6 15.8 7.4" />
    </T>
  ),
  clientes: (
    <T>
      <circle cx="9.5" cy="8" r="3.2" />
      <path d="M3.2 20.4c0-3.5 2.8-5.4 6.3-5.4s6.3 1.9 6.3 5.4" />
      <path d="M16.4 5.6a3.2 3.2 0 0 1 0 6.3" />
      <path d="M18 14.9c1.9.6 3 2.3 3 5.5" />
    </T>
  ),
  vendas: (
    <T>
      <rect x="2.6" y="6.4" width="18.8" height="11.2" rx="1.8" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M6 10v4M18 10v4" />
    </T>
  ),
  notas: (
    <T>
      <path d="M6.2 3.4h7.4l4.2 4.2v13H6.2z" />
      <path d="M13.4 3.4v4.4h4.4" />
      <path d="M9 13h6M9 16.6h4.4" />
    </T>
  ),
  kpi: (
    <T>
      <path d="M3.4 20.6h17.2" />
      <path d="M7 20.6v-6.4M12 20.6V6.6M17 20.6v-9.4" />
    </T>
  ),

  // --- tipo de cliente ---
  hospital: (
    <T>
      <rect x="4.2" y="3.6" width="15.6" height="17" rx="1.4" />
      <path d="M12 8.2v5.2M9.4 10.8h5.2" />
      <path d="M9.4 17.4h5.2" />
    </T>
  ),
  "loja-medica": (
    <T>
      <rect x="3" y="7" width="18" height="13.4" rx="1.8" />
      <path d="M9 7V5.2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7" />
      <path d="M12 11.2v5M9.5 13.7h5" />
    </T>
  ),
  petshop: (
    <T>
      <ellipse cx="7.4" cy="9.6" rx="1.9" ry="2.3" />
      <ellipse cx="12" cy="7.6" rx="1.9" ry="2.3" />
      <ellipse cx="16.6" cy="9.6" rx="1.9" ry="2.3" />
      <path d="M9 15.2c1.8-2 4.2-2 6 0 1.4 1.6.7 4-1.6 4h-2.8c-2.3 0-3-2.4-1.6-4Z" />
    </T>
  ),
  veterinaria: (
    <T>
      <path d="M6.4 3.6v5.2a4 4 0 0 0 8 0V3.6" />
      <path d="M10.4 12.8v1.8a4.4 4.4 0 0 0 4.4 4.4" />
      <circle cx="17.6" cy="17.4" r="2.4" />
      <path d="M4.8 3.6h3.2M12.8 3.6H16" />
    </T>
  ),
  racao: (
    <T>
      <path d="M9 3.6h6l-1.4 3.2h-3.2z" />
      <path d="M10.4 6.8c-3 2-4.8 5.2-4.8 8.4a5 5 0 0 0 5 5h2.8a5 5 0 0 0 5-5c0-3.2-1.8-6.4-4.8-8.4z" />
    </T>
  ),
  distribuidor: (
    <T>
      <path d="M3.4 8.4 12 4l8.6 4.4v7.2L12 20l-8.6-4.4z" />
      <path d="M3.4 8.4 12 12.8l8.6-4.4" />
      <path d="M12 12.8V20" />
    </T>
  ),

  // --- resultado da visita ---
  pedido: (
    <T>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M8 12.4l2.8 2.8 5.4-5.6" />
    </T>
  ),
  interesse: (
    <T>
      <path d="M12 3.8l2.5 5.1 5.6.8-4 4 .9 5.5-5-2.7-5 2.7.9-5.5-4-4 5.6-.8z" />
    </T>
  ),
  retorno: (
    <T>
      <path d="M20.4 12a8.4 8.4 0 1 1-2.5-6" />
      <path d="M20.4 3.6v4.8h-4.8" />
    </T>
  ),
  "sem-interesse": (
    <T>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" />
    </T>
  ),
  "sem-decisor": (
    <T>
      <circle cx="10" cy="8" r="3.2" />
      <path d="M3.4 20.4c0-3.5 2.8-5.4 6.6-5.4.8 0 1.6.1 2.3.3" />
      <path d="M15.6 15.6l4.8 4.8M20.4 15.6l-4.8 4.8" />
    </T>
  ),
  fechado: (
    <T>
      <rect x="4.8" y="10.8" width="14.4" height="9.6" rx="1.8" />
      <path d="M8.4 10.8V7.8a3.6 3.6 0 0 1 7.2 0v3" />
    </T>
  ),

  // --- ações ---
  telefone: (
    <path d="M6.4 3.6h2.8l1.5 3.9-2 1.5a11.6 11.6 0 0 0 6.3 6.3l1.5-2 3.9 1.5v2.8a1.8 1.8 0 0 1-1.8 1.8A16.8 16.8 0 0 1 4.6 5.4a1.8 1.8 0 0 1 1.8-1.8Z" />
  ),
  conversa: (
    <path d="M20.6 11.8a8.4 8.4 0 0 1-12.3 7.5L3.8 20.4l1.3-4.5A8.4 8.4 0 1 1 20.6 11.8Z" />
  ),
  navegar: <path d="M20.6 3.4 3.4 10.6l7.2 2.4 2.4 7.2z" />,
  mapa: (
    <T>
      <path d="M12 20.6s6.8-6.2 6.8-10.6a6.8 6.8 0 1 0-13.6 0C5.2 14.4 12 20.6 12 20.6Z" />
      <circle cx="12" cy="9.8" r="2.4" />
    </T>
  ),
  objetivo: (
    <T>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="0.9" />
    </T>
  ),
  check: <path d="M4.8 12.8l4.6 4.6L19.2 7.4" />,
  lixeira: (
    <T>
      <path d="M4.4 7h15.2" />
      <path d="M9.4 7V5.2a1 1 0 0 1 1-1h3.2a1 1 0 0 1 1 1V7" />
      <path d="M6.6 7l.9 12.4a1 1 0 0 0 1 .9h7a1 1 0 0 0 1-.9L17.4 7" />
    </T>
  ),
  pessoa: (
    <T>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.2 20.4c0-3.8 3-5.8 6.8-5.8s6.8 2 6.8 5.8" />
    </T>
  ),
  amostra: (
    <T>
      <rect x="3.6" y="8" width="16.8" height="12.4" rx="1.4" />
      <path d="M3.6 12.2h16.8M12 8v12.4" />
      <path d="M8.4 8a2.4 2.4 0 0 1 0-4.4c1.8 0 3.6 2.2 3.6 4.4M15.6 8a2.4 2.4 0 0 0 0-4.4C13.8 3.6 12 5.8 12 8" />
    </T>
  ),
  mais: <path d="M12 5.2v13.6M5.2 12h13.6" />,
  fechar: <path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" />,
  info: (
    <T>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11.2v5.2" />
      <circle cx="12" cy="7.9" r="0.9" fill="currentColor" stroke="none" />
    </T>
  ),
  editar: (
    <T>
      <path d="M4.4 19.6h4l11-11a1.9 1.9 0 0 0 0-2.7l-1.3-1.3a1.9 1.9 0 0 0-2.7 0l-11 11z" />
      <path d="M13.4 5.6l4 4" />
    </T>
  ),
  relogio: (
    <T>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.2V12l3.4 2.2" />
    </T>
  ),
  arrastar: <path d="M8.4 7.4h.02M8.4 12h.02M8.4 16.6h.02M15.6 7.4h.02M15.6 12h.02M15.6 16.6h.02" />,

  // --- setas ---
  "seta-esquerda": <path d="M14.4 5.6 8 12l6.4 6.4" />,
  "seta-direita": <path d="M9.6 5.6 16 12l-6.4 6.4" />,
  "seta-cima": <path d="M5.6 14.4 12 8l6.4 6.4" />,
  "seta-baixo": <path d="M5.6 9.6 12 16l6.4-6.4" />,
  "subiu": (
    <T>
      <path d="M12 19V5.6" />
      <path d="M6.4 11.2 12 5.6l5.6 5.6" />
    </T>
  ),
  "desceu": (
    <T>
      <path d="M12 5v13.4" />
      <path d="M6.4 12.8 12 18.4l5.6-5.6" />
    </T>
  ),
};

export type NomeIcone = keyof typeof GLIFOS;

export function Icone({
  nome,
  tamanho = 20,
  className,
  ...resto
}: {
  nome: NomeIcone | string;
  tamanho?: number;
} & Omit<SVGProps<SVGSVGElement>, "width" | "height" | "ref">) {
  const glifo = GLIFOS[nome];
  if (!glifo) return null;
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorativo por padrão: quem precisa de nome põe aria-label e role="img".
      aria-hidden={resto["aria-label"] ? undefined : true}
      focusable="false"
      /* O preflight do Tailwind aplica `display: block` em svg, o que joga o
         ícone para uma linha própria quando ele acompanha texto. `inline-block`
         + `align-middle` é o padrão certo; dentro de flex não muda nada, porque
         item de flex é blocado de qualquer forma. */
      className={`inline-block shrink-0 align-middle ${className ?? ""}`}
      {...resto}
    >
      {glifo}
    </svg>
  );
}
