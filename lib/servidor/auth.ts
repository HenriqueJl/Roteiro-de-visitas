/**
 * Controle de acesso: uma senha, um usuário.
 *
 * Não há cadastro nem sessão de verdade — a senha vem de `SENHA_APP` e o cliente
 * a manda em todo pedido. Para um app de um vendedor isso é suficiente e custa
 * uma tela; login com e-mail seria mais uma barreira entre ele e a visita.
 *
 * **Quando `SENHA_APP` não está configurada, o acesso é liberado** e a resposta
 * carrega `semSenha: true` para a interface avisar em cima da tela. A alternativa
 * — recusar tudo — deixaria o app morto até alguém mexer no painel da Vercel, o
 * que é pior do que um aviso visível. Mas é um estado para sair rápido: são
 * dados de clientes, contatos e preços praticados.
 */

import { timingSafeEqual } from "node:crypto";

export const CABECALHO_SENHA = "x-campo-senha";

function senhaEsperada(): string | null {
  const s = process.env.SENHA_APP?.trim();
  return s ? s : null;
}

export function exigeSenha(): boolean {
  return senhaEsperada() !== null;
}

/** Comparação em tempo constante — evita descobrir a senha medindo respostas. */
function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export interface Autorizacao {
  ok: boolean;
  /** Verdadeiro quando não há senha configurada — a tela mostra o aviso. */
  semSenha: boolean;
}

export function autorizar(req: Request): Autorizacao {
  const esperada = senhaEsperada();
  if (!esperada) return { ok: true, semSenha: true };

  const enviada = req.headers.get(CABECALHO_SENHA) ?? "";
  return { ok: iguais(enviada, esperada), semSenha: false };
}

/** Resposta padrão de senha errada. 401 para a tela saber pedir de novo. */
export function naoAutorizado(): Response {
  return Response.json({ erro: "Senha incorreta." }, { status: 401 });
}
