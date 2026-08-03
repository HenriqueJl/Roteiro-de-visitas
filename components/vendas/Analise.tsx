"use client";

/**
 * Bloco de análise do /vendas (seção 6.5).
 *
 * Recebe os registros já carregados e faz as contas com as funções puras de
 * lib/analise.ts — as mesmas que o /kpi e a exportação CSV reaproveitam, para
 * que o relatório nunca discorde de si mesmo. Um único filtro de período no
 * topo governa todos os cartões.
 */

import { useMemo, useState } from "react";
import {
  PERIODOS,
  conversaoPorTipo,
  evolucaoSemanal,
  interacoesNoPeriodo,
  pedidosValidos,
  periodoDe,
  rankingClientes,
  receitaPorCidade,
  receitaPorProduto,
  receitaPorTipo,
  topObjecoes,
  totais,
} from "@/lib/analise";
import { fmtMoeda } from "@/lib/datas";
import type { Cliente, Interacao, Pedido } from "@/lib/types";
import { BarrasH, Cartao, EvolucaoSemanal } from "./graficos";

export function Analise({
  clientes,
  pedidos,
  interacoes,
}: {
  clientes: Cliente[];
  pedidos: Pedido[];
  interacoes: Interacao[];
}) {
  const [chave, setChave] = useState("30");

  const dados = useMemo(() => {
    const periodo = periodoDe(chave);
    const porId = new Map(clientes.map((c) => [c.id, c]));
    const peds = pedidosValidos(pedidos, periodo);
    const inter = interacoesNoPeriodo(interacoes, periodo);
    return {
      periodo,
      totais: totais(peds),
      produto: receitaPorProduto(peds),
      cidade: receitaPorCidade(peds, porId),
      tipo: receitaPorTipo(peds, porId),
      evolucao: evolucaoSemanal(peds, periodo),
      conversao: conversaoPorTipo(inter, porId),
      objecoes: topObjecoes(inter),
      ranking: rankingClientes(peds, porId),
    };
  }, [chave, clientes, pedidos, interacoes]);

  const fmtInt = (v: number) => String(v);
  const fmtPct = (v: number) => `${Math.round(v)}%`;

  return (
    <div className="space-y-3">
      {/* Filtro de período — governa todos os cartões abaixo. */}
      <div className="flex gap-1.5" role="tablist" aria-label="Período">
        {PERIODOS.map((p) => {
          const ativo = p.chave === chave;
          return (
            <button
              key={p.chave}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => setChave(p.chave)}
              className={`flex-1 rounded-md py-2 text-sm font-semibold ${
                ativo
                  ? "bg-marca text-white"
                  : "border border-borda bg-carta text-tinta-fraca active:bg-fundo"
              }`}
            >
              {p.rotulo}
            </button>
          );
        })}
      </div>

      {/* Cabeçalho: faturamento, nº de pedidos, ticket médio. */}
      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-borda bg-carta px-3 py-3 text-center">
          <p className="text-xs font-semibold uppercase text-tinta-fraca">Faturado</p>
          <p className="mt-0.5 text-lg font-bold leading-tight text-marca">
            {fmtMoeda(dados.totais.faturamento)}
          </p>
        </div>
        <div className="rounded-lg border border-borda bg-carta px-3 py-3 text-center">
          <p className="text-xs font-semibold uppercase text-tinta-fraca">Pedidos</p>
          <p className="mt-0.5 text-lg font-bold leading-tight">{dados.totais.pedidos}</p>
        </div>
        <div className="rounded-lg border border-borda bg-carta px-3 py-3 text-center">
          <p className="text-xs font-semibold uppercase text-tinta-fraca">Ticket</p>
          <p className="mt-0.5 text-lg font-bold leading-tight">
            {fmtMoeda(dados.totais.ticket)}
          </p>
        </div>
      </section>

      {/* No computador os cartões vão para duas colunas; no celular seguem
          empilhados. `items-start` impede que um cartão curto esticado pela
          altura do vizinho fique com metade em branco. */}
      <div className="space-y-3 md:grid md:grid-cols-2 md:items-start md:gap-3 md:space-y-0">
      {/* Top objeções — o gráfico que ele leva ao gestor (P6). Em primeiro
          lugar e com realce: é a razão de a taxonomia de objeção ser fechada. */}
      <Cartao
        titulo="O que trava a venda"
        legenda="Objeções mais registradas — leve ao gestor"
        destaque
        largo
        vazio={dados.objecoes.length === 0}
      >
        <BarrasH dados={dados.objecoes} formatar={fmtInt} />
      </Cartao>

      <Cartao
        titulo="Evolução semanal"
        legenda="Faturamento por semana"
        largo
        vazio={dados.evolucao.length === 0}
      >
        <EvolucaoSemanal dados={dados.evolucao} />
      </Cartao>

      <Cartao titulo="Receita por produto" vazio={dados.produto.length === 0}>
        <BarrasH dados={dados.produto} formatar={fmtMoeda} />
      </Cartao>

      <Cartao titulo="Receita por cidade" vazio={dados.cidade.length === 0}>
        <BarrasH dados={dados.cidade} formatar={fmtMoeda} />
      </Cartao>

      <Cartao titulo="Receita por tipo de cliente" vazio={dados.tipo.length === 0}>
        <BarrasH dados={dados.tipo} formatar={fmtMoeda} />
      </Cartao>

      <Cartao
        titulo="Taxa de conversão"
        legenda="Visitas que viraram pedido, por tipo"
        vazio={dados.conversao.length === 0}
      >
        <BarrasH
          dados={dados.conversao.map((c) => ({
            chave: c.chave,
            rotulo: c.rotulo,
            valor: c.taxa,
            detalhe: `${c.pedidos} de ${c.visitas} ${
              c.visitas === 1 ? "visita" : "visitas"
            }`,
          }))}
          formatar={fmtPct}
        />
      </Cartao>

      <Cartao
        titulo="Ranking de clientes"
        legenda="Por valor faturado no período"
        vazio={dados.ranking.length === 0}
      >
        <BarrasH
          dados={dados.ranking.map((r) => ({
            chave: r.clienteId,
            rotulo: r.nome,
            valor: r.valor,
            detalhe: `${r.cidade} · ${r.pedidos} ${
              r.pedidos === 1 ? "pedido" : "pedidos"
            }`,
          }))}
          formatar={fmtMoeda}
          limite={8}
        />
      </Cartao>
      </div>
    </div>
  );
}
