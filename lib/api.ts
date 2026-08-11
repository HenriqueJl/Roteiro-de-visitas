"use client";

/**
 * Cliente do servidor, com as mesmas assinaturas que lib/db.ts tinha.
 *
 * A troca do Dexie pela nuvem seria uma reescrita de dezenove arquivos se cada
 * tela precisasse aprender `fetch`. Em vez disso, cada função daqui tem o nome e
 * os parâmetros da função equivalente de antes: as telas só mudaram o caminho do
 * import. `criarNota({ texto })` continua sendo `criarNota({ texto })`.
 *
 * O executor é registrado pelo provedor (components/Dados.tsx) num módulo, e não
 * passado por contexto. É a única forma de manter estas funções chamáveis de
 * fora de componente React — e existe exatamente um provedor na aplicação, então
 * o estado global aqui é o mesmo estado global que o React já tem.
 */

import { CONFIG_PADRAO, type Config } from "./types";
import type {
  Cliente,
  Interacao,
  Meta,
  Nota,
  ParadaRoteiro,
  Pedido,
  Roteiro,
  Tarefa,
} from "./types";
import type { NovaInteracao } from "./dominio";
import { addDias, hoje } from "./datas";
import type { ResultadoGeracao } from "./gerador";

export interface Dados {
  clientes: Cliente[];
  interacoes: Interacao[];
  pedidos: Pedido[];
  notas: Nota[];
  tarefas: Tarefa[];
  roteiros: Roteiro[];
  meta: Meta[];
}

interface Acesso {
  executar: (acao: string, payload?: Record<string, unknown>) => Promise<unknown>;
  instantaneo: () => Dados;
}

let acesso: Acesso | null = null;

/** Chamado pelo provedor. Não use nas telas. */
export function registrarAcesso(a: Acesso): void {
  acesso = a;
}

async function acao<T = void>(nome: string, payload?: Record<string, unknown>): Promise<T> {
  if (!acesso) throw new Error("O app ainda está carregando. Tente de novo.");
  return acesso.executar(nome, payload) as Promise<T>;
}

/** Leitura sincrônica do último estado carregado — para código fora de React. */
export function instantaneo(): Dados {
  return (
    acesso?.instantaneo() ?? {
      clientes: [], interacoes: [], pedidos: [], notas: [],
      tarefas: [], roteiros: [], meta: [],
    }
  );
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export async function lerConfig(): Promise<Config> {
  const linha = instantaneo().meta.find((m) => m.chave === "config");
  return { ...CONFIG_PADRAO, ...((linha?.valor as Partial<Config>) ?? {}) };
}

export async function salvarConfig(patch: Partial<Config>): Promise<Config> {
  return acao<Config>("salvarConfig", { patch });
}

/** Data de retorno padrão de uma amostra, conforme a config (P3). */
export async function retornoPadraoAmostra(): Promise<string> {
  const { diasRetornoAmostra } = await lerConfig();
  return addDias(hoje(), diasRetornoAmostra);
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export type NovoCliente = Omit<
  Cliente,
  "id" | "funil" | "criadoEm" | "estagio" | "status" | "produtosInteresse" | "tags" | "observacoes"
> &
  Partial<Pick<Cliente, "id" | "estagio" | "status" | "produtosInteresse" | "tags" | "observacoes">>;

export const criarCliente = (entrada: NovoCliente) =>
  acao<Cliente>("criarCliente", entrada as unknown as Record<string, unknown>);

export const atualizarCliente = (id: string, patch: Partial<Cliente>) =>
  acao("atualizarCliente", { id, patch });

// ---------------------------------------------------------------------------
// Interações
// ---------------------------------------------------------------------------

export const registrarInteracao = (entrada: NovaInteracao) =>
  acao<Interacao>("registrarInteracao", entrada as unknown as Record<string, unknown>);

export const removerInteracao = (id: string) => acao("removerInteracao", { id });

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export type NovoPedido = Omit<Pedido, "id" | "criadoEm" | "valorTotal"> &
  Partial<Pick<Pedido, "id" | "valorTotal">>;

export const criarPedido = (entrada: NovoPedido) =>
  acao<Pedido>("criarPedido", entrada as unknown as Record<string, unknown>);

export const atualizarPedido = (
  id: string,
  patch: Partial<Pick<Pedido, "status" | "formaPagamento" | "prazoDias" | "observacoes" | "data">>,
) => acao("atualizarPedido", { id, patch });

export const removerPedido = (id: string) => acao("removerPedido", { id });

// ---------------------------------------------------------------------------
// Tarefas e notas
// ---------------------------------------------------------------------------

export const criarTarefa = (
  entrada: Omit<Tarefa, "id" | "criadoEm" | "concluida">,
) => acao<Tarefa>("criarTarefa", entrada as unknown as Record<string, unknown>);

export const alternarTarefa = (id: string) => acao("alternarTarefa", { id });

export const atualizarTarefa = (
  id: string,
  patch: Partial<Pick<Tarefa, "titulo" | "vencimentoEm">>,
) => acao("atualizarTarefa", { id, patch });

export const removerTarefa = (id: string) => acao("removerTarefa", { id });

export const criarNota = (
  entrada: Omit<Nota, "id" | "criadoEm" | "resolvida" | "tags"> & Partial<Pick<Nota, "tags">>,
) => acao<Nota>("criarNota", entrada as unknown as Record<string, unknown>);

export const alternarNota = (id: string) => acao("alternarNota", { id });

export const atualizarNota = (
  id: string,
  patch: Partial<Pick<Nota, "texto" | "tags" | "clienteId" | "resolvida">>,
) => acao("atualizarNota", { id, patch });

export const removerNota = (id: string) => acao("removerNota", { id });

// ---------------------------------------------------------------------------
// Roteiro
// ---------------------------------------------------------------------------

export const moverParada = (roteiroId: string, clienteId: string, direcao: -1 | 1) =>
  acao("moverParada", { roteiroId, clienteId, direcao });

export const removerParada = (roteiroId: string, clienteId: string) =>
  acao("removerParada", { roteiroId, clienteId });

export const adicionarParada = (
  roteiroId: string,
  clienteId: string,
  objetivo = "",
  horarioSugerido = "",
) => acao("adicionarParada", { roteiroId, clienteId, objetivo, horarioSugerido });

export const adicionarParadas = (roteiroId: string, clienteIds: string[]) =>
  acao<number>("adicionarParadas", { roteiroId, clienteIds });

export const transferirParada = (origemId: string, destinoId: string, clienteId: string) =>
  acao("transferirParada", { origemId, destinoId, clienteId });

export const atualizarParada = (
  roteiroId: string,
  clienteId: string,
  patch: Partial<Pick<ParadaRoteiro, "horarioSugerido" | "objetivo" | "fixa">>,
) => acao("atualizarParada", { roteiroId, clienteId, patch });

export const reabrirParada = (roteiroId: string, clienteId: string) =>
  acao("reabrirParada", { roteiroId, clienteId });

export const atualizarRoteiro = (
  id: string,
  patch: Partial<Pick<Roteiro, "titulo" | "cidade" | "observacao" | "tardeLivre">>,
) => acao("atualizarRoteiro", { id, patch });

export const removerRoteiro = (id: string) => acao("removerRoteiro", { id });

export const criarDiaRoteiro = (entrada: { data: string; cidade: string; titulo: string }) =>
  acao<Roteiro>("criarDiaRoteiro", entrada);

export const reagendarRoteiro = (id: string, novaData: string) =>
  acao("reagendarRoteiro", { id, novaData });

export const duplicarRoteiro = (id: string, novaData: string) =>
  acao<Roteiro>("duplicarRoteiro", { id, novaData });

export const reordenarDiaPorProximidade = (roteiroId: string) =>
  acao<number>("reordenarDiaPorProximidade", { roteiroId });

export const distribuirHorariosDoDia = (
  roteiroId: string,
  inicio: string,
  intervaloMin: number,
) => acao("distribuirHorariosDoDia", { roteiroId, inicio, intervaloMin });

export const gerarProximaSemana = () =>
  acao<ResultadoGeracao>("gerarProximaSemana");

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export const aplicarBackupNoServidor = (dados: Partial<Dados>) =>
  acao<number>("aplicarBackup", { dados });
