"use client";

/**
 * Provedor de dados — substitui o Dexie por conversas com o servidor.
 *
 * Três decisões que fazem esta troca caber sem reescrever as telas:
 *
 * 1. **Carrega tudo uma vez e guarda em memória.** É o mesmo que o Dexie fazia
 *    na prática: toda tela lia a tabela inteira e filtrava. Então os filtros,
 *    ordenações e agregações que já existem continuam valendo sem tocar em nada.
 *
 * 2. **`undefined` enquanto carrega.** O `useLiveQuery` devolvia `undefined`
 *    antes do primeiro resultado, e as telas todas testam `=== undefined` para
 *    mostrar "Carregando…". Manter esse contrato preservou essas verificações.
 *
 * 3. **Toda escrita devolve o banco novo.** O servidor responde à ação com o
 *    estado relido, e aqui ele substitui o anterior de uma vez. Nenhuma tela
 *    precisa saber o que invalidar — e registrar uma visita mexe em interação,
 *    cliente, tarefa e roteiro ao mesmo tempo.
 *
 * O que se perdeu junto com o Dexie: funcionar sem rede. Foi decisão do usuário,
 * com o custo declarado.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { registrarAcesso, type Dados } from "@/lib/api";

const CHAVE_SENHA = "campo-senha";

/** Tabelas vazias: forma estável para o código que roda antes do primeiro carregamento. */
const VAZIO: Dados = {
  clientes: [],
  interacoes: [],
  pedidos: [],
  notas: [],
  tarefas: [],
  roteiros: [],
  meta: [],
};

interface Estado {
  /** `undefined` até o primeiro carregamento — mesmo contrato do useLiveQuery. */
  dados: Dados | undefined;
  erro: string;
  /** Verdadeiro quando o servidor está sem `SENHA_APP` configurada. */
  semSenha: boolean;
  recarregar: () => Promise<void>;
}

const Ctx = createContext<Estado | null>(null);

export function ProvedorDados({ children }: { children: React.ReactNode }) {
  const [dados, setDados] = useState<Dados | undefined>(undefined);
  const [erro, setErro] = useState("");
  const [semSenha, setSemSenha] = useState(false);
  const [pedindoSenha, setPedindoSenha] = useState(false);
  const [senha, setSenha] = useState("");

  /** Executa a chamada e centraliza o tratamento de 401 e de erro de rede. */
  const chamar = useCallback(
    async (url: string, init?: RequestInit): Promise<Record<string, unknown>> => {
      const guardada =
        typeof localStorage === "undefined" ? "" : (localStorage.getItem(CHAVE_SENHA) ?? "");

      const r = await fetch(url, {
        ...init,
        headers: {
          "content-type": "application/json",
          "x-campo-senha": guardada,
          ...(init?.headers ?? {}),
        },
      });

      if (r.status === 401) {
        setPedindoSenha(true);
        throw new Error("Senha necessária.");
      }
      const corpo = (await r.json()) as Record<string, unknown>;
      if (!r.ok) throw new Error(String(corpo.erro ?? `Falha ${r.status}`));

      if (typeof corpo.semSenha === "boolean") setSemSenha(corpo.semSenha);
      if (corpo.dados) setDados(corpo.dados as Dados);
      return corpo;
    },
    [],
  );

  const recarregar = useCallback(async () => {
    setErro("");
    try {
      await chamar("/api/dados");
      setPedindoSenha(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "Senha necessária.") setErro(msg);
    }
  }, [chamar]);

  // O executor das escritas fica registrado num módulo para que as funções de
  // lib/api.ts tenham a mesma assinatura de antes — as telas seguem chamando
  // `criarNota(...)` sem saber que virou requisição.
  useEffect(() => {
    registrarAcesso({
      executar: async (acao, payload) => {
        const corpo = await chamar("/api/acao", {
          method: "POST",
          body: JSON.stringify({ acao, payload }),
        });
        return corpo.resultado;
      },
      instantaneo: () => dados ?? VAZIO,
    });
  }, [chamar, dados]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const valor = useMemo<Estado>(
    () => ({ dados, erro, semSenha, recarregar }),
    [dados, erro, semSenha, recarregar],
  );

  if (pedindoSenha) {
    return (
      <main className="mx-auto max-w-sm p-6">
        <h1 className="text-xl font-bold">Campo</h1>
        <p className="mt-1 text-sm text-tinta-fraca">
          Este aparelho ainda não tem a senha. Ela é pedida uma vez.
        </p>
        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            localStorage.setItem(CHAVE_SENHA, senha);
            setSenha("");
            void recarregar();
          }}
        >
          <input
            type="password"
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
            className="w-full rounded-md border border-borda bg-carta p-3"
          />
          <button
            type="submit"
            disabled={!senha}
            className="w-full rounded-md bg-marca py-3 font-bold text-white disabled:opacity-40"
          >
            Entrar
          </button>
          {erro && <p className="text-sm font-semibold text-perigo">{erro}</p>}
        </form>
      </main>
    );
  }

  return (
    <Ctx.Provider value={valor}>
      {semSenha && (
        <p className="bg-alerta px-4 py-2 text-center text-xs font-bold text-white">
          App sem senha — qualquer pessoa com o endereço vê seus clientes.
          Configure SENHA_APP na Vercel.
        </p>
      )}
      {erro && (
        <div className="border-b border-perigo bg-perigo/10 px-4 py-2">
          <p className="text-sm font-semibold text-perigo">Sem conexão com o servidor.</p>
          <p className="text-xs text-tinta-fraca">{erro}</p>
          <button
            type="button"
            onClick={() => void recarregar()}
            className="mt-1 min-h-9 rounded-md border border-perigo px-3 text-xs font-bold text-perigo"
          >
            Tentar de novo
          </button>
        </div>
      )}
      {children}
    </Ctx.Provider>
  );
}

export function useEstado(): Estado {
  const c = useContext(Ctx);
  if (!c) throw new Error("useEstado fora do ProvedorDados.");
  return c;
}

/**
 * As tabelas carregadas, ou `undefined` enquanto o primeiro carregamento não
 * volta. É o substituto direto do `useLiveQuery` nas telas.
 */
export function useDados(): Dados | undefined {
  return useEstado().dados;
}
