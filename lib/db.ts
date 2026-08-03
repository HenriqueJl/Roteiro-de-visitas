/**
 * Campo — camada de persistência (Dexie sobre IndexedDB).
 *
 * Duas decisões que valem explicação:
 *
 * 1. Booleanos não são indexados. IndexedDB não aceita `boolean` como chave de
 *    índice; o contorno usual é gravar 0/1, o que suja o modelo inteiro. Como o
 *    volume aqui é de centenas de registros (um vendedor, um dispositivo),
 *    indexamos a data e filtramos o booleano em memória. Custo irrelevante,
 *    tipos honestos.
 *
 * 2. P2 e P3 moram aqui, não na UI. `registrarInteracao` recusa a escrita sem
 *    próximo passo e cria a tarefa de retorno de amostra na mesma transação.
 *    A tela apenas antecipa a validação para desabilitar o botão — se algum
 *    caminho novo escapar da tela, o banco continua recusando.
 */

import Dexie, { type Table } from "dexie";
import { addDias, agora, hoje, paraCivil, segundaDaSemana } from "./datas";
import { gerarSemana, type ResultadoGeracao } from "./gerador";
import {
  CONFIG_PADRAO,
  LABEL_PRODUTO,
  funilDoTipo,
  ordemDoEstagio,
  valorPedido,
  type Cliente,
  type Config,
  type Estagio,
  type Interacao,
  type Meta,
  type Nota,
  type ParadaRoteiro,
  type Pedido,
  type Roteiro,
  type Tarefa,
} from "./types";

export class CampoDB extends Dexie {
  clientes!: Table<Cliente, string>;
  interacoes!: Table<Interacao, string>;
  pedidos!: Table<Pedido, string>;
  notas!: Table<Nota, string>;
  tarefas!: Table<Tarefa, string>;
  roteiros!: Table<Roteiro, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super("campo");
    this.version(1).stores({
      clientes:
        "id, nome, tipo, cidade, funil, estagio, status, ultimoContatoEm, proximoContatoEm, *tags",
      interacoes: "id, clienteId, data, tipo, resultado, objecao, proximoPassoEm",
      pedidos: "id, clienteId, data, status",
      notas: "id, clienteId, criadoEm, *tags",
      tarefas: "id, clienteId, vencimentoEm, origem, interacaoId",
      roteiros: "id, semana, data, cidade, [semana+diaSemana]",
      meta: "chave",
    });
  }
}

export const db = new CampoDB();

/** IndexedDB não existe durante o build/SSR. Nada deve tocar o banco lá. */
export const temIndexedDB = (): boolean => typeof indexedDB !== "undefined";

export function novoId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CHAVE_CONFIG = "config";

export async function lerConfig(): Promise<Config> {
  const linha = await db.meta.get(CHAVE_CONFIG);
  return { ...CONFIG_PADRAO, ...((linha?.valor as Partial<Config>) ?? {}) };
}

export async function salvarConfig(patch: Partial<Config>): Promise<Config> {
  const atual = await lerConfig();
  const novo = { ...atual, ...patch };
  await db.meta.put({ chave: CHAVE_CONFIG, valor: novo });
  return novo;
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export type NovoCliente = Omit<
  Cliente,
  "id" | "funil" | "criadoEm" | "estagio" | "status" | "produtosInteresse" | "tags" | "observacoes"
> &
  Partial<Pick<Cliente, "id" | "estagio" | "status" | "produtosInteresse" | "tags" | "observacoes">>;

export async function criarCliente(entrada: NovoCliente): Promise<Cliente> {
  const cliente: Cliente = {
    produtosInteresse: [],
    tags: [],
    observacoes: "",
    estagio: "prospect",
    status: "ativo",
    ...entrada,
    id: entrada.id ?? novoId(),
    funil: funilDoTipo(entrada.tipo),
    criadoEm: agora(),
  };
  await db.clientes.add(cliente);
  return cliente;
}

export async function atualizarCliente(
  id: string,
  patch: Partial<Cliente>,
): Promise<void> {
  // O funil nunca é digitado: se o tipo muda, ele é recalculado junto — e se o
  // estágio atual não existir no funil novo, volta para prospect em vez de
  // ficar órfão (ex.: hospital em "demo_realizada" virando petshop).
  let ajuste = patch;
  if (patch.tipo) {
    const funil = funilDoTipo(patch.tipo);
    ajuste = { ...patch, funil };
    const atual = await db.clientes.get(id);
    const estagio = patch.estagio ?? atual?.estagio;
    if (estagio && ordemDoEstagio(funil, estagio) === -1) {
      ajuste.estagio = "prospect";
    }
  }
  await db.clientes.update(id, ajuste);
}

// ---------------------------------------------------------------------------
// P2 — validação de interação
// ---------------------------------------------------------------------------

export type NovaInteracao = Omit<Interacao, "id" | "data" | "produtosApresentados"> &
  Partial<Pick<Interacao, "id" | "data" | "produtosApresentados">>;

/**
 * Retorna a mensagem de erro, ou `null` se a interação pode ser salva.
 * A UI usa isto para desabilitar o botão; `registrarInteracao` usa como trava.
 */
export function validarInteracao(i: Partial<NovaInteracao>): string | null {
  if (!i.clienteId) return "Interação sem cliente.";
  if (!i.resultado) return "Escolha como foi.";

  if (i.amostraDeixada) {
    const a = i.amostraDeixada;
    if (!a.produto) return "Escolha o produto da amostra.";
    if (!a.qtd || a.qtd < 1) return "Informe a quantidade da amostra.";
    if (!a.retornoEm) return "Informe a data de retorno da amostra.";
  }

  // Único escape de P2: encerrar o cliente, com motivo.
  if (i.encerramento) {
    if (!i.encerramento.motivo?.trim()) {
      return "Diga por que está encerrando este cliente.";
    }
    return null;
  }

  if (!i.proximoPasso?.trim()) return "Defina o próximo passo.";
  if (!i.proximoPassoEm) return "Defina a data do próximo passo.";
  return null;
}

/**
 * Estágio que a interação sugere. Só avança — nunca retrocede — e nunca
 * inventa: cada regra corresponde a um fato registrado.
 */
export function estagioSugerido(cliente: Cliente, i: NovaInteracao): Estagio {
  if (i.encerramento?.status === "perdido") return "perdido";

  const candidatos: Estagio[] = [];

  if (cliente.funil === "institucional") {
    if (i.contatoFalado?.nome?.trim()) candidatos.push("mapeado");
    if (i.tipo === "demonstracao") candidatos.push("demo_realizada");
    if (i.amostraDeixada) candidatos.push("amostra_em_teste");
    if (i.resultado === "pedido") candidatos.push("cliente");
  } else {
    if (i.resultado !== "estabelecimento_fechado") candidatos.push("visitado");
    if (i.amostraDeixada) candidatos.push("material_deixado");
    if (i.resultado === "pedido") {
      const jaComprou =
        cliente.estagio === "primeiro_pedido" || cliente.estagio === "recompra";
      candidatos.push(jaComprou ? "recompra" : "primeiro_pedido");
    }
  }

  return candidatos.reduce((melhor, c) => {
    const a = ordemDoEstagio(cliente.funil, c);
    const b = ordemDoEstagio(cliente.funil, melhor);
    return a > b ? c : melhor;
  }, cliente.estagio);
}

/**
 * O caminho de escrita crítico do app. Em uma única transação:
 * grava a interação, move o cliente, cria as tarefas de P2 e P3, conclui as
 * tarefas que esta visita acabou de cumprir e marca a parada do roteiro.
 */
export async function registrarInteracao(entrada: NovaInteracao): Promise<Interacao> {
  const erro = validarInteracao(entrada);
  if (erro) throw new Error(erro);

  return db.transaction(
    "rw",
    db.interacoes,
    db.clientes,
    db.tarefas,
    db.roteiros,
    async () => {
      const cliente = await db.clientes.get(entrada.clienteId);
      if (!cliente) throw new Error("Cliente não encontrado.");

      const interacao: Interacao = {
        produtosApresentados: [],
        ...entrada,
        id: entrada.id ?? novoId(),
        data: entrada.data ?? agora(),
      };
      await db.interacoes.add(interacao);

      // --- cliente ---
      const patch: Partial<Cliente> = {
        ultimoContatoEm: interacao.data,
        estagio: estagioSugerido(cliente, interacao),
      };
      if (interacao.encerramento) {
        patch.status = interacao.encerramento.status;
        patch.proximoContatoEm = undefined;
      } else {
        patch.proximoContatoEm = interacao.proximoPassoEm;
        // Reabre um cliente que havia sido encerrado, caso ele volte a andar.
        if (cliente.status !== "ativo") patch.status = "ativo";
      }
      await db.clientes.update(cliente.id, patch);

      // --- tarefas que esta interação acabou de cumprir ---
      const abertas = await db.tarefas
        .where("clienteId")
        .equals(cliente.id)
        .filter((t) => !t.concluida)
        .toArray();

      const hoje_ = hoje();
      const cumpridas = abertas.filter(
        (t) =>
          t.origem === "proximo_passo" ||
          (t.origem === "retorno_amostra" && t.vencimentoEm <= hoje_),
      );
      if (cumpridas.length) {
        await db.tarefas.bulkUpdate(
          cumpridas.map((t) => ({
            key: t.id,
            changes: { concluida: true, concluidaEm: interacao.data },
          })),
        );
      }

      // --- P2: próximo passo vira tarefa ---
      const novas: Tarefa[] = [];
      if (interacao.proximoPasso && interacao.proximoPassoEm) {
        novas.push({
          id: novoId(),
          titulo: interacao.proximoPasso,
          clienteId: cliente.id,
          vencimentoEm: interacao.proximoPassoEm,
          origem: "proximo_passo",
          concluida: false,
          criadoEm: interacao.data,
          interacaoId: interacao.id,
        });
      }

      // --- P3: amostra cria dívida ---
      if (interacao.amostraDeixada) {
        const a = interacao.amostraDeixada;
        novas.push({
          id: novoId(),
          titulo: `Retorno da amostra: ${LABEL_PRODUTO[a.produto]} (${a.qtd})`,
          clienteId: cliente.id,
          vencimentoEm: a.retornoEm,
          origem: "retorno_amostra",
          concluida: false,
          criadoEm: interacao.data,
          interacaoId: interacao.id,
        });
      }
      if (novas.length) await db.tarefas.bulkAdd(novas);

      // --- parada do roteiro ---
      if (interacao.roteiroId) {
        const roteiro = await db.roteiros.get(interacao.roteiroId);
        if (roteiro) {
          const paradas = roteiro.paradas.map((p) =>
            p.clienteId === cliente.id && !p.concluida
              ? { ...p, concluida: true, interacaoId: interacao.id }
              : p,
          );
          await db.roteiros.update(roteiro.id, { paradas });
        }
      }

      return interacao;
    },
  );
}

/** Data de retorno padrão de uma amostra, conforme a config (P3). */
export async function retornoPadraoAmostra(): Promise<string> {
  const { diasRetornoAmostra } = await lerConfig();
  return addDias(hoje(), diasRetornoAmostra);
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export type NovoPedido = Omit<Pedido, "id" | "criadoEm" | "valorTotal"> &
  Partial<Pick<Pedido, "id" | "valorTotal">>;

export async function criarPedido(entrada: NovoPedido): Promise<Pedido> {
  if (!entrada.itens.length) throw new Error("Pedido sem itens.");

  const pedido: Pedido = {
    ...entrada,
    id: entrada.id ?? novoId(),
    valorTotal: entrada.valorTotal ?? valorPedido(entrada.itens),
    criadoEm: agora(),
  };

  await db.transaction("rw", db.pedidos, db.clientes, db.meta, async () => {
    await db.pedidos.add(pedido);

    const cliente = await db.clientes.get(pedido.clienteId);
    if (cliente && pedido.status !== "cancelado") {
      const alvo: Estagio =
        cliente.funil === "institucional"
          ? "cliente"
          : cliente.estagio === "primeiro_pedido" || cliente.estagio === "recompra"
            ? "recompra"
            : "primeiro_pedido";
      const avanca =
        ordemDoEstagio(cliente.funil, alvo) > ordemDoEstagio(cliente.funil, cliente.estagio);
      await db.clientes.update(cliente.id, {
        ultimoContatoEm: agora(),
        ...(avanca ? { estagio: alvo } : {}),
      });
    }

    // Memoriza o último preço praticado — poupa digitação no próximo pedido.
    const cfg = await lerConfig();
    const precos = { ...cfg.precoPorProduto };
    for (const item of pedido.itens) precos[item.produto] = item.precoUnitario;
    await db.meta.put({ chave: CHAVE_CONFIG, valor: { ...cfg, precoPorProduto: precos } });
  });

  return pedido;
}

// ---------------------------------------------------------------------------
// Tarefas e notas
// ---------------------------------------------------------------------------

export async function criarTarefa(
  entrada: Omit<Tarefa, "id" | "criadoEm" | "concluida"> & Partial<Pick<Tarefa, "id">>,
): Promise<Tarefa> {
  const tarefa: Tarefa = {
    ...entrada,
    id: entrada.id ?? novoId(),
    concluida: false,
    criadoEm: agora(),
  };
  await db.tarefas.add(tarefa);
  return tarefa;
}

export async function alternarTarefa(id: string): Promise<void> {
  const t = await db.tarefas.get(id);
  if (!t) return;
  await db.tarefas.update(id, {
    concluida: !t.concluida,
    concluidaEm: t.concluida ? undefined : agora(),
  });
}

export async function criarNota(
  entrada: Omit<Nota, "id" | "criadoEm" | "resolvida" | "tags"> &
    Partial<Pick<Nota, "id" | "tags" | "resolvida">>,
): Promise<Nota> {
  const nota: Nota = {
    tags: [],
    resolvida: false,
    ...entrada,
    id: entrada.id ?? novoId(),
    criadoEm: agora(),
  };
  await db.notas.add(nota);
  return nota;
}

export async function alternarNota(id: string): Promise<void> {
  const n = await db.notas.get(id);
  if (!n) return;
  await db.notas.update(id, { resolvida: !n.resolvida });
}

export async function removerNota(id: string): Promise<void> {
  await db.notas.delete(id);
}

// ---------------------------------------------------------------------------
// Edição de roteiro
// ---------------------------------------------------------------------------

/** Renumera `ordem` para 1..n depois de qualquer mexida na lista. */
function renumerar(paradas: ParadaRoteiro[]): ParadaRoteiro[] {
  return paradas.map((p, i) => ({ ...p, ordem: i + 1 }));
}

export async function moverParada(
  roteiroId: string,
  clienteId: string,
  direcao: -1 | 1,
): Promise<void> {
  const r = await db.roteiros.get(roteiroId);
  if (!r) return;
  const lista = [...r.paradas].sort((a, b) => a.ordem - b.ordem);
  const i = lista.findIndex((p) => p.clienteId === clienteId);
  const j = i + direcao;
  if (i === -1 || j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  await db.roteiros.update(roteiroId, { paradas: renumerar(lista) });
}

export async function removerParada(roteiroId: string, clienteId: string): Promise<void> {
  const r = await db.roteiros.get(roteiroId);
  if (!r) return;
  const lista = r.paradas.filter((p) => p.clienteId !== clienteId);
  await db.roteiros.update(roteiroId, { paradas: renumerar(lista) });
}

export async function adicionarParada(
  roteiroId: string,
  clienteId: string,
  objetivo = "",
  horarioSugerido = "",
): Promise<void> {
  const r = await db.roteiros.get(roteiroId);
  if (!r || r.paradas.some((p) => p.clienteId === clienteId)) return;
  const lista = [
    ...r.paradas,
    { ordem: r.paradas.length + 1, clienteId, horarioSugerido, objetivo, concluida: false },
  ];
  await db.roteiros.update(roteiroId, { paradas: renumerar(lista) });
}

/** Move uma parada para outro dia, preservando objetivo e horário. */
export async function transferirParada(
  origemId: string,
  destinoId: string,
  clienteId: string,
): Promise<void> {
  if (origemId === destinoId) return;
  await db.transaction("rw", db.roteiros, async () => {
    const origem = await db.roteiros.get(origemId);
    const destino = await db.roteiros.get(destinoId);
    if (!origem || !destino) return;
    const parada = origem.paradas.find((p) => p.clienteId === clienteId);
    if (!parada || destino.paradas.some((p) => p.clienteId === clienteId)) return;

    await db.roteiros.update(origemId, {
      paradas: renumerar(origem.paradas.filter((p) => p.clienteId !== clienteId)),
    });
    await db.roteiros.update(destinoId, {
      paradas: renumerar([...destino.paradas, { ...parada, ordem: destino.paradas.length + 1 }]),
    });
  });
}

// ---------------------------------------------------------------------------
// Geração da próxima semana (seção 7)
// ---------------------------------------------------------------------------

/**
 * Lê o estado, chama o motor puro e grava os roteiros novos.
 * Devolve o resultado para a tela mostrar o resumo e a sobra.
 */
export async function gerarProximaSemana(): Promise<ResultadoGeracao> {
  const existentes = await db.roteiros.toArray();
  if (existentes.length === 0) throw new Error("Não há semana anterior para continuar.");

  const ultimaData = existentes.reduce((m, r) => (r.data > m ? r.data : m), existentes[0].data);
  const semana = Math.max(...existentes.map((r) => r.semana)) + 1;
  const segunda = addDias(segundaDaSemana(ultimaData), 7);

  if (existentes.some((r) => r.semana === semana)) {
    throw new Error(`A semana ${semana} já existe.`);
  }

  const [clientes, tarefas, config] = await Promise.all([
    db.clientes.toArray(),
    db.tarefas.toArray(),
    lerConfig(),
  ]);

  const resultado = gerarSemana({
    semana,
    segunda,
    clientes,
    tarefas: tarefas.filter((t) => !t.concluida),
    // Um cliente já marcado em qualquer dia futuro não é reagendado.
    jaAgendados: new Set(
      existentes
        .filter((r) => r.data >= segunda)
        .flatMap((r) => r.paradas.map((p) => p.clienteId)),
    ),
    config,
  });

  if (resultado.roteiros.length) await db.roteiros.bulkAdd(resultado.roteiros);
  return resultado;
}

// ---------------------------------------------------------------------------
// Consultas de uso geral
// ---------------------------------------------------------------------------

/** Tarefas abertas com vencimento até `ate` (default: hoje). Ordem de urgência. */
export async function tarefasEmAberto(ate: string = hoje()): Promise<Tarefa[]> {
  const lista = await db.tarefas
    .where("vencimentoEm")
    .belowOrEqual(ate)
    .filter((t) => !t.concluida)
    .toArray();
  return lista.sort((a, b) => a.vencimentoEm.localeCompare(b.vencimentoEm));
}

export async function roteiroDoDia(data: string = hoje()): Promise<Roteiro | undefined> {
  return db.roteiros.where("data").equals(data).first();
}

export async function interacoesDoCliente(clienteId: string): Promise<Interacao[]> {
  const lista = await db.interacoes.where("clienteId").equals(clienteId).toArray();
  return lista.sort((a, b) => b.data.localeCompare(a.data)); // mais recente primeiro
}

/** Clientes sem contato há mais de N dias — o alerta visual do CRM. */
export async function clientesEsquecidos(dias: number): Promise<Cliente[]> {
  const limite = paraCivil(new Date(Date.now() - dias * 86_400_000));
  const todos = await db.clientes.where("status").equals("ativo").toArray();
  return todos.filter(
    (c) => !c.ultimoContatoEm || paraCivil(new Date(c.ultimoContatoEm)) < limite,
  );
}
