"use client";

/**
 * Bottom sheet "Registrar visita" — o fluxo crítico do app (seção 6.2).
 *
 * Três etapas, uma por tela, botões grandes. O caminho mínimo:
 *   Registrar → Pedido → Salvar          (3 toques; próximo passo pré-preenchido)
 *   Registrar → resultado → objeção → sugestão → Salvar   (5 toques)
 *
 * A validação exibida aqui é a MESMA do banco (`validarInteracao`); o botão
 * desabilitado é só cortesia — quem recusa de verdade é `registrarInteracao`.
 */

import { useEffect, useState } from "react";
import { lerConfig, registrarInteracao } from "@/lib/api";
// A validação de P2 é a MESMA do servidor (lib/dominio.ts). O botão desabilitado
// é cortesia; quem recusa de verdade é `POST /api/acao`.
import { validarInteracao, type NovaInteracao } from "@/lib/dominio";
import { ATALHOS_DATA, addDias, hoje } from "@/lib/datas";
import { sugestoesProximoPasso } from "@/lib/sugestoes";
import { Icone } from "@/lib/icones";
import {
  ICONE_RESULTADO,
  LABEL_OBJECAO,
  LABEL_PRODUTO,
  LABEL_RESULTADO,
  LABEL_TIPO_INTERACAO,
  OBJECOES_POR_FUNIL,
  PRODUTOS_POR_TIPO,
  RESULTADOS,
  TIPOS_INTERACAO,
  pulaObjecao,
  type Cliente,
  type Interacao,
  type Objecao,
  type ParadaRoteiro,
  type Produto,
  type ResultadoInteracao,
  type TipoInteracao,
} from "@/lib/types";

export interface AlvoRegistro {
  cliente: Cliente;
  parada?: ParadaRoteiro;
  roteiroId?: string;
}

type Etapa = 1 | 2 | 3;

const campo = "w-full rounded-md border border-borda bg-fundo p-3";
const chip =
  "rounded-md border border-borda bg-fundo px-3 py-2 text-sm font-medium text-left";
const chipAtivo =
  "rounded-md border border-marca bg-marca px-3 py-2 text-sm font-medium text-white text-left";

export function SheetRegistro({
  alvo,
  aoFechar,
  aoSalvo,
}: {
  alvo: AlvoRegistro;
  aoFechar: () => void;
  aoSalvo: (interacao: Interacao) => void;
}) {
  const { cliente, roteiroId } = alvo;

  const [etapa, setEtapa] = useState<Etapa>(1);
  const [resultado, setResultado] = useState<ResultadoInteracao | null>(null);
  const [objecao, setObjecao] = useState<Objecao | null>(null);
  const [objecaoObs, setObjecaoObs] = useState("");

  const [proximoPasso, setProximoPasso] = useState("");
  const [proximoPassoEm, setProximoPassoEm] = useState(addDias(hoje(), 3));

  const [encerrando, setEncerrando] = useState(false);
  const [encStatus, setEncStatus] = useState<"sem_potencial" | "perdido">("sem_potencial");
  const [encMotivo, setEncMotivo] = useState("");

  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const [tipo, setTipo] = useState<TipoInteracao>("visita");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [contatoNome, setContatoNome] = useState("");
  const [contatoCargo, setContatoCargo] = useState("");
  const [notas, setNotas] = useState("");

  const [amostraAtiva, setAmostraAtiva] = useState(false);
  const [amostraProduto, setAmostraProduto] = useState<Produto>(
    PRODUTOS_POR_TIPO[cliente.tipo][0],
  );
  const [amostraQtd, setAmostraQtd] = useState(1);
  const [amostraRetorno, setAmostraRetorno] = useState(addDias(hoje(), 7));

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");

  // D+N configurável de P3.
  useEffect(() => {
    lerConfig().then((c) => setAmostraRetorno(addDias(hoje(), c.diasRetornoAmostra)));
  }, []);

  function montar(): NovaInteracao {
    return {
      clienteId: cliente.id,
      tipo,
      resultado: resultado!,
      produtosApresentados: produtos,
      ...(objecao ? { objecao } : {}),
      ...(objecao && objecaoObs.trim() ? { objecaoObs: objecaoObs.trim() } : {}),
      ...(contatoNome.trim()
        ? { contatoFalado: { nome: contatoNome.trim(), cargo: contatoCargo.trim() } }
        : {}),
      ...(notas.trim() ? { notas: notas.trim() } : {}),
      ...(amostraAtiva
        ? {
            amostraDeixada: {
              produto: amostraProduto,
              qtd: amostraQtd,
              retornoEm: amostraRetorno,
            },
          }
        : {}),
      ...(encerrando
        ? { encerramento: { status: encStatus, motivo: encMotivo.trim() } }
        : { proximoPasso: proximoPasso.trim(), proximoPassoEm }),
      ...(roteiroId ? { roteiroId } : {}),
    };
  }

  const erroValidacao = resultado ? validarInteracao(montar()) : "Escolha como foi.";

  function escolherResultado(r: ResultadoInteracao) {
    setResultado(r);
    if (r === "pedido") {
      // Pedido tem próximo passo objetivo — pré-preencher mantém o caminho
      // mínimo em 3 toques sem enfraquecer P2.
      setObjecao(null);
      if (!proximoPasso.trim()) {
        setProximoPasso("Acompanhar entrega e combinar reposição");
        setProximoPassoEm(addDias(hoje(), 7));
      }
    }
    setEtapa(pulaObjecao(r) ? 3 : 2);
  }

  function escolherObjecao(o: Objecao | null) {
    setObjecao(o);
    setEtapa(3);
  }

  async function salvar() {
    setSalvando(true);
    setErroSalvar("");
    try {
      const interacao = await registrarInteracao(montar());
      aoSalvo(interacao);
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  const TITULOS: Record<Etapa, string> = {
    1: "Como foi?",
    2: "O que travou?",
    3: encerrando ? "Encerrar cliente" : "Próximo passo",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={aoFechar}>
      <div
        className="flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-carta"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 border-b border-borda px-4 py-3">
          {etapa > 1 && (
            <button
              type="button"
              aria-label="Voltar"
              onClick={() => {
                if (encerrando) setEncerrando(false);
                else setEtapa(etapa === 3 && resultado && !pulaObjecao(resultado) ? 2 : 1);
              }}
              className="w-10 shrink-0 text-xl font-bold"
            >
              <Icone nome="seta-esquerda" tamanho={22} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{cliente.nome}</p>
            <p className="text-xs text-tinta-fraca">{TITULOS[etapa]}</p>
          </div>
          <div aria-hidden className="flex shrink-0 items-center gap-1.5">
            {([1, 2, 3] as const).map((n) => (
              <span
                key={n}
                className={`h-2 w-2 rounded-full ${n <= etapa ? "bg-marca" : "bg-borda"}`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={aoFechar}
            className="w-10 shrink-0 text-2xl text-tinta-fraca"
          >
            ×
          </button>
        </header>

        <div className="overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* ---------- Etapa 1: Como foi? ---------- */}
          {etapa === 1 && (
            <div className="grid grid-cols-2 gap-2">
              {RESULTADOS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => escolherResultado(r)}
                  className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center font-bold ${
                    resultado === r ? "border-marca bg-marca text-white" : "border-borda bg-fundo"
                  }`}
                >
                  <span aria-hidden className="text-2xl">
                    <Icone nome={ICONE_RESULTADO[r]} tamanho={24} />
                  </span>
                  <span className="text-sm leading-tight">{LABEL_RESULTADO[r]}</span>
                </button>
              ))}
            </div>
          )}

          {/* ---------- Etapa 2: O que travou? ---------- */}
          {etapa === 2 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {OBJECOES_POR_FUNIL[cliente.funil].map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => escolherObjecao(o)}
                    className={`min-h-14 rounded-lg border p-2 text-sm font-semibold leading-tight ${
                      objecao === o ? "border-marca bg-marca text-white" : "border-borda bg-fundo"
                    }`}
                  >
                    {LABEL_OBJECAO[o]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => escolherObjecao(null)}
                className="mt-3 w-full rounded-lg border border-borda py-3 font-semibold text-tinta-fraca"
              >
                Pular — nada travou
              </button>
            </>
          )}

          {/* ---------- Etapa 3: Próximo passo ---------- */}
          {etapa === 3 && !encerrando && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold" htmlFor="proximo-passo">
                  Qual é o próximo passo? *
                </label>
                <input
                  id="proximo-passo"
                  value={proximoPasso}
                  onChange={(e) => setProximoPasso(e.target.value)}
                  placeholder="Ex.: agendar demonstração"
                  className={`${campo} mt-1`}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {sugestoesProximoPasso(cliente, resultado).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setProximoPasso(s)}
                      className={proximoPasso === s ? chipAtivo : chip}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-bold">Quando? *</p>
                <div className="mt-1 grid grid-cols-4 gap-2">
                  {ATALHOS_DATA.map((a) => {
                    const data = addDias(hoje(), a.dias);
                    const ativo = proximoPassoEm === data;
                    return (
                      <button
                        key={a.rotulo}
                        type="button"
                        onClick={() => setProximoPassoEm(data)}
                        className={`rounded-md border px-1 py-2.5 text-xs font-bold ${
                          ativo ? "border-marca bg-marca text-white" : "border-borda bg-fundo"
                        }`}
                      >
                        {a.rotulo}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="date"
                  aria-label="Data do próximo passo"
                  value={proximoPassoEm}
                  min={hoje()}
                  onChange={(e) => e.target.value && setProximoPassoEm(e.target.value)}
                  className={`${campo} mt-2`}
                />
              </div>

              {/* ---------- Detalhes opcionais ---------- */}
              <button
                type="button"
                onClick={() => setDetalhesAbertos((v) => !v)}
                aria-expanded={detalhesAbertos}
                className="w-full rounded-md border border-borda py-2.5 text-sm font-semibold text-tinta-fraca"
              >
                {detalhesAbertos ? "Ocultar detalhes" : "Adicionar detalhes"}
                <Icone nome={detalhesAbertos ? "seta-cima" : "seta-baixo"} tamanho={15} className="ml-1 inline-block -mt-0.5" />
              </button>

              {detalhesAbertos && (
                <div className="space-y-4 rounded-lg border border-borda bg-fundo/60 p-3">
                  <div>
                    <p className="text-sm font-bold">Tipo</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {TIPOS_INTERACAO.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTipo(t)}
                          className={tipo === t ? chipAtivo : chip}
                        >
                          {LABEL_TIPO_INTERACAO[t]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-bold">Produtos apresentados</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {PRODUTOS_POR_TIPO[cliente.tipo].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() =>
                            setProdutos((atual) =>
                              atual.includes(p)
                                ? atual.filter((x) => x !== p)
                                : [...atual, p],
                            )
                          }
                          className={produtos.includes(p) ? chipAtivo : chip}
                        >
                          {LABEL_PRODUTO[p]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={amostraAtiva}
                        onChange={(e) => setAmostraAtiva(e.target.checked)}
                        className="h-5 w-5 accent-marca"
                      />
                      Deixei amostra
                    </label>
                    {amostraAtiva && (
                      <div className="mt-2 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {PRODUTOS_POR_TIPO[cliente.tipo].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setAmostraProduto(p)}
                              className={amostraProduto === p ? chipAtivo : chip}
                            >
                              {LABEL_PRODUTO[p]}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold">Qtd</span>
                          <button
                            type="button"
                            aria-label="Diminuir quantidade"
                            onClick={() => setAmostraQtd((q) => Math.max(1, q - 1))}
                            className="h-11 w-11 rounded-md border border-borda bg-carta text-xl font-bold"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-lg font-bold">{amostraQtd}</span>
                          <button
                            type="button"
                            aria-label="Aumentar quantidade"
                            onClick={() => setAmostraQtd((q) => q + 1)}
                            className="h-11 w-11 rounded-md border border-borda bg-carta text-xl font-bold"
                          >
                            +
                          </button>
                        </div>
                        <div>
                          <label className="text-sm font-semibold" htmlFor="amostra-retorno">
                            Volto para cobrar em
                          </label>
                          <input
                            id="amostra-retorno"
                            type="date"
                            value={amostraRetorno}
                            min={hoje()}
                            onChange={(e) => e.target.value && setAmostraRetorno(e.target.value)}
                            className={`${campo} mt-1`}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-bold">Com quem falei</p>
                    <div className="mt-1 flex gap-2">
                      <input
                        value={contatoNome}
                        onChange={(e) => setContatoNome(e.target.value)}
                        placeholder="Nome"
                        className={campo}
                      />
                      <input
                        value={contatoCargo}
                        onChange={(e) => setContatoCargo(e.target.value)}
                        placeholder="Cargo"
                        className={campo}
                      />
                    </div>
                  </div>

                  {objecao && (
                    <div>
                      <label className="text-sm font-bold" htmlFor="objecao-obs">
                        Detalhe da objeção
                      </label>
                      <input
                        id="objecao-obs"
                        value={objecaoObs}
                        onChange={(e) => setObjecaoObs(e.target.value)}
                        placeholder={LABEL_OBJECAO[objecao]}
                        className={`${campo} mt-1`}
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-bold" htmlFor="registro-notas">
                      Notas
                    </label>
                    <textarea
                      id="registro-notas"
                      rows={2}
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      className={`${campo} mt-1`}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={salvar}
                disabled={!!erroValidacao || salvando}
                className="w-full rounded-lg bg-marca py-3.5 text-lg font-bold text-white disabled:opacity-40"
              >
                {salvando ? "Salvando…" : "Salvar"}
              </button>
              {erroValidacao && resultado && (
                <p className="text-center text-sm font-semibold text-alerta">{erroValidacao}</p>
              )}
              {erroSalvar && (
                <p className="text-center text-sm font-semibold text-perigo">{erroSalvar}</p>
              )}

              <button
                type="button"
                onClick={() => setEncerrando(true)}
                className="w-full py-1 text-center text-sm font-semibold text-tinta-fraca underline"
              >
                Sem próximo passo? Encerrar cliente…
              </button>
            </div>
          )}

          {/* ---------- Etapa 3 alternativa: encerramento (escape de P2) ---------- */}
          {etapa === 3 && encerrando && (
            <div className="space-y-4">
              <p className="text-sm text-tinta-fraca">
                Encerrar tira o cliente da rota e das cobranças. Ele pode ser
                reaberto depois, se a conversa voltar.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["sem_potencial", "Sem potencial"],
                    ["perdido", "Perdido"],
                  ] as const
                ).map(([valor, rotulo]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setEncStatus(valor)}
                    className={`min-h-12 rounded-lg border font-bold ${
                      encStatus === valor
                        ? "border-perigo bg-perigo text-white"
                        : "border-borda bg-fundo"
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-sm font-bold" htmlFor="motivo-encerramento">
                  Por quê? *
                </label>
                <textarea
                  id="motivo-encerramento"
                  rows={3}
                  value={encMotivo}
                  onChange={(e) => setEncMotivo(e.target.value)}
                  placeholder="Ex.: compra só por licitação estadual"
                  className={`${campo} mt-1`}
                />
              </div>
              <button
                type="button"
                onClick={salvar}
                disabled={!!erroValidacao || salvando}
                className="w-full rounded-lg bg-perigo py-3.5 text-lg font-bold text-white disabled:opacity-40"
              >
                {salvando ? "Salvando…" : "Salvar e encerrar"}
              </button>
              {erroSalvar && (
                <p className="text-center text-sm font-semibold text-perigo">{erroSalvar}</p>
              )}
              <button
                type="button"
                onClick={() => setEncerrando(false)}
                className="w-full py-1 text-center text-sm font-semibold text-tinta-fraca underline"
              >
                Voltar para o próximo passo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
