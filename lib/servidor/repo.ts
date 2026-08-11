/**
 * Leitura: devolve o banco inteiro numa resposta.
 *
 * Parece grosseiro e não é. O app já carregava tabelas inteiras e filtrava em
 * memória — toda tela faz `toArray()` e depois `.filter()`. O volume é de um
 * vendedor: 43 clientes, algumas centenas de interações e pedidos. Buscar tudo
 * de uma vez custa menos que dez rotas conversando, mantém as telas idênticas ao
 * que já funcionava, e a filtragem que já existe continua valendo.
 *
 * O dia em que isso ficar grande, o caminho é paginar por período — mas seriam
 * anos de rua para chegar lá.
 */

import { consultar } from "./sql";
import type {
  Cliente,
  Interacao,
  Meta,
  Nota,
  Pedido,
  Roteiro,
  Tarefa,
} from "../types";

/**
 * Troca `null` por ausência do campo.
 *
 * O Postgres devolve `null` onde os tipos do app usam campo opcional
 * (`lat?: number`). Manter o `null` funcionaria na maioria dos lugares, mas
 * espalharia diferenças sutis — `{...cliente}` passaria a carregar `lat: null`,
 * e um `JSON.stringify` de volta gravaria isso. Limpar na leitura mantém a forma
 * exatamente igual à da versão local, e nenhuma tela precisa saber da troca.
 */
function semNulos<T>(linha: T): T {
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(linha as Record<string, unknown>)) {
    if (v !== null) saida[k] = v;
  }
  return saida as T;
}

const limpar = <T,>(linhas: T[]): T[] => linhas.map(semNulos);

export interface Dados {
  clientes: Cliente[];
  interacoes: Interacao[];
  pedidos: Pedido[];
  notas: Nota[];
  tarefas: Tarefa[];
  roteiros: Roteiro[];
  meta: Meta[];
}

export async function lerTudo(): Promise<Dados> {
  // Uma consulta por tabela, em paralelo: o pool tem 3 conexões e o Postgres
  // resolve isso em poucos milissegundos.
  const [clientes, interacoes, pedidos, notas, tarefas, roteiros, meta] =
    await Promise.all([
      consultar<Cliente>(`SELECT * FROM clientes ORDER BY nome`),
      consultar<Interacao>(`SELECT * FROM interacoes ORDER BY data DESC`),
      consultar<Pedido>(`SELECT * FROM pedidos ORDER BY data DESC`),
      consultar<Nota>(`SELECT * FROM notas ORDER BY "criadoEm" DESC`),
      consultar<Tarefa>(`SELECT * FROM tarefas ORDER BY "vencimentoEm"`),
      consultar<Roteiro>(`SELECT * FROM roteiros ORDER BY data`),
      consultar<Meta>(`SELECT * FROM meta`),
    ]);

  return {
    clientes: limpar(clientes),
    interacoes: limpar(interacoes),
    pedidos: limpar(pedidos),
    notas: limpar(notas),
    tarefas: limpar(tarefas),
    roteiros: limpar(roteiros),
    // `meta.valor` é JSONB e pode ser legitimamente null — não passa pelo limpar.
    meta,
  };
}
