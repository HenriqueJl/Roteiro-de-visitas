/**
 * Sugestões de próximo passo (etapa 3 do registro — seção 6.2).
 *
 * A ordem importa: a primeira sugestão é a mais provável, porque ela vira o
 * caminho de um toque. Específicas do resultado vêm antes das do estágio.
 */

import type { Cliente, Estagio, ResultadoInteracao } from "./types";

const POR_RESULTADO: Partial<Record<ResultadoInteracao, string[]>> = {
  pedido: ["Acompanhar entrega e combinar reposição"],
  retorno_agendado: ["Voltar como combinado"],
  nao_encontrou_decisor: ["Voltar no horário do decisor", "Descobrir quando o decisor está"],
  estabelecimento_fechado: ["Voltar em outro horário"],
};

const INSTITUCIONAL: Partial<Record<Estagio, string[]>> = {
  prospect: ["Descobrir quem cuida do PGRSS", "Agendar demo do SSI com a enfermagem"],
  mapeado: ["Agendar demonstração com o decisor", "Ligar para confirmar interesse"],
  demo_agendada: ["Realizar a demonstração marcada"],
  demo_realizada: ["Deixar amostra para a equipe testar", "Pedir aval da CCIH"],
  amostra_em_teste: ["Colher o resultado do teste", "Levar proposta"],
  proposta: ["Cobrar resposta da proposta", "Negociar condição com compras"],
  cliente: ["Acompanhar o primeiro uso", "Apresentar a linha Cápsula-Bag"],
};

const VAREJO: Partial<Record<Estagio, string[]>> = {
  prospect: ["Voltar para falar com o dono", "Apresentar com material de balcão"],
  visitado: ["Deixar unidades para teste de giro", "Voltar para falar com o dono"],
  material_deixado: ["Conferir o giro do material deixado", "Fechar o primeiro pedido"],
  primeiro_pedido: ["Ligar na janela de recompra", "Sugerir reposição"],
  recompra: ["Manter a cadência de reposição", "Oferecer o saco de 1kg"],
};

export function sugestoesProximoPasso(
  cliente: Cliente,
  resultado: ResultadoInteracao | null,
): string[] {
  const porEstagio = cliente.funil === "institucional" ? INSTITUCIONAL : VAREJO;
  const lista = [
    ...(resultado ? (POR_RESULTADO[resultado] ?? []) : []),
    ...(porEstagio[cliente.estagio] ?? []),
  ];
  return [...new Set(lista)].slice(0, 4);
}
