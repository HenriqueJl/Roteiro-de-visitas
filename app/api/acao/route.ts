/**
 * `POST /api/acao` — toda escrita passa por aqui.
 *
 * Corpo: `{ acao: "registrarInteracao", payload: {...} }`.
 *
 * Devolve o resultado da ação **e** o banco relido. Parece desperdício e é o
 * contrário: sem isso, cada tela precisaria decidir o que invalidar depois de
 * cada escrita — e registrar uma visita mexe em interação, cliente, tarefa e
 * roteiro ao mesmo tempo. Devolvendo o estado novo, a tela troca tudo de uma vez
 * e nunca mostra metade antiga. Com este volume de dados, é uma consulta rápida.
 */

import { autorizar, naoAutorizado } from "@/lib/servidor/auth";
import { executar } from "@/lib/servidor/acoes";
import { lerTudo } from "@/lib/servidor/repo";
import { garantirSchema } from "@/lib/servidor/sql";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = autorizar(req);
  if (!auth.ok) return naoAutorizado();

  let corpo: { acao?: string; payload?: Record<string, unknown> };
  try {
    corpo = await req.json();
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  if (!corpo.acao) return Response.json({ erro: "Falta a ação." }, { status: 400 });

  try {
    await garantirSchema();
    const resultado = await executar(corpo.acao, corpo.payload ?? {});
    return Response.json({ resultado, dados: await lerTudo(), semSenha: auth.semSenha });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 400 e não 500: a maioria destes erros é regra de negócio recusando a
    // escrita (P2 sem próximo passo, data de roteiro ocupada) — a tela mostra a
    // mensagem ao usuário, e ela precisa chegar legível.
    console.error(`POST /api/acao (${corpo.acao}) recusou:`, msg);
    return Response.json({ erro: msg }, { status: 400 });
  }
}
