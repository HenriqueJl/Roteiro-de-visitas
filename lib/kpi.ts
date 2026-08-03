/**
 * Painel semanal (seção 6.7).
 *
 * A especificação lista oito números sob "semana corrente vs. anterior", mas
 * eles não são todos da mesma natureza — e tratá-los como se fossem produziria
 * comparação sem sentido:
 *
 * - **Fluxo** é o que aconteceu *dentro* da semana (visitas, pedidos,
 *   demonstrações). Comparar com a semana anterior informa.
 * - **Estoque** é uma foto do *agora* (amostras em teste, oportunidades
 *   abertas). É acumulado; "amostras em teste na semana passada" não é um
 *   número que ele consiga usar.
 *
 * Por isso as duas famílias saem em funções separadas e a tela só desenha a
 * variação onde ela quer dizer alguma coisa.
 *
 * As contas de faturamento reaproveitam lib/analise.ts — o /kpi e o /vendas
 * nunca devem discordar sobre quanto foi vendido.
 */

import {
  TIPOS_PRESENCIAIS,
  interacoesNoPeriodo,
  pedidosValidos,
  totais,
  type Periodo,
} from "./analise";
import { addDias, hoje, paraCivil, segundaDaSemana } from "./datas";
import type {
  Cliente,
  DataCivil,
  Instante,
  Interacao,
  Pedido,
  Tarefa,
} from "./types";

// ---------------------------------------------------------------------------
// Janelas
// ---------------------------------------------------------------------------

/**
 * A semana inteira, de segunda a domingo.
 *
 * O roteiro só prevê dias úteis, mas o KPI conta o que foi registrado — e uma
 * entrega feita no sábado é trabalho realizado. Fechar a janela na sexta
 * sumiria com ela do relatório.
 */
export function semanaDe(base: DataCivil = hoje()): Periodo {
  const segunda = segundaDaSemana(base);
  return { de: segunda, ate: addDias(segunda, 6) };
}

export function semanaAnteriorA(p: Periodo): Periodo {
  return { de: addDias(p.de, -7), ate: addDias(p.ate, -7) };
}

// ---------------------------------------------------------------------------
// Fluxo — o que aconteceu na semana
// ---------------------------------------------------------------------------

export interface Fluxo {
  visitas: number;
  /** Visitas cujo resultado foi `pedido` — numerador da conversão. */
  visitasComPedido: number;
  /** Percentual de 0 a 100. */
  conversao: number;
  pedidos: number;
  faturamento: number;
  demonstracoes: number;
  decisoresMapeados: number;
  amostrasDeixadas: number;
}

/**
 * Primeira interação de cada cliente em que um contato foi nomeado.
 *
 * É o que sustenta "decisores mapeados" como fluxo: sem isto, um hospital
 * visitado toda semana contaria um decisor novo por semana, e o indicador
 * mediria insistência em vez de avanço.
 */
function primeiroContatoNomeado(interacoes: Interacao[]): Map<string, Instante> {
  const m = new Map<string, Instante>();
  for (const i of interacoes) {
    if (!i.contatoFalado?.nome?.trim()) continue;
    const atual = m.get(i.clienteId);
    if (!atual || i.data < atual) m.set(i.clienteId, i.data);
  }
  return m;
}

/**
 * `interacoes` e `pedidos` devem chegar **completos**, não pré-filtrados: o
 * recorte por semana acontece aqui, e "decisor mapeado pela primeira vez"
 * depende de conhecer todo o histórico.
 */
export function fluxoDaSemana(
  interacoes: Interacao[],
  pedidos: Pedido[],
  p: Periodo,
): Fluxo {
  const daSemana = interacoesNoPeriodo(interacoes, p);
  const presenciais = daSemana.filter((i) => TIPOS_PRESENCIAIS.includes(i.tipo));
  const visitasComPedido = presenciais.filter((i) => i.resultado === "pedido").length;

  const t = totais(pedidosValidos(pedidos, p));

  const primeiros = primeiroContatoNomeado(interacoes);
  let decisoresMapeados = 0;
  for (const data of primeiros.values()) {
    const dia = paraCivil(new Date(data));
    if (dia >= p.de && dia <= p.ate) decisoresMapeados += 1;
  }

  return {
    visitas: presenciais.length,
    visitasComPedido,
    conversao: presenciais.length ? (visitasComPedido / presenciais.length) * 100 : 0,
    pedidos: t.pedidos,
    faturamento: t.faturamento,
    demonstracoes: daSemana.filter((i) => i.tipo === "demonstracao").length,
    decisoresMapeados,
    amostrasDeixadas: daSemana.filter((i) => i.amostraDeixada).length,
  };
}

// ---------------------------------------------------------------------------
// Estoque — a foto do agora
// ---------------------------------------------------------------------------

export interface Estoque {
  /** Amostras deixadas cuja tarefa de retorno ainda está aberta (P3). */
  amostrasEmTeste: number;
  /** Clientes ativos que já saíram de `prospect` — o pipeline vivo. */
  oportunidadesAbertas: number;
}

export function estoqueAtual(clientes: Cliente[], tarefas: Tarefa[]): Estoque {
  return {
    amostrasEmTeste: tarefas.filter(
      (t) => t.origem === "retorno_amostra" && !t.concluida,
    ).length,
    oportunidadesAbertas: clientes.filter(
      (c) => c.status === "ativo" && c.estagio !== "prospect" && c.estagio !== "perdido",
    ).length,
  };
}
