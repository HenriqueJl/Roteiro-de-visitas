/**
 * Exportação CSV e backup JSON (seção 6.7).
 *
 * Dois formatos com propósitos diferentes, e a distinção importa:
 *
 * - **CSV é para ler.** Abre no Excel, vai por WhatsApp para o gestor. Rótulos
 *   em português, datas em dd/MM/aaaa, número com vírgula decimal. É uma
 *   projeção legível, não uma cópia fiel — não serve para restaurar.
 * - **JSON é para restaurar.** Cópia crua das tabelas, sem formatação nenhuma,
 *   porque o único requisito dele é reimportar sem perda (critério de aceite).
 *
 * Sobre o CSV e o Excel brasileiro: o separador é `;`, não vírgula. Num Windows
 * com locale pt-BR o separador de lista é o ponto-e-vírgula, e um arquivo
 * separado por vírgula cai todo na coluna A. Junto com o BOM de UTF-8 — sem ele
 * o Excel lê o arquivo como Latin-1 e "Três Corações" chega quebrado — é o que
 * faz o duplo-clique simplesmente funcionar.
 */

import { fmtData, fmtInstanteCompleto, hoje } from "./datas";
import {
  LABEL_ESTAGIO,
  LABEL_FORMA_PAGAMENTO,
  LABEL_FUNIL,
  LABEL_OBJECAO,
  LABEL_ORIGEM_TAREFA,
  LABEL_PRODUTO,
  LABEL_RESULTADO,
  LABEL_STATUS_CLIENTE,
  LABEL_STATUS_PEDIDO,
  LABEL_TIPO_CLIENTE,
  LABEL_TIPO_INTERACAO,
  type Cliente,
  type Instante,
  type Interacao,
  type Meta,
  type Nota,
  type Pedido,
  type Roteiro,
  type Tarefa,
} from "./types";

// ---------------------------------------------------------------------------
// Montagem de CSV
// ---------------------------------------------------------------------------

/** Escrito como escape, e não como o caractere: U+FEFF é invisível no editor. */
const BOM = "\uFEFF";
const SEP = ";";

/** Número no padrão pt-BR: vírgula decimal, sem separador de milhar. */
function num(v: number, casas = 2): string {
  return v.toFixed(casas).replace(".", ",");
}

function celula(v: string | number | boolean | undefined | null): string {
  if (v === undefined || v === null) return "";
  let s: string;
  if (typeof v === "boolean") s = v ? "sim" : "não";
  else if (typeof v === "number") s = String(v).replace(".", ",");
  else s = v;
  // Aspas duplicadas e campo entre aspas: o mínimo do RFC 4180 que o Excel
  // respeita. Sem isto, uma observação com ponto-e-vírgula desloca a linha.
  return /["\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type Linha = (string | number | boolean | undefined | null)[];

function montarCsv(cabecalho: string[], linhas: Linha[]): string {
  const corpo = [cabecalho, ...linhas]
    .map((l) => l.map(celula).join(SEP))
    .join("\r\n");
  return BOM + corpo + "\r\n";
}

const lista = (xs: string[]) => xs.join(", ");

// ---------------------------------------------------------------------------
// As três projeções
// ---------------------------------------------------------------------------

export function csvClientes(clientes: Cliente[]): string {
  return montarCsv(
    [
      "Nome", "Tipo", "Funil", "Estágio", "Status", "Cidade", "Bairro",
      "Endereço", "Telefone", "Contato", "Cargo", "Telefone do contato",
      "Produtos de interesse", "Tags", "Cadastrado em", "Último contato",
      "Próximo contato", "Latitude", "Longitude", "Observações",
    ],
    clientes.map((c) => [
      c.nome,
      LABEL_TIPO_CLIENTE[c.tipo],
      LABEL_FUNIL[c.funil],
      LABEL_ESTAGIO[c.estagio],
      LABEL_STATUS_CLIENTE[c.status],
      c.cidade,
      c.bairro,
      c.endereco,
      c.telefone,
      c.contatoPrincipal?.nome,
      c.contatoPrincipal?.cargo,
      c.contatoPrincipal?.telefone,
      lista(c.produtosInteresse.map((p) => LABEL_PRODUTO[p])),
      lista(c.tags),
      fmtInstanteCompleto(c.criadoEm),
      c.ultimoContatoEm ? fmtInstanteCompleto(c.ultimoContatoEm) : "",
      c.proximoContatoEm ? fmtData(c.proximoContatoEm) : "",
      c.lat,
      c.lng,
      c.observacoes,
    ]),
  );
}

export function csvInteracoes(
  interacoes: Interacao[],
  porId: Map<string, Cliente>,
): string {
  // Mais recente primeiro: é a ordem em que ele lê qualquer histórico.
  const ordenadas = [...interacoes].sort((a, b) => b.data.localeCompare(a.data));
  return montarCsv(
    [
      "Data", "Cliente", "Tipo de cliente", "Cidade", "Tipo", "Resultado",
      "Objeção", "Observação da objeção", "Produtos apresentados", "Contato",
      "Cargo", "Amostra", "Qtd. amostra", "Retorno da amostra",
      "Próximo passo", "Data do próximo passo", "Encerramento",
      "Motivo do encerramento", "Duração (min)", "Notas",
    ],
    ordenadas.map((i) => {
      const c = porId.get(i.clienteId);
      return [
        fmtInstanteCompleto(i.data),
        c?.nome ?? "Cliente removido",
        c ? LABEL_TIPO_CLIENTE[c.tipo] : "",
        c?.cidade ?? "",
        LABEL_TIPO_INTERACAO[i.tipo],
        LABEL_RESULTADO[i.resultado],
        i.objecao ? LABEL_OBJECAO[i.objecao] : "",
        i.objecaoObs,
        lista(i.produtosApresentados.map((p) => LABEL_PRODUTO[p])),
        i.contatoFalado?.nome,
        i.contatoFalado?.cargo,
        i.amostraDeixada ? LABEL_PRODUTO[i.amostraDeixada.produto] : "",
        i.amostraDeixada?.qtd,
        i.amostraDeixada ? fmtData(i.amostraDeixada.retornoEm) : "",
        i.proximoPasso,
        i.proximoPassoEm ? fmtData(i.proximoPassoEm) : "",
        i.encerramento ? LABEL_STATUS_CLIENTE[i.encerramento.status] : "",
        i.encerramento?.motivo,
        i.duracaoMin,
        i.notas,
      ];
    }),
  );
}

export function csvPedidos(pedidos: Pedido[], porId: Map<string, Cliente>): string {
  const ordenados = [...pedidos].sort((a, b) => b.data.localeCompare(a.data));
  return montarCsv(
    [
      "Data", "Cliente", "Tipo de cliente", "Cidade", "Itens", "Valor total",
      "Forma de pagamento", "Prazo (dias)", "Status", "Observações",
    ],
    ordenados.map((p) => {
      const c = porId.get(p.clienteId);
      const itens = p.itens
        .map(
          (i) =>
            `${i.quantidade}x ${LABEL_PRODUTO[i.produto]} a R$ ${num(i.precoUnitario)}` +
            (i.desconto > 0 ? ` (-${i.desconto}%)` : ""),
        )
        .join(" | ");
      return [
        fmtData(p.data),
        c?.nome ?? "Cliente removido",
        c ? LABEL_TIPO_CLIENTE[c.tipo] : "",
        c?.cidade ?? "",
        itens,
        num(p.valorTotal),
        LABEL_FORMA_PAGAMENTO[p.formaPagamento],
        p.prazoDias,
        LABEL_STATUS_PEDIDO[p.status],
        p.observacoes,
      ];
    }),
  );
}

export function csvTarefas(tarefas: Tarefa[], porId: Map<string, Cliente>): string {
  const ordenadas = [...tarefas].sort((a, b) => a.vencimentoEm.localeCompare(b.vencimentoEm));
  return montarCsv(
    ["Vencimento", "Título", "Cliente", "Origem", "Concluída", "Concluída em"],
    ordenadas.map((t) => [
      fmtData(t.vencimentoEm),
      t.titulo,
      t.clienteId ? (porId.get(t.clienteId)?.nome ?? "Cliente removido") : "",
      LABEL_ORIGEM_TAREFA[t.origem],
      t.concluida,
      t.concluidaEm ? fmtInstanteCompleto(t.concluidaEm) : "",
    ]),
  );
}

// ---------------------------------------------------------------------------
// Backup JSON
// ---------------------------------------------------------------------------

/** Marcador de formato. Sobe se o formato do arquivo mudar de forma incompatível. */
export const VERSAO_BACKUP = 1;

export interface DadosBackup {
  clientes: Cliente[];
  interacoes: Interacao[];
  pedidos: Pedido[];
  notas: Nota[];
  tarefas: Tarefa[];
  roteiros: Roteiro[];
  meta: Meta[];
}

export interface Backup {
  /** Assinatura: impede que um JSON qualquer apague a base inteira. */
  app: "campo";
  versao: number;
  exportadoEm: Instante;
  dados: DadosBackup;
}

const TABELAS = [
  "clientes",
  "interacoes",
  "pedidos",
  "notas",
  "tarefas",
  "roteiros",
  "meta",
] as const;


/**
 * Valida o arquivo escolhido antes de qualquer escrita.
 *
 * Restaurar é destrutivo, então a checagem é paranoica de propósito: a tela
 * mostra o resumo devolvido aqui e só manda ao servidor depois de o usuário
 * confirmar.
 */
export function lerBackup(texto: string): Backup {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new Error("Arquivo não é um JSON válido.");
  }

  if (typeof bruto !== "object" || bruto === null) {
    throw new Error("Arquivo vazio ou em formato desconhecido.");
  }
  const b = bruto as Partial<Backup>;
  if (b.app !== "campo") throw new Error("Este arquivo não é um backup do Campo.");
  if (typeof b.versao !== "number" || b.versao > VERSAO_BACKUP) {
    throw new Error(
      `Backup da versão ${String(b.versao)}; este app lê até a ${VERSAO_BACKUP}.`,
    );
  }
  if (typeof b.dados !== "object" || b.dados === null) {
    throw new Error("Backup sem dados.");
  }

  // Toda tabela presente tem de ser array. Ausente vira vazia — é o que
  // "restaurar este arquivo" significa.
  const dados = b.dados as unknown as Record<string, unknown>;
  const limpos = {} as DadosBackup;
  for (const t of TABELAS) {
    const v = dados[t];
    if (v !== undefined && !Array.isArray(v)) {
      throw new Error(`A tabela "${t}" do backup está corrompida.`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (limpos as any)[t] = v ?? [];
  }

  return {
    app: "campo",
    versao: b.versao,
    exportadoEm: typeof b.exportadoEm === "string" ? b.exportadoEm : "",
    dados: limpos,
  };
}

export function contarBackup(b: Backup): number {
  return TABELAS.reduce((s, t) => s + b.dados[t].length, 0);
}

/**
 * Montar e restaurar saíram daqui.
 *
 * Montar virou leitura do estado que o provedor já carregou — o servidor acabou
 * de mandar tudo, e ir buscar de novo só atrasaria o download. Restaurar virou a
 * ação `aplicarBackup` no servidor, dentro de uma transação: não há mais banco no
 * navegador para escrever. O que sobrou aqui é o que é puro — validar o arquivo
 * e contar o que ele traz.
 */

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

export function nomeArquivo(base: string, extensao: string): string {
  return `campo-${base}-${hoje()}.${extensao}`;
}

/** Blob + link sintético. Sem biblioteca e sem servidor — funciona offline. */
export function baixar(nome: string, conteudo: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  // O revoke imediato cancelaria o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function baixarCsv(base: string, conteudo: string): void {
  baixar(nomeArquivo(base, "csv"), conteudo, "text/csv;charset=utf-8");
}

export function baixarJson(base: string, dados: unknown): void {
  baixar(nomeArquivo(base, "json"), JSON.stringify(dados, null, 2), "application/json");
}
