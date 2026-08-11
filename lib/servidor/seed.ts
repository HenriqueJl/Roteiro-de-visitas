/**
 * Carga inicial no Postgres.
 *
 * Duas diferenças em relação ao seed local que ela substitui:
 *
 * 1. **As datas do roteiro não são mais fixas.** O seed original datava a
 *    semana 1 em 03–07/08/2026; quem abrisse depois daquela semana encontrava um
 *    plano vencido e a tela Hoje vazia — foi exatamente o que aconteceu. Agora a
 *    semana é ancorada na **próxima segunda-feira**, então o roteiro sempre nasce
 *    à frente de quem o abre. Os dias da semana, os horários e os objetivos são
 *    os mesmos; só o calendário se move.
 *
 * 2. **Idempotente por registro, e não por marcador.** `ON CONFLICT DO NOTHING`
 *    em cada linha: rodar de novo não duplica nem sobrescreve o que o usuário já
 *    editou. Isso importa mais aqui do que no IndexedDB, porque em serverless
 *    esta função pode ser chamada por duas requisições ao mesmo tempo.
 */

import { agora, addDias, proximaSegunda } from "../datas";
import { CLIENTES_SEED, SEMANA_1, VERSAO_SEED } from "../seed";
import { funilDoTipo, type Cliente, type ParadaRoteiro, type Roteiro } from "../types";
import { transacao } from "./sql";

export interface ResultadoSeed {
  clientes: number;
  roteiros: number;
  /** Segunda-feira em que a semana inicial foi ancorada. */
  segunda: string | null;
}

function montarCliente(l: (typeof CLIENTES_SEED)[number], criadoEm: string): Cliente {
  return {
    id: l.id,
    nome: l.nome,
    tipo: l.tipo,
    cidade: l.cidade,
    bairro: l.bairro,
    endereco: l.endereco,
    telefone: l.telefone,
    lat: l.lat,
    lng: l.lng,
    funil: funilDoTipo(l.tipo),
    estagio: "prospect",
    status: "ativo",
    produtosInteresse: [],
    tags: [],
    criadoEm,
    observacoes: "",
  };
}

/**
 * Roteiros da semana 1 com as datas deslocadas para a semana de `segunda`.
 * O id carrega a segunda de referência para que, se algum dia a carga rodar de
 * novo em outra semana, ela não colida com a anterior.
 */
function montarRoteiros(segunda: string): Roteiro[] {
  return SEMANA_1.map((d) => {
    const paradas: ParadaRoteiro[] = d.paradas.map(([clienteId, horario, objetivo], i) => ({
      ordem: i + 1,
      clienteId,
      horarioSugerido: horario,
      objetivo,
      concluida: false,
    }));
    return {
      id: `r-${segunda}-d${d.diaSemana}`,
      semana: 1,
      diaSemana: d.diaSemana,
      data: addDias(segunda, d.diaSemana - 1),
      cidade: d.cidade,
      titulo: d.titulo,
      paradas,
      tardeLivre: d.tardeLivre,
      observacao: d.observacao,
    };
  });
}

/**
 * Insere o que falta e nada mais. Devolve quantos registros nasceram — zero na
 * segunda chamada em diante.
 */
export async function garantirSeed(): Promise<ResultadoSeed> {
  return transacao(async (c) => {
    const criadoEm = agora();

    // Só semeia clientes se a tabela estiver vazia. Um cliente apagado de
    // propósito não deve voltar a cada abertura do app.
    const { rows: contagem } = await c.query<{ n: string }>("SELECT count(*) AS n FROM clientes");
    const vazio = Number(contagem[0].n) === 0;

    let clientes = 0;
    if (vazio) {
      for (const linha of CLIENTES_SEED) {
        const cl = montarCliente(linha, criadoEm);
        const r = await c.query(
          `INSERT INTO clientes (id, nome, tipo, cidade, bairro, endereco, telefone,
             lat, lng, funil, estagio, status, "produtosInteresse", tags,
             "criadoEm", observacoes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           ON CONFLICT (id) DO NOTHING`,
          [
            cl.id, cl.nome, cl.tipo, cl.cidade, cl.bairro, cl.endereco, cl.telefone,
            cl.lat ?? null, cl.lng ?? null, cl.funil, cl.estagio, cl.status,
            JSON.stringify(cl.produtosInteresse), JSON.stringify(cl.tags),
            cl.criadoEm, cl.observacoes,
          ],
        );
        clientes += r.rowCount ?? 0;
      }
    }

    // O roteiro inicial só entra se não houver roteiro nenhum: depois da
    // primeira semana, quem manda na agenda é o usuário.
    const { rows: qtdRot } = await c.query<{ n: string }>("SELECT count(*) AS n FROM roteiros");
    if (Number(qtdRot[0].n) > 0) return { clientes, roteiros: 0, segunda: null };

    const segunda = proximaSegunda();
    let roteiros = 0;
    for (const r of montarRoteiros(segunda)) {
      const res = await c.query(
        `INSERT INTO roteiros (id, semana, "diaSemana", data, cidade, titulo,
           paradas, "tardeLivre", observacao)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (data) DO NOTHING`,
        [
          r.id, r.semana, r.diaSemana, r.data, r.cidade, r.titulo,
          JSON.stringify(r.paradas), r.tardeLivre, r.observacao ?? null,
        ],
      );
      roteiros += res.rowCount ?? 0;
    }

    await c.query(
      `INSERT INTO meta (chave, valor) VALUES ('seed', $1)
       ON CONFLICT (chave) DO UPDATE SET valor = $1`,
      [JSON.stringify({ versao: VERSAO_SEED, aplicadoEm: criadoEm, segunda })],
    );

    return { clientes, roteiros, segunda };
  });
}
