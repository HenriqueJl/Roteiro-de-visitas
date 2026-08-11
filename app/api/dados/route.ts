/**
 * `GET /api/dados` — o banco inteiro numa resposta.
 *
 * Também é aqui que o schema e a carga inicial são garantidos: a primeira
 * abertura do app cria as tabelas e semeia os 43 clientes com o roteiro da
 * próxima semana. Sem passo de deploy, sem comando manual — abrir o app basta.
 *
 * `dynamic = "force-dynamic"` porque a resposta depende do banco e não pode ser
 * cacheada: dois aparelhos veriam versões diferentes do mesmo dado, que é
 * exatamente o problema que a nuvem vem resolver.
 */

import { autorizar, exigeSenha, naoAutorizado } from "@/lib/servidor/auth";
import { lerTudo } from "@/lib/servidor/repo";
import { garantirSeed } from "@/lib/servidor/seed";
import { garantirSchema } from "@/lib/servidor/sql";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = autorizar(req);
  if (!auth.ok) return naoAutorizado();

  try {
    await garantirSchema();
    const seed = await garantirSeed();
    const dados = await lerTudo();

    return Response.json({
      dados,
      // A tela usa para mostrar o aviso de app sem proteção.
      semSenha: auth.semSenha,
      // Só informativo: quantos registros a carga inicial criou nesta chamada.
      seed: seed.clientes || seed.roteiros ? seed : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("GET /api/dados falhou:", msg);
    return Response.json({ erro: msg }, { status: 500 });
  }
}

/** Sonda de saúde: diz se há banco configurado sem devolver dado nenhum. */
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { "x-campo-senha-exigida": exigeSenha() ? "1" : "0" },
  });
}
