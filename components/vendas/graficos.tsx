"use client";

/**
 * Primitivas de gráfico do /vendas (seção 6.5).
 *
 * Duas famílias, por um motivo de leitura, não de gosto:
 *
 * - `BarrasH` é HTML/CSS puro. Toda análise de categoria aqui (produto, cidade,
 *   tipo, objeção, ranking) é comparação de magnitude de série única: o valor
 *   mora no comprimento da barra e vem escrito ao lado. Barra horizontal com o
 *   rótulo em cima acomoda "Precisa aprovação da CCIH" inteiro num celular
 *   estreito — coisa que o eixo Y do Recharts trunca. Menos peso, mais legível
 *   sob sol, funciona sem rede.
 * - `EvolucaoSemanal` é Recharts, porque série temporal contínua é onde a
 *   biblioteca ganha o próprio peso: eixos, interpolação e dica de foco.
 *
 * Cor única por gráfico (--color-serie). Não há paleta categórica: pintar
 * categoria nominal com rampa de valor duplicaria a informação que a barra já
 * carrega. Ver o comentário do bloco "Gráficos" em globals.css.
 */

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtCurto, fmtMoeda } from "@/lib/datas";
import type { Barra, PontoSemana } from "@/lib/analise";

/**
 * Recharts aplica `stroke`/`fill` como atributo de SVG, onde `var(--x)` não
 * resolve — então a linha usa o hex literal. Espelha os tokens de globals.css;
 * se um mudar lá, muda aqui. As barras CSS abaixo usam as utilities `bg-serie`
 * e `bg-grade`, essas sim ligadas ao token.
 */
const SERIE = "#2f6fd0";
const GRADE = "#e6e8ec";
const EIXO = "#8a93a5";

// ---------------------------------------------------------------------------
// Cartão
// ---------------------------------------------------------------------------

export function Cartao({
  titulo,
  legenda,
  vazio,
  destaque,
  largo,
  children,
}: {
  titulo: string;
  legenda?: string;
  /** Mostrado no lugar do conteúdo quando não há dado no período. */
  vazio?: boolean;
  /** Realce do cartão que vai ao gestor (Top objeções). */
  destaque?: boolean;
  /** Ocupa as duas colunas no computador — para o gráfico que pede largura. */
  largo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border bg-carta p-4 ${largo ? "md:col-span-2" : ""} ${
        destaque ? "border-marca ring-1 ring-marca/20" : "border-borda"
      }`}
    >
      <div className="mb-3">
        <h3 className="text-sm font-bold">{titulo}</h3>
        {legenda && <p className="text-xs text-tinta-fraca">{legenda}</p>}
      </div>
      {vazio ? (
        <p className="py-6 text-center text-sm text-tinta-fraca">Sem dados no período.</p>
      ) : (
        children
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Barras horizontais (magnitude, série única)
// ---------------------------------------------------------------------------

export function BarrasH({
  dados,
  formatar,
  limite = 12,
}: {
  dados: Barra[];
  /** Como escrever o valor ao lado da barra. */
  formatar: (v: number) => string;
  limite?: number;
}) {
  const visiveis = dados.slice(0, limite);
  // As séries chegam ordenadas desc; o topo define a escala.
  const max = visiveis.reduce((m, b) => Math.max(m, b.valor), 0);

  return (
    <ul className="space-y-3">
      {visiveis.map((b) => {
        const pct = max > 0 ? (b.valor / max) * 100 : 0;
        // Barra de valor > 0 nunca some: garante um filete visível.
        const largura = b.valor > 0 ? Math.max(pct, 3) : 0;
        return (
          <li key={b.chave}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 text-sm font-medium">{b.rotulo}</span>
              <span className="shrink-0 text-sm font-bold tabular-nums">
                {formatar(b.valor)}
              </span>
            </div>
            {b.detalhe && <p className="text-xs text-tinta-fraca">{b.detalhe}</p>}
            <div
              className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-grade"
              role="img"
              aria-label={`${b.rotulo}: ${formatar(b.valor)}`}
            >
              <div
                className="h-full rounded-full bg-serie"
                style={{ width: `${largura}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Evolução semanal (linha temporal — Recharts)
// ---------------------------------------------------------------------------

/** "R$ 12k" / "R$ 340" — compacto para caber no eixo estreito do celular. */
function moedaCompacta(v: number): string {
  if (v >= 1000) return `R$ ${Math.round(v / 1000)}k`;
  return `R$ ${Math.round(v)}`;
}

function DicaSemana({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PontoSemana }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-borda bg-carta px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">Semana de {fmtCurto(p.semana)}</p>
      <p className="text-marca font-bold">{fmtMoeda(p.faturamento)}</p>
      <p className="text-tinta-fraca">
        {p.pedidos} {p.pedidos === 1 ? "pedido" : "pedidos"}
      </p>
    </div>
  );
}

export function EvolucaoSemanal({ dados }: { dados: PontoSemana[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={dados} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid stroke={GRADE} vertical={false} />
        <XAxis
          dataKey="rotulo"
          tick={{ fontSize: 11, fill: EIXO }}
          tickLine={false}
          axisLine={{ stroke: GRADE }}
          minTickGap={16}
        />
        <YAxis
          width={44}
          tick={{ fontSize: 11, fill: EIXO }}
          tickLine={false}
          axisLine={false}
          tickFormatter={moedaCompacta}
        />
        <Tooltip content={<DicaSemana />} cursor={{ stroke: GRADE, strokeWidth: 2 }} />
        <Line
          type="monotone"
          dataKey="faturamento"
          stroke={SERIE}
          strokeWidth={2}
          dot={{ r: 3, fill: SERIE, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
