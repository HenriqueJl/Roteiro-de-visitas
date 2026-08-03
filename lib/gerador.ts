/**
 * Motor de geração de semana (seção 7).
 *
 * Função pura: recebe o estado, devolve os roteiros. Não toca no banco — quem
 * persiste é `gerarProximaSemana` em db.ts. Isso existe para que as regras
 * possam ser conferidas isoladamente, que é o mínimo para uma peça com esta
 * densidade de regra de negócio.
 *
 * As regras, na ordem em que mandam:
 *   1. Um dia = uma cidade. Nunca alternar no mesmo dia.
 *   2. Compromissos (amostra vencendo, próximo passo agendado) entram sempre.
 *   3. O resto da vaga segue 60% follow-up / 40% prospecção nova.
 *   4. Máximo de paradas por dia; sexta só de manhã.
 *   5. Dentro do dia, ordem por proximidade (vizinho mais próximo).
 */

import { addDias, diasUteisDaSemana, diffDias, paraCivil } from "./datas";
import { ordenarPorProximidade } from "./geo";
import {
  ESTAGIOS_QUENTES,
  type Cliente,
  type Config,
  type DataCivil,
  type DiaSemana,
  type ParadaRoteiro,
  type Roteiro,
  type Tarefa,
} from "./types";

/** Por que este cliente entrou na rota. Vira o objetivo da parada. */
export type Motivo =
  | "retorno_amostra"
  | "proximo_passo"
  | "quente_parado"
  | "janela_recompra"
  | "prospeccao";

export const LABEL_MOTIVO: Record<Motivo, string> = {
  retorno_amostra: "Retorno de amostra",
  proximo_passo: "Próximo passo agendado",
  quente_parado: "Pipeline quente parado",
  janela_recompra: "Janela de recompra",
  prospeccao: "Prospecção nova",
};

/** Compromissos assumidos — entram na rota mesmo que estourem a cota 60/40. */
const COMPROMISSOS: readonly Motivo[] = ["retorno_amostra", "proximo_passo"];

export interface Candidato {
  cliente: Cliente;
  motivo: Motivo;
  /** Menor = mais urgente. Ordena dentro do mesmo motivo. */
  urgencia: number;
  objetivo: string;
}

export interface EntradaGeracao {
  semana: number;
  segunda: DataCivil;
  clientes: Cliente[];
  /** Apenas tarefas em aberto. */
  tarefas: Tarefa[];
  /** Clientes já agendados em qualquer roteiro — não repete. */
  jaAgendados: ReadonlySet<string>;
  config: Config;
}

export interface ResultadoGeracao {
  roteiros: Roteiro[];
  /** Candidatos que não couberam na semana. A tela avisa (seção 7). */
  sobra: Candidato[];
  resumo: {
    capacidade: number;
    compromissos: number;
    followUp: number;
    novos: number;
    porCidade: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// Horários
// ---------------------------------------------------------------------------

const SLOTS_DIA_CHEIO = ["09:00", "09:45", "10:30", "11:15", "14:00", "15:00", "16:00"];
const SLOTS_MEIO_DIA = ["08:30", "09:15", "10:00", "10:45"];

// ---------------------------------------------------------------------------
// Seleção de candidatos
// ---------------------------------------------------------------------------

function objetivoDe(motivo: Motivo, cliente: Cliente, tarefa?: Tarefa): string {
  switch (motivo) {
    case "retorno_amostra":
      return tarefa?.titulo ?? "Cobrar o resultado da amostra deixada";
    case "proximo_passo":
      return tarefa?.titulo ?? "Executar o próximo passo combinado";
    case "quente_parado":
      return cliente.funil === "institucional"
        ? "Retomar: pipeline parado, destravar a decisão"
        : "Retomar: fechar o primeiro pedido";
    case "janela_recompra":
      return "Janela de recompra — conferir giro e repor";
    case "prospeccao":
      return cliente.funil === "institucional"
        ? "Primeira visita: demo do SSI e mapear decisor"
        : "Primeira visita: apresentar e deixar material";
  }
}

/**
 * Monta a lista de candidatos na ordem de prioridade da seção 7.
 * `referencia` é a segunda-feira da semana alvo: a antiguidade do contato é
 * medida contra o dia da visita, não contra hoje.
 */
export function selecionarCandidatos(entrada: EntradaGeracao): Candidato[] {
  const { clientes, tarefas, jaAgendados, config, segunda } = entrada;
  const fimDaSemana = addDias(segunda, 4);
  const porId = new Map(clientes.map((c) => [c.id, c]));

  const escolhidos = new Map<string, Candidato>();
  const podeEntrar = (c: Cliente | undefined): c is Cliente =>
    !!c && c.status === "ativo" && !jaAgendados.has(c.id) && !escolhidos.has(c.id);

  const diasParado = (c: Cliente) =>
    c.ultimoContatoEm ? diffDias(paraCivil(new Date(c.ultimoContatoEm)), segunda) : 9999;

  // 1 — retorno de amostra vencendo na semana (ou já vencido)
  for (const t of tarefas
    .filter((t) => t.origem === "retorno_amostra" && t.vencimentoEm <= fimDaSemana)
    .sort((a, b) => a.vencimentoEm.localeCompare(b.vencimentoEm))) {
    const c = porId.get(t.clienteId ?? "");
    if (!podeEntrar(c)) continue;
    escolhidos.set(c.id, {
      cliente: c,
      motivo: "retorno_amostra",
      urgencia: diffDias(segunda, t.vencimentoEm),
      objetivo: objetivoDe("retorno_amostra", c, t),
    });
  }

  // 2 — próximos passos agendados para a semana
  for (const t of tarefas
    .filter((t) => t.origem !== "retorno_amostra" && t.vencimentoEm <= fimDaSemana)
    .sort((a, b) => a.vencimentoEm.localeCompare(b.vencimentoEm))) {
    const c = porId.get(t.clienteId ?? "");
    if (!podeEntrar(c)) continue;
    escolhidos.set(c.id, {
      cliente: c,
      motivo: "proximo_passo",
      urgencia: diffDias(segunda, t.vencimentoEm),
      objetivo: objetivoDe("proximo_passo", c, t),
    });
  }

  // 3 — pipeline quente parado há mais de 14 dias
  for (const c of clientes
    .filter((c) => ESTAGIOS_QUENTES.includes(c.estagio) && diasParado(c) > 14)
    .sort((a, b) => diasParado(b) - diasParado(a))) {
    if (!podeEntrar(c)) continue;
    escolhidos.set(c.id, {
      cliente: c,
      motivo: "quente_parado",
      urgencia: -diasParado(c),
      objetivo: objetivoDe("quente_parado", c),
    });
  }

  // 4 — primeiro pedido parado além da janela de recompra
  for (const c of clientes
    .filter((c) => c.estagio === "primeiro_pedido" && diasParado(c) > config.diasSemContatoAlerta)
    .sort((a, b) => diasParado(b) - diasParado(a))) {
    if (!podeEntrar(c)) continue;
    escolhidos.set(c.id, {
      cliente: c,
      motivo: "janela_recompra",
      urgencia: -diasParado(c),
      objetivo: objetivoDe("janela_recompra", c),
    });
  }

  // 5 — prospect nunca visitado, ordenado por proximidade geográfica.
  //
  // A ordem importa porque a cota de prospecção corta o fim da lista: quem
  // sobra tem de ser o ponto distante e isolado, não quem calhou de vir antes
  // no cadastro. O encadeamento é feito dentro de cada cidade — comparar
  // distância entre cidades diferentes não significa nada aqui, já que um dia
  // nunca mistura as duas.
  const prospects = clientes.filter(
    (c) => c.estagio === "prospect" && !c.ultimoContatoEm && podeEntrar(c),
  );

  const filas = new Map<string, Cliente[]>();
  for (const c of prospects) {
    const lista = filas.get(c.cidade) ?? [];
    lista.push(c);
    filas.set(c.cidade, lista);
  }
  for (const [cidade, lista] of filas) {
    const comGps = lista.filter((c) => c.lat != null && c.lng != null);
    const semGps = lista.filter((c) => c.lat == null || c.lng == null);
    filas.set(cidade, [
      ...ordenarPorProximidade(
        comGps.map((c) => ({ cliente: c, lat: c.lat!, lng: c.lng! })),
      ).map((x) => x.cliente),
      ...semGps,
    ]);
  }

  // Intercala sempre puxando da cidade com mais gente esperando: a cota fica
  // proporcional à oportunidade de cada praça em vez de esvaziar uma delas.
  while ([...filas.values()].some((l) => l.length > 0)) {
    const maior = [...filas.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    const c = maior[1].shift();
    if (!c) break;
    escolhidos.set(c.id, {
      cliente: c,
      motivo: "prospeccao",
      urgencia: 0,
      objetivo: objetivoDe("prospeccao", c),
    });
  }

  return [...escolhidos.values()];
}

// ---------------------------------------------------------------------------
// Composição 60/40
// ---------------------------------------------------------------------------

/**
 * Aplica a cota da seção 7 sobre a capacidade da semana.
 *
 * Compromissos (amostra e próximo passo) nunca são cortados: têm data marcada,
 * e furar isso é exatamente o apodrecimento que P2 e P3 existem para impedir.
 * A cota governa o que sobra — e, se faltar candidato de um lado, o outro
 * ocupa a vaga em vez de deixar o dia vazio.
 */
export function comporSemana(
  candidatos: Candidato[],
  capacidade: number,
  percentualFollowUp: number,
  primeiraSemana: boolean,
): { escolhidos: Candidato[]; sobra: Candidato[] } {
  const compromissos = candidatos.filter((c) => COMPROMISSOS.includes(c.motivo));
  const followUp = candidatos.filter(
    (c) => !COMPROMISSOS.includes(c.motivo) && c.motivo !== "prospeccao",
  );
  const novos = candidatos.filter((c) => c.motivo === "prospeccao");

  const escolhidos = compromissos.slice(0, capacidade);
  let resta = capacidade - escolhidos.length;

  if (primeiraSemana) {
    // Sem histórico, não há follow-up: a semana é toda prospecção.
    escolhidos.push(...novos.slice(0, resta));
  } else {
    const alvoFollow = Math.max(
      0,
      Math.round((capacidade * percentualFollowUp) / 100) - escolhidos.length,
    );
    const doFollow = followUp.slice(0, Math.min(alvoFollow, resta));
    escolhidos.push(...doFollow);
    resta -= doFollow.length;

    const doNovo = novos.slice(0, resta);
    escolhidos.push(...doNovo);
    resta -= doNovo.length;

    // Sobrou vaga porque faltou prospect? Puxa mais follow-up, e vice-versa.
    if (resta > 0) escolhidos.push(...followUp.slice(doFollow.length, doFollow.length + resta));
  }

  const dentro = new Set(escolhidos.map((c) => c.cliente.id));
  return { escolhidos, sobra: candidatos.filter((c) => !dentro.has(c.cliente.id)) };
}

// ---------------------------------------------------------------------------
// Distribuição em dias
// ---------------------------------------------------------------------------

/**
 * Quantas paradas cabem em cada dia útil. Sexta é meio dia: a tarde é
 * reservada para follow-up telefônico e consolidação (seção 7).
 */
export function capacidadePorDia(max: number): number[] {
  const meia = Math.max(1, Math.ceil(max / 2));
  return [max, max, max, max, meia];
}

/**
 * Decide a cidade de cada dia da semana. Um dia, uma cidade.
 *
 * A base fica na sexta: como a tarde é de telefone e consolidação, faz sentido
 * terminar a semana perto de casa em vez de voltando de outra cidade.
 */
export function distribuirCidades(
  demanda: Map<string, number>,
  capacidades: number[],
  cidadeBase: string,
): string[] {
  // Guloso por demanda ainda não atendida: cada dia vai para a cidade que tem
  // mais gente esperando. Casar dia com demanda importa mais que uma divisão
  // proporcional bonita — repartir por porcentagem deixa dia de 6 vagas com
  // uma parada só, e é vaga que ele não recupera na semana.
  const restante = new Map([...demanda.entries()].filter(([, n]) => n > 0));
  const sequencia: string[] = [];

  for (let i = 0; i < capacidades.length; i++) {
    const comDemanda = [...restante.entries()].filter(([, n]) => n > 0);
    if (comDemanda.length === 0) break;

    // No último dia, preferimos a base: a tarde de sexta é de telefone e
    // consolidação, e faz pouco sentido passá-la voltando de outra cidade.
    // É preferência, não imposição — trocar dias já alocados custaria vaga.
    const ultimoDia = i === capacidades.length - 1;
    const base = comDemanda.find(([c]) => c === cidadeBase);
    const alvo =
      ultimoDia && base ? base : comDemanda.sort((a, b) => b[1] - a[1])[0];

    sequencia.push(alvo[0]);
    restante.set(alvo[0], alvo[1] - capacidades[i]);
  }
  return sequencia;
}

// ---------------------------------------------------------------------------
// Geração
// ---------------------------------------------------------------------------

export function gerarSemana(entrada: EntradaGeracao): ResultadoGeracao {
  const { semana, segunda, config } = entrada;
  const capacidades = capacidadePorDia(config.maxParadasPorDia);
  const capacidadeTotal = capacidades.reduce((a, b) => a + b, 0);

  const candidatos = selecionarCandidatos(entrada);

  // A cota 60/40 é da SEMANA, não da cidade: aplicá-la por praça faz a
  // proporção global desabar sempre que os follow-ups estão concentrados em
  // uma delas, que é justamente o caso comum aqui.
  const { escolhidos: selecionados, sobra: forasDaCota } = comporSemana(
    candidatos,
    capacidadeTotal,
    config.percentualFollowUp,
    semana === 1,
  );

  const demanda = new Map<string, number>();
  for (const c of selecionados) {
    demanda.set(c.cliente.cidade, (demanda.get(c.cliente.cidade) ?? 0) + 1);
  }
  const cidadePorDia = distribuirCidades(demanda, capacidades, config.cidadeBase);

  const capPorCidade = new Map<string, number>();
  cidadePorDia.forEach((cidade, i) => {
    capPorCidade.set(cidade, (capPorCidade.get(cidade) ?? 0) + capacidades[i]);
  });

  // Monta a fila de cada cidade: primeiro o que a cota escolheu, depois — só
  // se ainda sobrar vaga naquela praça — quem a cota tinha deixado de fora.
  // Vaga vazia num dia é vaga que ele não recupera; preenchê-la com o próximo
  // da fila da mesma cidade custa nada e não fere a regra de uma cidade/dia.
  const porCidade = new Map<string, Candidato[]>();
  for (const [cidade, capacidade] of capPorCidade) {
    const doTopo = selecionados
      .filter((c) => c.cliente.cidade === cidade)
      .sort((a, b) => a.urgencia - b.urgencia);
    const reserva = forasDaCota.filter((c) => c.cliente.cidade === cidade);
    porCidade.set(cidade, [...doTopo, ...reserva].slice(0, capacidade));
  }

  const datas = diasUteisDaSemana(segunda);
  const roteiros: Roteiro[] = [];

  for (let i = 0; i < datas.length; i++) {
    const cidade = cidadePorDia[i];
    if (!cidade) continue;
    const fila = porCidade.get(cidade) ?? [];
    const doDia = fila.splice(0, capacidades[i]);
    if (doDia.length === 0) continue;

    // Ordem por proximidade. Quem não tem GPS não participa e vai para o fim.
    const comGps = doDia.filter((c) => c.cliente.lat != null && c.cliente.lng != null);
    const semGps = doDia.filter((c) => c.cliente.lat == null || c.cliente.lng == null);
    const ordenados = [
      ...ordenarPorProximidade(
        comGps.map((c) => ({ ...c, lat: c.cliente.lat!, lng: c.cliente.lng! })),
      ),
      ...semGps,
    ];

    const sexta = i === 4;
    const slots = sexta ? SLOTS_MEIO_DIA : SLOTS_DIA_CHEIO;
    const paradas: ParadaRoteiro[] = ordenados.map((c, k) => ({
      ordem: k + 1,
      clienteId: c.cliente.id,
      horarioSugerido: slots[k] ?? "",
      objetivo: c.objetivo,
      concluida: false,
    }));

    const motivos = new Set(ordenados.map((c) => c.motivo));
    roteiros.push({
      id: `r-s${semana}-d${i + 1}`,
      semana,
      diaSemana: (i + 1) as DiaSemana,
      data: datas[i],
      cidade,
      titulo: tituloDoDia(motivos),
      paradas,
      tardeLivre: sexta,
      observacao: sexta
        ? "Tarde reservada para follow-up telefônico e consolidação."
        : undefined,
    });
  }

  // O resumo e a sobra contam o que foi de fato agendado, não o que foi cogitado.
  const agendados = new Set(roteiros.flatMap((r) => r.paradas.map((p) => p.clienteId)));
  const colocados = candidatos.filter((c) => agendados.has(c.cliente.id));
  const sobra = candidatos.filter((c) => !agendados.has(c.cliente.id));
  const contar = (m: (c: Candidato) => boolean) => colocados.filter(m).length;

  const porCidadeAgendados: Record<string, number> = {};
  for (const r of roteiros) {
    porCidadeAgendados[r.cidade] = (porCidadeAgendados[r.cidade] ?? 0) + r.paradas.length;
  }

  return {
    roteiros,
    sobra,
    resumo: {
      capacidade: capacidadeTotal,
      compromissos: contar((c) => COMPROMISSOS.includes(c.motivo)),
      followUp: contar((c) => !COMPROMISSOS.includes(c.motivo) && c.motivo !== "prospeccao"),
      novos: contar((c) => c.motivo === "prospeccao"),
      porCidade: porCidadeAgendados,
    },
  };
}

function tituloDoDia(motivos: Set<Motivo>): string {
  const temNovo = motivos.has("prospeccao");
  const temFollow = [...motivos].some((m) => m !== "prospeccao");
  if (temNovo && temFollow) return "Follow-up e prospecção";
  if (temNovo) return "Prospecção";
  // Só follow-up: se o dia inteiro é de um motivo só, o rótulo específico
  // informa mais ("Retorno de amostra" diz o que fazer; "Follow-up" não).
  return motivos.size === 1 ? LABEL_MOTIVO[[...motivos][0]] : "Follow-up";
}
