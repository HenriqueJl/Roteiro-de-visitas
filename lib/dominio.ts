/**
 * Regras de domínio puras — sem banco.
 *
 * Moradia de P2 (próximo passo obrigatório) e da inferência de estágio. Estavam
 * em lib/db.ts, que importa Dexie; o servidor precisa das mesmas regras e não
 * pode arrastar um banco de navegador para dentro do Node. Separar também deixa
 * explícito o que é decisão de negócio e o que é persistência.
 *
 * O que vale para as duas pontas mora aqui, e é aqui que se muda quando a regra
 * mudar — não em dois lugares.
 */

import { ordemDoEstagio } from "./types";
import type { Cliente, Estagio, Interacao } from "./types";

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
