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
import { executar } from "../lib/servidor/acoes";
import { lerTudo } from "../lib/servidor/repo";
import { consultar, pool } from "../lib/servidor/sql";
import { addDias, hoje } from "../lib/datas";

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

// ------------------------------------------------------- P2 no servidor
secao("P2 — próximo passo obrigatório, imposto pelo servidor");
const semPasso = executar("registrarInteracao", {
  clienteId: "animal-shop", tipo: "visita", resultado: "interesse",
});
let recusou = "";
await semPasso.catch((e) => { recusou = e.message; });
ok(/próximo passo/i.test(recusou), `servidor recusa sem próximo passo ("${recusou}")`);

const nada = await consultar(`SELECT 1 FROM interacoes`);
ok(nada.length === 0, "nada foi gravado na recusa (transação desfeita)");

const semMotivo = executar("registrarInteracao", {
  clienteId: "animal-shop", tipo: "visita", resultado: "sem_interesse",
  encerramento: { status: "sem_potencial", motivo: "  " },
});
recusou = "";
await semMotivo.catch((e) => { recusou = e.message; });
ok(/por que/i.test(recusou), `escape de P2 exige motivo ("${recusou}")`);

// ------------------------------------------------------- P3 no servidor
secao("P3 — amostra cria dívida, na mesma transação");
const retorno = addDias(hoje(), 7);
await executar("registrarInteracao", {
  clienteId: "animal-shop", tipo: "visita", resultado: "interesse",
  objecao: "preco", proximoPasso: "Levar proposta", proximoPassoEm: addDias(hoje(), 3),
  amostraDeixada: { produto: "xoxixi_250g", qtd: 2, retornoEm: retorno },
  contatoFalado: { nome: "Dona Marta", cargo: "proprietária" },
});

const tarefas = await consultar<{ origem: string; vencimentoEm: string; titulo: string }>(
  `SELECT origem, "vencimentoEm", titulo FROM tarefas ORDER BY origem`,
);
ok(tarefas.length === 2, `duas tarefas criadas (${tarefas.map((t) => t.origem).join(", ")})`);
const amostra = tarefas.find((t) => t.origem === "retorno_amostra");
ok(amostra?.vencimentoEm === retorno, `retorno da amostra em D+7 (${amostra?.vencimentoEm})`);
ok(/Retorno da amostra/.test(amostra?.titulo ?? ""), `título da tarefa: "${amostra?.titulo}"`);

const cli2 = await consultar<{ estagio: string; proximoContatoEm: string; ultimoContatoEm: Date }>(
  `SELECT estagio, "proximoContatoEm", "ultimoContatoEm" FROM clientes WHERE id='animal-shop'`,
);
ok(cli2[0].estagio === "material_deixado",
   `estágio avançou pela amostra (${cli2[0].estagio})`);
ok(!!cli2[0].ultimoContatoEm, "último contato registrado no cliente");

// a parada do roteiro é marcada quando a visita nasce do roteiro
const dia1 = await consultar<{ id: string }>(`SELECT id FROM roteiros ORDER BY data LIMIT 1`);
await executar("registrarInteracao", {
  clienteId: "agropet", tipo: "visita", resultado: "pedido",
  proximoPasso: "Acompanhar entrega", proximoPassoEm: addDias(hoje(), 7),
  roteiroId: dia1[0].id,
});
const rot = await consultar<{ paradas: { clienteId: string; concluida: boolean }[] }>(
  `SELECT paradas FROM roteiros WHERE id = $1`, [dia1[0].id],
);
const parada = rot[0].paradas.find((x) => x.clienteId === "agropet");
ok(parada?.concluida === true, "parada do roteiro marcada como concluída");

// ------------------------------------------------------- pedido e preços
secao("Pedido");
const ped = (await executar("criarPedido", {
  clienteId: "animal-shop", data: hoje(), status: "faturado", formaPagamento: "pix",
  prazoDias: 0, observacoes: "",
  itens: [{ produto: "xoxixi_250g", quantidade: 10, precoUnitario: 19.9, desconto: 10 }],
})) as { valorTotal: number };
ok(Math.abs(ped.valorTotal - 179.1) < 0.001, `total com desconto (${ped.valorTotal})`);

const cfg = await consultar<{ valor: { precoPorProduto: Record<string, number> } }>(
  `SELECT valor FROM meta WHERE chave='config'`,
);
ok(cfg[0].valor.precoPorProduto.xoxixi_250g === 19.9,
   `preço praticado memorizado (${cfg[0].valor.precoPorProduto.xoxixi_250g})`);

const guardado = await consultar<{ valorTotal: number }>(`SELECT "valorTotal" FROM pedidos`);
ok(typeof guardado[0].valorTotal === "number",
   `NUMERIC volta como número, não string (${typeof guardado[0].valorTotal})`);

// ------------------------------------------------------- rotas do dia
secao("Ferramentas de rota pelo servidor");
await executar("distribuirHorariosDoDia", {
  roteiroId: dia1[0].id, inicio: "08:00", intervaloMin: 45,
});
const h = await consultar<{ paradas: { horarioSugerido: string; ordem: number }[] }>(
  `SELECT paradas FROM roteiros WHERE id=$1`, [dia1[0].id],
);
const horas = [...h[0].paradas].sort((a, b) => a.ordem - b.ordem).map((x) => x.horarioSugerido);
ok(horas[0] === "08:00" && horas[1] === "08:45", `horários distribuídos (${horas.join(" ")})`);

const trocaram = (await executar("reordenarDiaPorProximidade", { roteiroId: dia1[0].id })) as number;
ok(typeof trocaram === "number", `reordenou e informou ${trocaram} troca(s)`);

const copia = (await executar("duplicarRoteiro", {
  id: dia1[0].id, novaData: addDias(hoje(), 21),
})) as { id: string; paradas: { concluida: boolean }[] };
ok(copia.paradas.every((x) => !x.concluida), "cópia do dia vem como não visitada");

let colidiu = "";
await executar("duplicarRoteiro", { id: dia1[0].id, novaData: addDias(hoje(), 21) })
  .catch((e) => { colidiu = e.message; });
ok(/Já existe um dia/.test(colidiu), `recusa data ocupada ("${colidiu}")`);

// ------------------------------------------------------- lista branca
secao("Lista branca de colunas");
let injecao = "";
await executar("atualizarCliente", { id: "animal-shop", patch: { "nome; DROP TABLE clientes": "x" } })
  .catch((e) => { injecao = e.message; });
ok(/não pode ser alterado/.test(injecao), `campo desconhecido é recusado ("${injecao.slice(0, 60)}")`);
const aindaTem = await consultar(`SELECT 1 FROM clientes LIMIT 1`);
ok(aindaTem.length === 1, "tabela clientes intacta");

// ------------------------------------------------------- leitura completa
secao("Leitura completa");
const tudo = await lerTudo();
ok(tudo.clientes.length === 43, `clientes (${tudo.clientes.length})`);
ok(tudo.interacoes.length === 2, `interações (${tudo.interacoes.length})`);
ok(tudo.pedidos.length === 1, `pedidos (${tudo.pedidos.length})`);
ok(tudo.roteiros.length === 6, `roteiros, com a cópia (${tudo.roteiros.length})`);
const semNulo = tudo.clientes.find((x) => x.id === "opus-medical");
ok(!("contatoPrincipal" in (semNulo as object)),
   "campo nulo é omitido, não vira null (forma igual à versão local)");

console.log(falhas.length ? `\n>>> ${falhas.length} FALHA(S)` : "\n>>> BANCO OK");
await pool().end();
process.exit(falhas.length ? 1 : 0);
