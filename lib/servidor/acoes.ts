/**
 * Escrita: uma ação nomeada por operação, todas atrás de `POST /api/acao`.
 *
 * Duas escolhas que definem este arquivo:
 *
 * 1. **As travas ficam aqui, não na tela.** P2 (próximo passo obrigatório) e P3
 *    (amostra cria dívida) rodam dentro da transação. A tela continua
 *    desabilitando o botão por cortesia, mas quem recusa de verdade é o
 *    servidor — que é o que a especificação sempre quis dizer com "o banco
 *    recusa". Agora é literal.
 *
 * 2. **Um catálogo de ações em vez de vinte rotas.** Cada entrada recebe o
 *    payload e o cliente da transação. Acrescentar operação é acrescentar uma
 *    linha, e a autenticação, o log de erro e o formato de resposta são
 *    resolvidos uma vez no route handler.
 *
 * As transformações de rota (ordem, horários) não são reimplementadas: as
 * funções puras de lib/rota.ts recebem as paradas e devolvem as paradas, e aqui
 * só se lê o dia, aplica e grava.
 */

import type { PoolClient } from "pg";
import { addDias, agora, diaSemanaDe, diffDias, hoje, segundaDaSemana } from "../datas";
import { estagioSugerido, validarInteracao, type NovaInteracao } from "../dominio";
import { gerarSemana } from "../gerador";
import { distribuirHorarios, renumerar, reordenarPorProximidade } from "../rota";
import {
  CONFIG_PADRAO,
  LABEL_PRODUTO,
  funilDoTipo,
  ordemDoEstagio,
  valorPedido,
  type Cliente,
  type Config,
  type DataCivil,
  type DiaSemana,
  type Estagio,
  type Interacao,
  type Nota,
  type ParadaRoteiro,
  type Pedido,
  type Roteiro,
  type Tarefa,
} from "../types";
import { transacao } from "./sql";

const novoId = () => crypto.randomUUID();

// ---------------------------------------------------------------------------
// UPDATE genérico com colunas na lista branca
// ---------------------------------------------------------------------------

/**
 * Colunas que cada tabela aceita receber por patch, e quais são JSONB.
 *
 * Lista branca e não `Object.keys(patch)` solto: os nomes vão interpolados no
 * SQL (não há como parametrizar identificador), então aceitar chave arbitrária
 * do cliente seria injeção. Coluna desconhecida derruba a ação em vez de ser
 * ignorada em silêncio — patch que não grava é o bug que ninguém encontra.
 */
const COLUNAS: Record<string, Record<string, "valor" | "jsonb">> = {
  clientes: {
    nome: "valor", tipo: "valor", cidade: "valor", bairro: "valor", endereco: "valor",
    telefone: "valor", lat: "valor", lng: "valor", funil: "valor", estagio: "valor",
    status: "valor", observacoes: "valor", ultimoContatoEm: "valor",
    proximoContatoEm: "valor", contatoPrincipal: "jsonb", produtosInteresse: "jsonb",
    tags: "jsonb",
  },
  pedidos: {
    data: "valor", formaPagamento: "valor", prazoDias: "valor", status: "valor",
    observacoes: "valor", valorTotal: "valor", itens: "jsonb",
  },
  notas: { texto: "valor", clienteId: "valor", resolvida: "valor", tags: "jsonb" },
  tarefas: {
    titulo: "valor", vencimentoEm: "valor", concluida: "valor", concluidaEm: "valor",
  },
  roteiros: {
    titulo: "valor", cidade: "valor", observacao: "valor", tardeLivre: "valor",
    data: "valor", semana: "valor", diaSemana: "valor", paradas: "jsonb",
  },
};

/**
 * Todas as colunas de cada tabela, para a restauração de backup.
 *
 * Necessária por causa do mesmo risco que a lista branca de `atualizar`: o
 * arquivo de backup vem de fora, e usar `Object.keys(linha)` como nome de coluna
 * deixaria uma chave forjada escapar das aspas do SQL. Aqui só entra coluna que
 * está nesta lista; qualquer outra derruba a restauração inteira, em vez de ser
 * inserida ou ignorada em silêncio.
 */
const COLUNAS_COMPLETAS: Record<string, string[]> = {
  clientes: [
    "id", "nome", "tipo", "cidade", "bairro", "endereco", "telefone", "lat", "lng",
    "contatoPrincipal", "funil", "estagio", "status", "produtosInteresse", "tags",
    "criadoEm", "ultimoContatoEm", "proximoContatoEm", "observacoes",
  ],
  interacoes: [
    "id", "clienteId", "data", "tipo", "produtosApresentados", "contatoFalado",
    "resultado", "objecao", "objecaoObs", "amostraDeixada", "proximoPasso",
    "proximoPassoEm", "encerramento", "notas", "duracaoMin", "roteiroId",
  ],
  pedidos: [
    "id", "clienteId", "data", "itens", "valorTotal", "formaPagamento", "prazoDias",
    "status", "observacoes", "criadoEm", "interacaoId",
  ],
  notas: ["id", "texto", "clienteId", "tags", "criadoEm", "resolvida"],
  tarefas: [
    "id", "titulo", "clienteId", "vencimentoEm", "origem", "concluida", "criadoEm",
    "concluidaEm", "interacaoId",
  ],
  roteiros: [
    "id", "semana", "diaSemana", "data", "cidade", "titulo", "paradas", "tardeLivre",
    "observacao",
  ],
  meta: ["chave", "valor"],
};

async function atualizar(
  c: PoolClient,
  tabela: keyof typeof COLUNAS,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const permitidas = COLUNAS[tabela];
  const sets: string[] = [];
  const valores: unknown[] = [];

  for (const [chave, valor] of Object.entries(patch)) {
    if (valor === undefined) continue;
    const tipo = permitidas[chave];
    if (!tipo) throw new Error(`Campo "${chave}" não pode ser alterado em ${tabela}.`);
    valores.push(tipo === "jsonb" ? JSON.stringify(valor) : valor);
    sets.push(`"${chave}" = $${valores.length}`);
  }
  if (!sets.length) return;

  valores.push(id);
  await c.query(
    `UPDATE ${tabela} SET ${sets.join(", ")} WHERE id = $${valores.length}`,
    valores,
  );
}

// ---------------------------------------------------------------------------
// Roteiro: ler, transformar as paradas, gravar
// ---------------------------------------------------------------------------

async function lerRoteiro(c: PoolClient, id: string): Promise<Roteiro | null> {
  const { rows } = await c.query<Roteiro>(`SELECT * FROM roteiros WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

async function gravarParadas(c: PoolClient, id: string, paradas: ParadaRoteiro[]) {
  await c.query(`UPDATE roteiros SET paradas = $1 WHERE id = $2`, [
    JSON.stringify(paradas),
    id,
  ]);
}

/** Aplica uma transformação pura nas paradas de um dia. */
async function comParadas(
  c: PoolClient,
  roteiroId: string,
  fn: (paradas: ParadaRoteiro[], r: Roteiro) => ParadaRoteiro[],
): Promise<void> {
  const r = await lerRoteiro(c, roteiroId);
  if (!r) return;
  await gravarParadas(c, roteiroId, fn(r.paradas, r));
}

const porOrdem = (a: ParadaRoteiro, b: ParadaRoteiro) => a.ordem - b.ordem;

/**
 * Semana e dia da semana derivados da data, na numeração de quem já existe.
 * Um único lugar para criar, reagendar e duplicar — se cada um contasse do seu
 * jeito, as abas passariam a discordar da data.
 */
async function posicaoNaAgenda(
  c: PoolClient,
  data: DataCivil,
): Promise<{ semana: number; diaSemana: DiaSemana }> {
  const diaSemana = diaSemanaDe(data);
  if (diaSemana === 0) throw new Error("O roteiro só prevê dias úteis.");

  const { rows } = await c.query<{ data: DataCivil; semana: number }>(
    `SELECT data, semana FROM roteiros ORDER BY data LIMIT 1`,
  );
  if (!rows.length) return { semana: 1, diaSemana };

  const base = rows[0];
  const passos = Math.floor(
    diffDias(segundaDaSemana(base.data), segundaDaSemana(data)) / 7,
  );
  return { semana: base.semana + passos, diaSemana };
}

async function dataOcupada(c: PoolClient, data: DataCivil, exceto?: string) {
  const { rows } = await c.query(
    `SELECT 1 FROM roteiros WHERE data = $1 AND ($2::text IS NULL OR id <> $2) LIMIT 1`,
    [data, exceto ?? null],
  );
  if (rows.length) throw new Error("Já existe um dia nessa data.");
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

async function lerConfig(c: PoolClient): Promise<Config> {
  const { rows } = await c.query<{ valor: Partial<Config> }>(
    `SELECT valor FROM meta WHERE chave = 'config'`,
  );
  return { ...CONFIG_PADRAO, ...(rows[0]?.valor ?? {}) };
}

async function gravarConfig(c: PoolClient, cfg: Config) {
  await c.query(
    `INSERT INTO meta (chave, valor) VALUES ('config', $1)
     ON CONFLICT (chave) DO UPDATE SET valor = $1`,
    [JSON.stringify(cfg)],
  );
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

type Payload = Record<string, unknown>;
type Acao = (p: Payload, c: PoolClient) => Promise<unknown>;

/** Lê um campo obrigatório do payload, com erro legível se faltar. */
function texto(p: Payload, campo: string): string {
  const v = p[campo];
  if (typeof v !== "string" || !v) throw new Error(`Falta "${campo}".`);
  return v;
}

export const ACOES: Record<string, Acao> = {
  // ------------------------------------------------------------- clientes
  async criarCliente(p, c) {
    const e = p as unknown as Partial<Cliente> & { tipo: Cliente["tipo"]; nome: string };
    const cliente: Cliente = {
      produtosInteresse: [], tags: [], observacoes: "",
      estagio: "prospect", status: "ativo", cidade: "", bairro: "", endereco: "",
      telefone: "",
      ...e,
      id: e.id ?? novoId(),
      funil: funilDoTipo(e.tipo),
      criadoEm: agora(),
    } as Cliente;

    await c.query(
      `INSERT INTO clientes (id, nome, tipo, cidade, bairro, endereco, telefone, lat, lng,
         "contatoPrincipal", funil, estagio, status, "produtosInteresse", tags,
         "criadoEm", "proximoContatoEm", observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        cliente.id, cliente.nome, cliente.tipo, cliente.cidade, cliente.bairro,
        cliente.endereco, cliente.telefone, cliente.lat ?? null, cliente.lng ?? null,
        cliente.contatoPrincipal ? JSON.stringify(cliente.contatoPrincipal) : null,
        cliente.funil, cliente.estagio, cliente.status,
        JSON.stringify(cliente.produtosInteresse), JSON.stringify(cliente.tags),
        cliente.criadoEm, cliente.proximoContatoEm ?? null, cliente.observacoes,
      ],
    );
    return cliente;
  },

  async atualizarCliente(p, c) {
    const id = texto(p, "id");
    const patch = { ...(p.patch as Record<string, unknown>) };

    // O funil nunca é digitado: se o tipo muda, recalcula — e se o estágio atual
    // não existir no funil novo, volta para prospect em vez de ficar órfão.
    if (patch.tipo) {
      const funil = funilDoTipo(patch.tipo as Cliente["tipo"]);
      patch.funil = funil;
      const { rows } = await c.query<{ estagio: Estagio }>(
        `SELECT estagio FROM clientes WHERE id = $1`, [id],
      );
      const estagio = (patch.estagio as Estagio) ?? rows[0]?.estagio;
      if (estagio && ordemDoEstagio(funil, estagio) === -1) patch.estagio = "prospect";
    }
    await atualizar(c, "clientes", id, patch);
  },

  // ------------------------------------------------------------ interações
  /**
   * O caminho de escrita crítico. Numa transação: grava a interação, move o
   * cliente, conclui as tarefas que a visita cumpriu, cria as de P2 e P3 e marca
   * a parada do roteiro. Recusa antes de qualquer escrita se P2 não estiver
   * satisfeito.
   */
  async registrarInteracao(p, c) {
    const entrada = p as unknown as NovaInteracao;
    const erro = validarInteracao(entrada);
    if (erro) throw new Error(erro);

    const { rows } = await c.query<Cliente>(`SELECT * FROM clientes WHERE id = $1`, [
      entrada.clienteId,
    ]);
    const cliente = rows[0];
    if (!cliente) throw new Error("Cliente não encontrado.");

    const i: Interacao = {
      produtosApresentados: [],
      ...entrada,
      id: entrada.id ?? novoId(),
      data: entrada.data ?? agora(),
    };

    await c.query(
      `INSERT INTO interacoes (id, "clienteId", data, tipo, "produtosApresentados",
         "contatoFalado", resultado, objecao, "objecaoObs", "amostraDeixada",
         "proximoPasso", "proximoPassoEm", encerramento, notas, "duracaoMin", "roteiroId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        i.id, i.clienteId, i.data, i.tipo, JSON.stringify(i.produtosApresentados),
        i.contatoFalado ? JSON.stringify(i.contatoFalado) : null,
        i.resultado, i.objecao ?? null, i.objecaoObs ?? null,
        i.amostraDeixada ? JSON.stringify(i.amostraDeixada) : null,
        i.proximoPasso ?? null, i.proximoPassoEm ?? null,
        i.encerramento ? JSON.stringify(i.encerramento) : null,
        i.notas ?? null, i.duracaoMin ?? null, i.roteiroId ?? null,
      ],
    );

    // --- cliente ---
    const patch: Record<string, unknown> = {
      ultimoContatoEm: i.data,
      estagio: estagioSugerido(cliente, i),
    };
    if (i.encerramento) {
      patch.status = i.encerramento.status;
      patch.proximoContatoEm = null;
    } else {
      patch.proximoContatoEm = i.proximoPassoEm ?? null;
      if (cliente.status !== "ativo") patch.status = "ativo";
    }
    await atualizar(c, "clientes", cliente.id, patch);

    // --- tarefas que esta interação cumpriu ---
    await c.query(
      `UPDATE tarefas SET concluida = TRUE, "concluidaEm" = $2
        WHERE "clienteId" = $1 AND concluida = FALSE
          AND (origem = 'proximo_passo'
               OR (origem = 'retorno_amostra' AND "vencimentoEm" <= $3))`,
      [cliente.id, i.data, hoje()],
    );

    // --- P2: próximo passo vira tarefa ---
    const novas: Tarefa[] = [];
    if (i.proximoPasso && i.proximoPassoEm) {
      novas.push({
        id: novoId(), titulo: i.proximoPasso, clienteId: cliente.id,
        vencimentoEm: i.proximoPassoEm, origem: "proximo_passo",
        concluida: false, criadoEm: i.data, interacaoId: i.id,
      });
    }
    // --- P3: amostra cria dívida ---
    if (i.amostraDeixada) {
      const a = i.amostraDeixada;
      novas.push({
        id: novoId(),
        titulo: `Retorno da amostra: ${LABEL_PRODUTO[a.produto]} (${a.qtd})`,
        clienteId: cliente.id, vencimentoEm: a.retornoEm,
        origem: "retorno_amostra", concluida: false, criadoEm: i.data,
        interacaoId: i.id,
      });
    }
    for (const t of novas) {
      await c.query(
        `INSERT INTO tarefas (id, titulo, "clienteId", "vencimentoEm", origem,
           concluida, "criadoEm", "interacaoId")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [t.id, t.titulo, t.clienteId ?? null, t.vencimentoEm, t.origem, t.concluida,
         t.criadoEm, t.interacaoId ?? null],
      );
    }

    // --- parada do roteiro ---
    if (i.roteiroId) {
      await comParadas(c, i.roteiroId, (paradas) =>
        paradas.map((x) =>
          x.clienteId === cliente.id && !x.concluida
            ? { ...x, concluida: true, interacaoId: i.id }
            : x,
        ),
      );
    }
    return i;
  },

  /**
   * Apaga interação registrada por engano, junto com o que ela criou. O estágio
   * do cliente não volta atrás: `estagioSugerido` só avança e não há como saber
   * o anterior sem histórico de estágio — corrigir é um toque no quadro.
   */
  async removerInteracao(p, c) {
    const id = texto(p, "id");
    const { rows } = await c.query<{ roteiroId: string | null }>(
      `SELECT "roteiroId" FROM interacoes WHERE id = $1`, [id],
    );
    if (!rows.length) return;

    await c.query(`DELETE FROM tarefas WHERE "interacaoId" = $1`, [id]);
    if (rows[0].roteiroId) {
      await comParadas(c, rows[0].roteiroId, (paradas) =>
        paradas.map((x) =>
          x.interacaoId === id ? { ...x, concluida: false, interacaoId: undefined } : x,
        ),
      );
    }
    await c.query(`DELETE FROM interacoes WHERE id = $1`, [id]);
  },

  // -------------------------------------------------------------- pedidos
  async criarPedido(p, c) {
    const e = p as unknown as Omit<Pedido, "id" | "criadoEm" | "valorTotal"> &
      Partial<Pick<Pedido, "id" | "valorTotal">>;
    if (!e.itens?.length) throw new Error("Pedido sem itens.");

    const pedido: Pedido = {
      ...e,
      id: e.id ?? novoId(),
      valorTotal: e.valorTotal ?? valorPedido(e.itens),
      criadoEm: agora(),
    };

    await c.query(
      `INSERT INTO pedidos (id, "clienteId", data, itens, "valorTotal",
         "formaPagamento", "prazoDias", status, observacoes, "criadoEm", "interacaoId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        pedido.id, pedido.clienteId, pedido.data, JSON.stringify(pedido.itens),
        pedido.valorTotal, pedido.formaPagamento, pedido.prazoDias, pedido.status,
        pedido.observacoes, pedido.criadoEm, pedido.interacaoId ?? null,
      ],
    );

    const { rows } = await c.query<Cliente>(`SELECT * FROM clientes WHERE id = $1`, [
      pedido.clienteId,
    ]);
    const cliente = rows[0];
    if (cliente && pedido.status !== "cancelado") {
      const alvo: Estagio =
        cliente.funil === "institucional"
          ? "cliente"
          : cliente.estagio === "primeiro_pedido" || cliente.estagio === "recompra"
            ? "recompra"
            : "primeiro_pedido";
      const avanca =
        ordemDoEstagio(cliente.funil, alvo) > ordemDoEstagio(cliente.funil, cliente.estagio);
      await atualizar(c, "clientes", cliente.id, {
        ultimoContatoEm: agora(),
        ...(avanca ? { estagio: alvo } : {}),
      });
    }

    // Memoriza o último preço praticado — poupa digitação no próximo pedido.
    const cfg = await lerConfig(c);
    const precos = { ...cfg.precoPorProduto };
    for (const item of pedido.itens) precos[item.produto] = item.precoUnitario;
    await gravarConfig(c, { ...cfg, precoPorProduto: precos });

    return pedido;
  },

  async atualizarPedido(p, c) {
    await atualizar(c, "pedidos", texto(p, "id"), p.patch as Record<string, unknown>);
  },
  async removerPedido(p, c) {
    await c.query(`DELETE FROM pedidos WHERE id = $1`, [texto(p, "id")]);
  },

  // -------------------------------------------------------------- tarefas
  async criarTarefa(p, c) {
    const e = p as unknown as Omit<Tarefa, "id" | "criadoEm" | "concluida">;
    const t: Tarefa = { ...e, id: novoId(), concluida: false, criadoEm: agora() };
    await c.query(
      `INSERT INTO tarefas (id, titulo, "clienteId", "vencimentoEm", origem,
         concluida, "criadoEm", "interacaoId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [t.id, t.titulo, t.clienteId ?? null, t.vencimentoEm, t.origem, t.concluida,
       t.criadoEm, t.interacaoId ?? null],
    );
    return t;
  },
  async alternarTarefa(p, c) {
    await c.query(
      `UPDATE tarefas
          SET concluida = NOT concluida,
              "concluidaEm" = CASE WHEN concluida THEN NULL ELSE $2 END
        WHERE id = $1`,
      [texto(p, "id"), agora()],
    );
  },
  async atualizarTarefa(p, c) {
    await atualizar(c, "tarefas", texto(p, "id"), p.patch as Record<string, unknown>);
  },
  async removerTarefa(p, c) {
    await c.query(`DELETE FROM tarefas WHERE id = $1`, [texto(p, "id")]);
  },

  // ---------------------------------------------------------------- notas
  async criarNota(p, c) {
    const e = p as unknown as Omit<Nota, "id" | "criadoEm" | "resolvida">;
    // `tags` depois do spread, com padrão: o tipo declara o campo como obrigatório,
    // mas a tela pode não mandar.
    const n: Nota = {
      ...e,
      tags: e.tags ?? [],
      id: novoId(),
      resolvida: false,
      criadoEm: agora(),
    };
    await c.query(
      `INSERT INTO notas (id, texto, "clienteId", tags, "criadoEm", resolvida)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [n.id, n.texto, n.clienteId ?? null, JSON.stringify(n.tags), n.criadoEm, n.resolvida],
    );
    return n;
  },
  async alternarNota(p, c) {
    await c.query(`UPDATE notas SET resolvida = NOT resolvida WHERE id = $1`, [
      texto(p, "id"),
    ]);
  },
  async atualizarNota(p, c) {
    await atualizar(c, "notas", texto(p, "id"), p.patch as Record<string, unknown>);
  },
  async removerNota(p, c) {
    await c.query(`DELETE FROM notas WHERE id = $1`, [texto(p, "id")]);
  },

  // --------------------------------------------------------------- config
  async salvarConfig(p, c) {
    const cfg = { ...(await lerConfig(c)), ...(p.patch as Partial<Config>) };
    await gravarConfig(c, cfg);
    return cfg;
  },

  // -------------------------------------------------------------- paradas
  async moverParada(p, c) {
    const clienteId = texto(p, "clienteId");
    const direcao = Number(p.direcao) as -1 | 1;
    await comParadas(c, texto(p, "roteiroId"), (paradas) => {
      const lista = [...paradas].sort(porOrdem);
      const i = lista.findIndex((x) => x.clienteId === clienteId);
      const j = i + direcao;
      if (i === -1 || j < 0 || j >= lista.length) return paradas;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      return renumerar(lista);
    });
  },
  async removerParada(p, c) {
    const clienteId = texto(p, "clienteId");
    await comParadas(c, texto(p, "roteiroId"), (paradas) =>
      renumerar(paradas.filter((x) => x.clienteId !== clienteId)),
    );
  },
  async adicionarParada(p, c) {
    const clienteId = texto(p, "clienteId");
    await comParadas(c, texto(p, "roteiroId"), (paradas) => {
      if (paradas.some((x) => x.clienteId === clienteId)) return paradas;
      return renumerar([
        ...paradas,
        {
          ordem: paradas.length + 1, clienteId,
          horarioSugerido: String(p.horarioSugerido ?? ""),
          objetivo: String(p.objetivo ?? ""), concluida: false,
        },
      ]);
    });
  },
  async adicionarParadas(p, c) {
    const ids = (p.clienteIds as string[]) ?? [];
    let inseridos = 0;
    await comParadas(c, texto(p, "roteiroId"), (paradas) => {
      const jaTem = new Set(paradas.map((x) => x.clienteId));
      const novos = ids.filter((id) => !jaTem.has(id));
      inseridos = novos.length;
      if (!novos.length) return paradas;
      return renumerar([
        ...paradas,
        ...novos.map((clienteId, i) => ({
          ordem: paradas.length + i + 1, clienteId,
          horarioSugerido: "", objetivo: "", concluida: false,
        })),
      ]);
    });
    return inseridos;
  },
  async atualizarParada(p, c) {
    const clienteId = texto(p, "clienteId");
    const patch = p.patch as Partial<ParadaRoteiro>;
    await comParadas(c, texto(p, "roteiroId"), (paradas) =>
      paradas.map((x) => (x.clienteId === clienteId ? { ...x, ...patch } : x)),
    );
  },
  async reabrirParada(p, c) {
    const clienteId = texto(p, "clienteId");
    await comParadas(c, texto(p, "roteiroId"), (paradas) =>
      paradas.map((x) =>
        x.clienteId === clienteId
          ? { ...x, concluida: false, interacaoId: undefined }
          : x,
      ),
    );
  },
  async transferirParada(p, c) {
    const origemId = texto(p, "origemId");
    const destinoId = texto(p, "destinoId");
    const clienteId = texto(p, "clienteId");
    if (origemId === destinoId) return;

    const origem = await lerRoteiro(c, origemId);
    const destino = await lerRoteiro(c, destinoId);
    if (!origem || !destino) return;

    const parada = origem.paradas.find((x) => x.clienteId === clienteId);
    if (!parada || destino.paradas.some((x) => x.clienteId === clienteId)) return;

    await gravarParadas(c, origemId, renumerar(
      origem.paradas.filter((x) => x.clienteId !== clienteId),
    ));
    await gravarParadas(c, destinoId, renumerar([
      ...destino.paradas,
      { ...parada, ordem: destino.paradas.length + 1 },
    ]));
  },

  async reordenarDiaPorProximidade(p, c) {
    const roteiroId = texto(p, "roteiroId");
    const r = await lerRoteiro(c, roteiroId);
    if (!r) return 0;

    const ids = r.paradas.map((x) => x.clienteId);
    const { rows } = await c.query<{ id: string; lat: number | null; lng: number | null }>(
      `SELECT id, lat, lng FROM clientes WHERE id = ANY($1)`, [ids],
    );
    const posicao = new Map(
      rows.filter((x) => x.lat != null && x.lng != null)
          .map((x) => [x.id, { lat: x.lat!, lng: x.lng! }]),
    );

    const antes = [...r.paradas].sort(porOrdem).map((x) => x.clienteId);
    const novas = reordenarPorProximidade(r.paradas, (id) => posicao.get(id));
    await gravarParadas(c, roteiroId, novas);

    const depois = novas.map((x) => x.clienteId);
    return antes.reduce((n, id, i) => (depois[i] === id ? n : n + 1), 0);
  },

  async distribuirHorariosDoDia(p, c) {
    const inicio = texto(p, "inicio");
    const intervalo = Number(p.intervaloMin);
    await comParadas(c, texto(p, "roteiroId"), (paradas) =>
      distribuirHorarios(paradas, inicio, intervalo),
    );
  },

  // -------------------------------------------------------------- roteiros
  async atualizarRoteiro(p, c) {
    await atualizar(c, "roteiros", texto(p, "id"), p.patch as Record<string, unknown>);
  },
  async removerRoteiro(p, c) {
    await c.query(`DELETE FROM roteiros WHERE id = $1`, [texto(p, "id")]);
  },
  async criarDiaRoteiro(p, c) {
    const data = texto(p, "data");
    await dataOcupada(c, data);
    const { semana, diaSemana } = await posicaoNaAgenda(c, data);
    const novo: Roteiro = {
      id: novoId(), semana, diaSemana, data,
      cidade: String(p.cidade ?? ""), titulo: String(p.titulo ?? ""),
      paradas: [], tardeLivre: diaSemana === 5,
    };
    await c.query(
      `INSERT INTO roteiros (id, semana, "diaSemana", data, cidade, titulo, paradas, "tardeLivre")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [novo.id, novo.semana, novo.diaSemana, novo.data, novo.cidade, novo.titulo, "[]",
       novo.tardeLivre],
    );
    return novo;
  },
  async reagendarRoteiro(p, c) {
    const id = texto(p, "id");
    const data = texto(p, "novaData");
    const r = await lerRoteiro(c, id);
    if (!r || r.data === data) return;
    await dataOcupada(c, data, id);
    const { semana, diaSemana } = await posicaoNaAgenda(c, data);
    await atualizar(c, "roteiros", id, { data, semana, diaSemana });
  },
  async duplicarRoteiro(p, c) {
    const id = texto(p, "id");
    const data = texto(p, "novaData");
    const r = await lerRoteiro(c, id);
    if (!r) throw new Error("Dia não encontrado.");
    await dataOcupada(c, data);
    const { semana, diaSemana } = await posicaoNaAgenda(c, data);

    const copia: Roteiro = {
      ...r, id: novoId(), data, semana, diaSemana,
      paradas: r.paradas.map((x) => ({
        ordem: x.ordem, clienteId: x.clienteId, horarioSugerido: x.horarioSugerido,
        objetivo: x.objetivo, fixa: x.fixa, concluida: false,
      })),
    };
    await c.query(
      `INSERT INTO roteiros (id, semana, "diaSemana", data, cidade, titulo, paradas,
         "tardeLivre", observacao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [copia.id, copia.semana, copia.diaSemana, copia.data, copia.cidade, copia.titulo,
       JSON.stringify(copia.paradas), copia.tardeLivre, copia.observacao ?? null],
    );
    return copia;
  },

  /**
   * Restaura um backup: substitui tudo, numa transação.
   *
   * Substituição e não mesclagem, pelo mesmo motivo da versão local — mesclar
   * deixaria registros que não estão no arquivo, e o resultado não seria nem o
   * backup nem o que havia antes. A ordem de inserção respeita as chaves
   * estrangeiras: cliente antes do que aponta para ele.
   */
  async aplicarBackup(p, c) {
    const d = (p.dados ?? {}) as Record<string, Record<string, unknown>[]>;
    const tabelas = ["clientes", "interacoes", "pedidos", "notas", "tarefas", "roteiros", "meta"];
    for (const t of tabelas) {
      if (d[t] !== undefined && !Array.isArray(d[t])) {
        throw new Error(`A tabela "${t}" do backup está corrompida.`);
      }
    }

    // Apaga na ordem inversa das dependências.
    for (const t of [...tabelas].reverse()) await c.query(`DELETE FROM ${t}`);

    const JSONB: Record<string, string[]> = {
      clientes: ["contatoPrincipal", "produtosInteresse", "tags"],
      interacoes: ["produtosApresentados", "contatoFalado", "amostraDeixada", "encerramento"],
      pedidos: ["itens"],
      notas: ["tags"],
      tarefas: [],
      roteiros: ["paradas"],
      meta: ["valor"],
    };

    let total = 0;
    for (const t of tabelas) {
      for (const linha of d[t] ?? []) {
        const chaves = Object.keys(linha);
        const desconhecida = chaves.find((k) => !COLUNAS_COMPLETAS[t].includes(k));
        if (desconhecida) {
          throw new Error(`Backup traz campo desconhecido em "${t}": "${desconhecida}".`);
        }
        const valores = chaves.map((k) =>
          JSONB[t].includes(k) ? JSON.stringify(linha[k] ?? null) : (linha[k] ?? null),
        );
        await c.query(
          `INSERT INTO ${t} (${chaves.map((k) => `"${k}"`).join(", ")})
           VALUES (${chaves.map((_, i) => `$${i + 1}`).join(", ")})`,
          valores,
        );
        total += 1;
      }
    }
    return total;
  },

  /** Motor da seção 7: lê o estado, chama a função pura e grava os dias novos. */
  async gerarProximaSemana(_p, c) {
    const { rows: existentes } = await c.query<Roteiro>(`SELECT * FROM roteiros`);
    if (!existentes.length) throw new Error("Não há semana anterior para continuar.");

    const ultimaData = existentes.reduce((m, r) => (r.data > m ? r.data : m), existentes[0].data);
    const semana = Math.max(...existentes.map((r) => r.semana)) + 1;
    const segunda = addDias(segundaDaSemana(ultimaData), 7);
    if (existentes.some((r) => r.semana === semana)) {
      throw new Error(`A semana ${semana} já existe.`);
    }

    const [{ rows: clientes }, { rows: tarefas }] = await Promise.all([
      c.query<Cliente>(`SELECT * FROM clientes`),
      c.query<Tarefa>(`SELECT * FROM tarefas WHERE concluida = FALSE`),
    ]);

    const resultado = gerarSemana({
      semana, segunda, clientes, tarefas,
      jaAgendados: new Set(
        existentes.filter((r) => r.data >= segunda).flatMap((r) => r.paradas.map((x) => x.clienteId)),
      ),
      config: await lerConfig(c),
    });

    for (const r of resultado.roteiros) {
      await c.query(
        `INSERT INTO roteiros (id, semana, "diaSemana", data, cidade, titulo, paradas,
           "tardeLivre", observacao)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (data) DO NOTHING`,
        [r.id, r.semana, r.diaSemana, r.data, r.cidade, r.titulo,
         JSON.stringify(r.paradas), r.tardeLivre, r.observacao ?? null],
      );
    }
    return resultado;
  },
};

/** Executa uma ação nomeada dentro de uma transação. */
export async function executar(nome: string, payload: Payload): Promise<unknown> {
  const acao = ACOES[nome];
  if (!acao) throw new Error(`Ação desconhecida: ${nome}`);
  return transacao((c) => acao(payload, c));
}

export const NOMES_ACOES = Object.keys(ACOES);
