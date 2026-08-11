/**
 * Conexão com o Postgres. Só roda no servidor.
 *
 * Driver `pg` e não `@neondatabase/serverless`: o `pg` fala o protocolo padrão,
 * então o mesmo código serve o Neon em produção e um Postgres local nos testes.
 * Uma implementação, não duas — e dá para verificar a migração inteira antes de
 * apontar para o banco de verdade.
 *
 * Pool em variável global porque em serverless o módulo é reavaliado a cada
 * invocação fria, e um pool novo por requisição esgotaria as conexões do Neon.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool, types, type PoolClient } from "pg";

/**
 * DATE volta como string, não como Date.
 *
 * O app trata dia como `DataCivil` ("AAAA-MM-DD") justamente para não passar
 * por fuso horário — ver o cabeçalho de lib/datas.ts. Se o driver convertesse
 * para `Date`, "2026-08-03" viraria meia-noite UTC e no Brasil apareceria como
 * dia 2. 1082 é o OID de DATE.
 */
types.setTypeParser(1082, (v) => v);

/** NUMERIC volta como string por padrão (para não perder precisão). Aqui os
 *  valores são reais em centavos, dentro do seguro do float — convertemos. */
types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

const global_ = globalThis as unknown as { poolCampo?: Pool };

function urlDoBanco(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL_UNPOOLED;
  if (!url) {
    throw new Error(
      "DATABASE_URL não configurada. Sem ela o app não tem onde guardar dados.",
    );
  }
  return url;
}

export function pool(): Pool {
  if (!global_.poolCampo) {
    const url = urlDoBanco();
    global_.poolCampo = new Pool({
      connectionString: url,
      // O Neon exige TLS; o Postgres local do teste não tem certificado.
      ssl: url.includes("localhost") || url.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return global_.poolCampo;
}

export async function consultar<T = Record<string, unknown>>(
  sql: string,
  valores: unknown[] = [],
): Promise<T[]> {
  const r = await pool().query(sql, valores);
  return r.rows as T[];
}

/**
 * Transação. É o que sustenta P2 e P3 no servidor: registrar interação grava a
 * interação, move o cliente e cria as tarefas, ou não grava nada.
 */
export async function transacao<T>(
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

let schemaPronto: Promise<void> | null = null;

/**
 * Garante o schema uma vez por processo.
 *
 * Sem ferramenta de migração: o schema é idempotente (`CREATE TABLE IF NOT
 * EXISTS`) e roda na primeira requisição. Para um app de um usuário isso troca
 * uma dependência e um passo de build por três linhas — e o dia em que a
 * evolução do schema exigir mais que isso, entra migração de verdade.
 */
export function garantirSchema(): Promise<void> {
  if (!schemaPronto) {
    schemaPronto = (async () => {
      const arquivo = path.join(process.cwd(), "lib", "servidor", "schema.sql");
      await pool().query(await readFile(arquivo, "utf8"));
    })().catch((e) => {
      // Não memoriza a falha: a próxima requisição tenta de novo, senão um
      // soluço de rede no primeiro acesso derrubaria o app até o redeploy.
      schemaPronto = null;
      throw e;
    });
  }
  return schemaPronto;
}
