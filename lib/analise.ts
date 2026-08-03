/**
 * Agregações de vendas e de funil (seção 6.5).
 *
 * Funções puras sobre os registros já carregados. Ficam separadas da tela
 * porque o /kpi da etapa 12 e a exportação CSV reaproveitam as mesmas contas —
 * dois lugares calculando faturamento do próprio jeito é como relatório passa
 * a discordar de si mesmo.
 */

import { diffDias, hoje, paraCivil, segundaDaSemana } from "./datas";
import {
  LABEL_OBJECAO,
  LABEL_PRODUTO,
  LABEL_TIPO_CLIENTE_CURTO,
  valorItem,
  type Cliente,
  type DataCivil,
  type Interacao,
  type Objecao,
  type Pedido,
} from "./types";

export interface Periodo {
  de: DataCivil;
  ate: DataCivil;
}

export const PERIODOS: { chave: string; rotulo: string; dias: number | null }[] = [
  { chave: "7", rotulo: "7 dias", dias: 7 },
  { chave: "30", rotulo: "30 dias", dias: 30 },
  { chave: "90", rotulo: "90 dias", dias: 90 },
  { chave: "tudo", rotulo: "Tudo", dias: null },
];

export function periodoDe(chave: string, base: DataCivil = hoje()): Periodo {
  const def = PERIODOS.find((p) => p.chave === chave) ?? PERIODOS[1];
  if (def.dias === null) return { de: "0000-01-01", ate: base };
  const d = new Date(
    new Date(base).getTime() - (def.dias - 1) * 86_400_000,
  );
  return { de: paraCivil(d), ate: base };
}

const dentro = (d: DataCivil, p: Periodo) => d >= p.de && d <= p.ate;

/** Pedido cancelado não é receita. Filtro aplicado uma vez, aqui. */
export function pedidosValidos(pedidos: Pedido[], p: Periodo): Pedido[] {
  return pedidos.filter((x) => x.status !== "cancelado" && dentro(x.data, p));
}

export function interacoesNoPeriodo(interacoes: Interacao[], p: Periodo): Interacao[] {
  return interacoes.filter((i) => dentro(paraCivil(new Date(i.data)), p));
}

// ---------------------------------------------------------------------------
// Cabeçalho
// ---------------------------------------------------------------------------

export interface Totais {
  faturamento: number;
  pedidos: number;
  ticket: number;
}

export function totais(pedidos: Pedido[]): Totais {
  const faturamento = pedidos.reduce((s, p) => s + p.valorTotal, 0);
  return {
    faturamento,
    pedidos: pedidos.length,
    ticket: pedidos.length ? faturamento / pedidos.length : 0,
  };
}

// ---------------------------------------------------------------------------
// Séries para os gráficos
// ---------------------------------------------------------------------------

export interface Barra {
  chave: string;
  rotulo: string;
  valor: number;
  /** Texto auxiliar da dica — nunca é a única via de leitura do valor. */
  detalhe?: string;
}

const ordenarDesc = (a: Barra, b: Barra) => b.valor - a.valor;

export function receitaPorProduto(pedidos: Pedido[]): Barra[] {
  const acc = new Map<string, number>();
  for (const p of pedidos) {
    for (const item of p.itens) {
      acc.set(item.produto, (acc.get(item.produto) ?? 0) + valorItem(item));
    }
  }
  return [...acc.entries()]
    .map(([chave, valor]) => ({
      chave,
      rotulo: LABEL_PRODUTO[chave as keyof typeof LABEL_PRODUTO] ?? chave,
      valor: Math.round(valor * 100) / 100,
    }))
    .sort(ordenarDesc);
}

export function receitaPorCidade(pedidos: Pedido[], clientes: Map<string, Cliente>): Barra[] {
  const acc = new Map<string, number>();
  for (const p of pedidos) {
    const cidade = clientes.get(p.clienteId)?.cidade ?? "—";
    acc.set(cidade, (acc.get(cidade) ?? 0) + p.valorTotal);
  }
  return [...acc.entries()]
    .map(([chave, valor]) => ({ chave, rotulo: chave, valor }))
    .sort(ordenarDesc);
}

export function receitaPorTipo(pedidos: Pedido[], clientes: Map<string, Cliente>): Barra[] {
  const acc = new Map<string, number>();
  for (const p of pedidos) {
    const tipo = clientes.get(p.clienteId)?.tipo;
    if (!tipo) continue;
    acc.set(tipo, (acc.get(tipo) ?? 0) + p.valorTotal);
  }
  return [...acc.entries()]
    .map(([chave, valor]) => ({
      chave,
      rotulo: LABEL_TIPO_CLIENTE_CURTO[chave as keyof typeof LABEL_TIPO_CLIENTE_CURTO] ?? chave,
      valor,
    }))
    .sort(ordenarDesc);
}

export interface PontoSemana {
  semana: DataCivil;
  rotulo: string;
  faturamento: number;
  pedidos: number;
}

/** Evolução semanal, com as semanas sem venda preenchidas com zero. */
export function evolucaoSemanal(pedidos: Pedido[], p: Periodo): PontoSemana[] {
  if (pedidos.length === 0) return [];

  const acc = new Map<DataCivil, { faturamento: number; pedidos: number }>();
  for (const pedido of pedidos) {
    const seg = segundaDaSemana(pedido.data);
    const atual = acc.get(seg) ?? { faturamento: 0, pedidos: 0 };
    atual.faturamento += pedido.valorTotal;
    atual.pedidos += 1;
    acc.set(seg, atual);
  }

  const inicio = segundaDaSemana(
    p.de === "0000-01-01" ? [...acc.keys()].sort()[0] : p.de,
  );
  const fim = segundaDaSemana(p.ate);
  const pontos: PontoSemana[] = [];
  for (let d = inicio; d <= fim; ) {
    const v = acc.get(d) ?? { faturamento: 0, pedidos: 0 };
    pontos.push({
      semana: d,
      rotulo: `${d.slice(8, 10)}/${d.slice(5, 7)}`,
      faturamento: Math.round(v.faturamento * 100) / 100,
      pedidos: v.pedidos,
    });
    const prox = new Date(d);
    prox.setDate(prox.getDate() + 7);
    d = paraCivil(prox);
  }
  return pontos;
}

// ---------------------------------------------------------------------------
// Conversão e objeções
// ---------------------------------------------------------------------------

export interface Conversao {
  chave: string;
  rotulo: string;
  visitas: number;
  pedidos: number;
  taxa: number;
}

/**
 * Visitas → pedidos por tipo de cliente.
 *
 * Conta a interação com resultado `pedido`, não a tabela de pedidos: o que se
 * quer medir é quantas visitas viraram venda, e um pedido lançado por telefone
 * dias depois não diz nada sobre a eficácia da visita.
 */
export function conversaoPorTipo(
  interacoes: Interacao[],
  clientes: Map<string, Cliente>,
): Conversao[] {
  const acc = new Map<string, { visitas: number; pedidos: number }>();
  for (const i of interacoes) {
    if (!["visita", "demonstracao", "entrega"].includes(i.tipo)) continue;
    const tipo = clientes.get(i.clienteId)?.tipo;
    if (!tipo) continue;
    const atual = acc.get(tipo) ?? { visitas: 0, pedidos: 0 };
    atual.visitas += 1;
    if (i.resultado === "pedido") atual.pedidos += 1;
    acc.set(tipo, atual);
  }
  return [...acc.entries()]
    .map(([chave, v]) => ({
      chave,
      rotulo: LABEL_TIPO_CLIENTE_CURTO[chave as keyof typeof LABEL_TIPO_CLIENTE_CURTO] ?? chave,
      visitas: v.visitas,
      pedidos: v.pedidos,
      taxa: v.visitas ? (v.pedidos / v.visitas) * 100 : 0,
    }))
    .sort((a, b) => b.taxa - a.taxa);
}

/** O gráfico que ele leva ao gestor: o que realmente trava a venda (P6). */
export function topObjecoes(interacoes: Interacao[]): Barra[] {
  const acc = new Map<Objecao, number>();
  for (const i of interacoes) {
    if (!i.objecao) continue;
    acc.set(i.objecao, (acc.get(i.objecao) ?? 0) + 1);
  }
  return [...acc.entries()]
    .map(([chave, valor]) => ({ chave, rotulo: LABEL_OBJECAO[chave], valor }))
    .sort(ordenarDesc);
}

export interface LinhaRanking {
  clienteId: string;
  nome: string;
  cidade: string;
  pedidos: number;
  valor: number;
}

export function rankingClientes(
  pedidos: Pedido[],
  clientes: Map<string, Cliente>,
): LinhaRanking[] {
  const acc = new Map<string, { pedidos: number; valor: number }>();
  for (const p of pedidos) {
    const atual = acc.get(p.clienteId) ?? { pedidos: 0, valor: 0 };
    atual.pedidos += 1;
    atual.valor += p.valorTotal;
    acc.set(p.clienteId, atual);
  }
  return [...acc.entries()]
    .map(([clienteId, v]) => ({
      clienteId,
      nome: clientes.get(clienteId)?.nome ?? "Cliente removido",
      cidade: clientes.get(clienteId)?.cidade ?? "—",
      ...v,
    }))
    .sort((a, b) => b.valor - a.valor);
}

// ---------------------------------------------------------------------------
// Funil (usado também pelo /kpi da etapa 12)
// ---------------------------------------------------------------------------

export function clientesSemContato(clientes: Cliente[], dias: number): Cliente[] {
  const h = hoje();
  return clientes.filter(
    (c) =>
      c.status === "ativo" &&
      (!c.ultimoContatoEm || diffDias(paraCivil(new Date(c.ultimoContatoEm)), h) > dias),
  );
}
