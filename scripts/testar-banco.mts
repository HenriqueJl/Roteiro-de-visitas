/**
 * Verificação da camada de banco contra um Postgres real.
 *
 * Roda fora do Next, direto no Node, para poder exercitar o schema, o seed e as
 * ações do servidor sem subir a aplicação inteira. Uso:
 *
 *   DATABASE_URL="postgresql://campo@localhost:5433/campo" npx tsx scripts/testar-banco.mts
 *
 * Existe porque a migração para a nuvem se prova aqui, e não na produção: o
 * mesmo driver `pg` fala com este Postgres local e com o Neon.
 */

import { readFileSync } from "node:fs";
import { proximaSegunda } from "../lib/datas";
import { garantirSeed } from "../lib/servidor/seed";
import { consultar, pool } from "../lib/servidor/sql";

const falhas: string[] = [];
function ok(condicao: boolean, msg: string) {
  console.log(`  ${condicao ? "PASS" : "FALHA"}  ${msg}`);
  if (!condicao) falhas.push(msg);
}
const secao = (t: string) => console.log(`\n=== ${t} ===`);

// ---------------------------------------------------------------- schema
secao("Schema");
const sql = readFileSync("lib/servidor/schema.sql", "utf8");
await pool().query(sql);
await pool().query(sql); // idempotência
ok(true, "schema aplica duas vezes sem erro");

await pool().query("TRUNCATE clientes, interacoes, pedidos, notas, tarefas, roteiros, meta CASCADE");

// ---------------------------------------------------------------- seed
secao("Carga inicial");
const r1 = await garantirSeed();
ok(r1.clientes === 43, `43 clientes semeados (${r1.clientes})`);
ok(r1.roteiros === 5, `5 dias de roteiro (${r1.roteiros})`);
ok(r1.segunda === proximaSegunda(), `ancorado na próxima segunda (${r1.segunda})`);

const r2 = await garantirSeed();
ok(r2.clientes === 0 && r2.roteiros === 0, "segunda carga não duplica nada");

const dias = await consultar<{ data: string; diaSemana: number; paradas: number }>(
  `SELECT data, "diaSemana", jsonb_array_length(paradas)::int AS paradas
     FROM roteiros ORDER BY data`,
);
ok(dias.length === 5, `5 dias no banco (${dias.length})`);
ok(dias[0].data === proximaSegunda(), `primeiro dia é a segunda (${dias[0].data})`);
ok(
  dias.every((d, i) => d.diaSemana === i + 1),
  `dias da semana em ordem (${dias.map((d) => d.diaSemana).join(",")})`,
);
ok(
  dias.every((d) => d.paradas >= 5),
  `todos os dias com paradas (${dias.map((d) => d.paradas).join(",")})`,
);

// O parser de DATE tem de devolver string, senão o app perde um dia no fuso.
ok(typeof dias[0].data === "string", `DATE volta como string, não Date (${typeof dias[0].data})`);

// ---------------------------------------------------------------- tipos
secao("Fidelidade dos tipos");
const cli = await consultar<{
  id: string; lat: number | null; tags: unknown; produtosInteresse: unknown; criadoEm: Date;
}>(`SELECT id, lat, tags, "produtosInteresse", "criadoEm" FROM clientes WHERE id = 'hosp-sao-sebastiao'`);
ok(cli.length === 1, "cliente do seed encontrado por id");
ok(typeof cli[0].lat === "number" && cli[0].lat < 0, `lat é número negativo (${cli[0].lat})`);
ok(Array.isArray(cli[0].tags), "tags volta como array de verdade (JSONB)");
ok(Array.isArray(cli[0].produtosInteresse), "produtosInteresse volta como array");

const paradas = await consultar<{ paradas: { clienteId: string; horarioSugerido: string }[] }>(
  `SELECT paradas FROM roteiros ORDER BY data LIMIT 1`,
);
ok(Array.isArray(paradas[0].paradas), "paradas volta como array");
ok(
  typeof paradas[0].paradas[0]?.horarioSugerido === "string",
  `parada preserva o horário (${paradas[0].paradas[0]?.horarioSugerido})`,
);

console.log(falhas.length ? `\n>>> ${falhas.length} FALHA(S)` : "\n>>> BANCO OK");
await pool().end();
process.exit(falhas.length ? 1 : 0);
