"use client";

/**
 * Cartões do painel semanal (seção 6.7).
 *
 * `CartaoKpi` é de fluxo e mostra a variação contra a semana anterior.
 * `CartaoAgora` é de estoque e não mostra variação nenhuma — ver o cabeçalho de
 * lib/kpi.ts para o porquê.
 *
 * A variação nunca é comunicada só por cor: vem com seta, sinal e a frase
 * "vs. semana anterior". Sob luz do sol, num celular, cor sozinha não se lê.
 */

import { fmtMoeda } from "@/lib/datas";
import { Icone } from "@/lib/icones";

export type Unidade = "numero" | "moeda" | "porcento";

function formatar(v: number, u: Unidade): string {
  if (u === "moeda") return fmtMoeda(v);
  if (u === "porcento") return `${Math.round(v)}%`;
  return String(v);
}

/** Variação: valor absoluto para número/moeda, pontos percentuais para taxa. */
function formatarDelta(d: number, u: Unidade): string {
  const sinal = d > 0 ? "+" : "−";
  const abs = Math.abs(d);
  if (u === "moeda") return `${sinal}${fmtMoeda(abs)}`;
  if (u === "porcento") return `${sinal}${Math.round(abs)} p.p.`;
  return `${sinal}${abs}`;
}

export function CartaoKpi({
  rotulo,
  valor,
  anterior,
  unidade = "numero",
  detalhe,
}: {
  rotulo: string;
  valor: number;
  anterior: number;
  unidade?: Unidade;
  detalhe?: string;
}) {
  const delta = valor - anterior;
  // Arredonda antes de comparar: 33,333% e 33,334% não são "diferentes" para
  // quem lê "33%".
  const igual = unidade === "porcento" ? Math.round(delta) === 0 : delta === 0;

  return (
    <section className="rounded-lg border border-borda bg-carta px-3 py-3">
      <p className="text-xs font-semibold uppercase leading-tight text-tinta-fraca">
        {rotulo}
      </p>
      <p className="mt-1 text-2xl font-bold leading-none">
        {formatar(valor, unidade)}
      </p>
      {detalhe && <p className="mt-0.5 text-xs text-tinta-fraca">{detalhe}</p>}
      <p
        className={`mt-1.5 text-xs font-semibold ${
          igual ? "text-tinta-fraca" : delta > 0 ? "text-ok" : "text-perigo"
        }`}
      >
        {igual ? "= igual" : (
          <>
            <Icone nome={delta > 0 ? "subiu" : "desceu"} tamanho={13} className="inline-block -mt-0.5 mr-0.5" />
            {formatarDelta(delta, unidade)}
          </>
        )}
        {/* O cabeçalho da tela já nomeia as duas semanas comparadas; repetir
            "vs. semana anterior" em sete cartões quebrava a linha e desalinhava
            as alturas. Continua dito para quem usa leitor de tela. */}
        <span className="sr-only"> em relação à semana anterior</span>
      </p>
    </section>
  );
}

export function CartaoAgora({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: number;
  detalhe?: string;
}) {
  return (
    <section className="rounded-lg border border-borda bg-carta px-3 py-3">
      <p className="text-xs font-semibold uppercase leading-tight text-tinta-fraca">
        {rotulo}
      </p>
      <p className="mt-1 text-2xl font-bold leading-none">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-tinta-fraca">{detalhe}</p>}
    </section>
  );
}
