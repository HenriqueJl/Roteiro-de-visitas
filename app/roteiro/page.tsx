"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDados } from "@/components/Dados";
import {
  adicionarParada,
  gerarProximaSemana,
  moverParada,
  removerParada,
  transferirParada,
} from "@/lib/api";
import { LABEL_MOTIVO, type ResultadoGeracao } from "@/lib/gerador";
import { fmtCurto, fmtDiaExtenso, hoje } from "@/lib/datas";
import { linkGoogleMaps, linkWaze } from "@/lib/links";
import { MapaDiaDinamico, type PontoParada } from "@/components/roteiro/MapaDiaDinamico";
import { EscolherCliente } from "@/components/registro/EscolherCliente";
import {
  ICONE_TIPO_CLIENTE,
  LABEL_DIA_SEMANA_CURTO,
  type Cliente,
  type Roteiro,
} from "@/lib/types";
import { Icone } from "@/lib/icones";
import { EditarDia } from "@/components/roteiro/EditarDia";
import { EditarParada } from "@/components/roteiro/EditarParada";
import { NovoDia } from "@/components/roteiro/NovoDia";
import { FerramentasDia } from "@/components/roteiro/FerramentasDia";
import { Aviso, useAviso } from "@/components/Aviso";

export default function TelaRoteiro() {
  const { aviso, avisar } = useAviso();
  const [semana, setSemana] = useState<number | null>(null);
  const [editandoDia, setEditandoDia] = useState(false);
  const [paradaEmEdicao, setParadaEmEdicao] = useState<string | null>(null);
  const [novoDiaAberto, setNovoDiaAberto] = useState(false);
  const [diaId, setDiaId] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [addAberto, setAddAberto] = useState(false);
  const [transferindo, setTransferindo] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [relatorio, setRelatorio] = useState<ResultadoGeracao | null>(null);


  const dados = useDados();
  const roteiros = useMemo(
    () => dados && [...dados.roteiros].sort((a, b) => a.data.localeCompare(b.data)),
    [dados],
  );
  const clientes = dados?.clientes;

  const semanas = useMemo(
    () => [...new Set((roteiros ?? []).map((r) => r.semana))].sort((a, b) => a - b),
    [roteiros],
  );

  // Abre na semana e no dia de hoje; se hoje não é dia de rua, no próximo.
  useEffect(() => {
    if (!roteiros || roteiros.length === 0 || semana !== null) return;
    const h = hoje();
    const alvo = roteiros.find((r) => r.data === h) ?? roteiros.find((r) => r.data >= h) ?? roteiros[0];
    setSemana(alvo.semana);
    setDiaId(alvo.id);
  }, [roteiros, semana]);

  const dias = useMemo(
    () => (roteiros ?? []).filter((r) => r.semana === semana),
    [roteiros, semana],
  );
  const dia = useMemo(() => dias.find((d) => d.id === diaId) ?? dias[0], [dias, diaId]);

  const porId = useMemo(
    () => new Map((clientes ?? []).map((c) => [c.id, c])),
    [clientes],
  );

  const paradas = useMemo(
    () => (dia ? [...dia.paradas].sort((a, b) => a.ordem - b.ordem) : []),
    [dia],
  );

  const pontos: PontoParada[] = useMemo(
    () =>
      paradas.flatMap((parada) => {
        const c = porId.get(parada.clienteId);
        return c && c.lat != null && c.lng != null
          ? [{ parada, cliente: c as Cliente & { lat: number; lng: number } }]
          : [];
      }),
    [paradas, porId],
  );

  const semGps = paradas.length - pontos.length;

  if (roteiros === undefined || clientes === undefined) {
    return <p className="p-8 text-center text-tinta-fraca">Carregando…</p>;
  }

  if (roteiros.length === 0) {
    return (
      <main className="p-6 text-center">
        <h1 className="text-xl font-bold">Roteiro</h1>
        <p className="mt-2 text-sm text-tinta-fraca">Nenhuma semana planejada ainda.</p>
      </main>
    );
  }

  return (
    <main>
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 backdrop-blur">
        <div className="flex items-baseline justify-between px-4 pt-3">
          <h1 className="text-xl font-bold">Roteiro</h1>
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            className="text-sm font-semibold text-marca underline"
          >
            {editando ? "Concluir edição" : "Editar"}
          </button>
        </div>

        {/* Abas de semana */}
        <div className="flex gap-1 overflow-x-auto px-4 pt-2">
          {semanas.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSemana(s);
                setDiaId(null);
              }}
              className={`shrink-0 rounded-t-lg px-4 py-2 text-sm font-bold ${
                s === semana ? "bg-carta text-marca ring-1 ring-borda" : "text-tinta-fraca"
              }`}
            >
              Semana {s}
            </button>
          ))}
        </div>

        {/* Dias da semana */}
        <div className="flex gap-1.5 overflow-x-auto border-t border-borda bg-carta px-4 py-2">
          {dias.map((d) => {
            const ativo = d.id === dia?.id;
            const feitas = d.paradas.filter((p) => p.concluida).length;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDiaId(d.id)}
                className={`flex shrink-0 flex-col items-center rounded-md px-3 py-1.5 ${
                  ativo ? "bg-marca text-white" : "bg-fundo"
                } ${d.data === hoje() && !ativo ? "ring-2 ring-marca" : ""}`}
              >
                <span className="text-xs font-bold">{LABEL_DIA_SEMANA_CURTO[d.diaSemana]}</span>
                <span className="text-[10px]">{fmtCurto(d.data)}</span>
                <span className="text-[10px] font-semibold">
                  {feitas}/{d.paradas.length}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {dia && (
        <div className="space-y-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-tinta-fraca">
              {fmtDiaExtenso(dia.data)}
            </p>
            <div className="flex items-start gap-2">
              <h2 className="min-w-0 flex-1 text-lg font-bold">
                {dia.cidade} — {dia.titulo}
              </h2>
              <button
                type="button"
                onClick={() => setEditandoDia(true)}
                aria-label="Editar título, cidade e observação do dia"
                className="shrink-0 rounded-md border border-borda px-2 py-1.5 text-tinta-fraca"
              >
                <Icone nome="editar" tamanho={16} />
              </button>
            </div>
            {dia.observacao && (
              <p className="mt-1 rounded-md bg-carta px-3 py-2 text-sm text-tinta-fraca">
                <Icone nome="info" tamanho={15} className="mr-1 inline-block -mt-0.5" />
                {dia.observacao}
              </p>
            )}
          </div>

          {pontos.length > 0 ? (
            <MapaDiaDinamico pontos={pontos} />
          ) : (
            <p className="rounded-lg border border-borda bg-carta p-6 text-center text-sm text-tinta-fraca">
              Nenhuma parada com localização para desenhar no mapa.
            </p>
          )}
          {semGps > 0 && (
            <p className="text-xs text-alerta">
              {semGps} parada{semGps > 1 ? "s" : ""} sem GPS ficou de fora do mapa.
            </p>
          )}

          {editando && (
            <FerramentasDia dia={dia} porId={porId} aoAvisar={avisar} />
          )}

          <ol className="space-y-2">
            {paradas.map((p, i) => {
              const c = porId.get(p.clienteId);
              if (!c) return null;
              const temGps = c.lat != null && c.lng != null;
              return (
                <li
                  key={p.clienteId}
                  className={`rounded-lg border border-borda bg-carta p-3 ${
                    p.concluida ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ background: p.concluida ? "#8b8e94" : "#1f3d5c" }}
                    >
                      {p.concluida ? <Icone nome="check" tamanho={15} /> : p.ordem}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/clientes/ficha?id=${c.id}`}
                        className="block truncate font-bold"
                      >
                        <Icone nome={ICONE_TIPO_CLIENTE[c.tipo]} className="inline-block -mt-0.5 mr-1 text-tinta-fraca" />
                        {c.nome}
                      </Link>
                      <p className="text-sm text-tinta-fraca">
                        {p.horarioSugerido && (
                          <span className={p.fixa ? "font-bold text-marca" : undefined}>
                            {p.horarioSugerido}
                            {p.fixa && " fixo"}
                          </span>
                        )}
                        {p.horarioSugerido && " · "}
                        {c.bairro || c.cidade}
                      </p>
                      {p.objetivo && (
                        <p className="mt-1 flex items-start gap-1.5 text-sm">
                          <Icone nome="objetivo" tamanho={15} className="mt-0.5 text-tinta-fraca" />
                          <span>{p.objetivo}</span>
                        </p>
                      )}
                    </div>
                    {temGps && !editando && (
                      <div className="flex shrink-0 flex-col gap-1">
                        <a
                          href={linkWaze(c.lat!, c.lng!)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-borda px-2 py-1 text-xs font-semibold"
                        >
                          Waze
                        </a>
                        <a
                          href={linkGoogleMaps(c.lat!, c.lng!)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-borda px-2 py-1 text-xs font-semibold"
                        >
                          Maps
                        </a>
                      </div>
                    )}
                  </div>

                  {editando && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-borda pt-2">
                      <button
                        type="button"
                        aria-label={`Subir ${c.nome}`}
                        disabled={i === 0}
                        onClick={() => moverParada(dia.id, p.clienteId, -1)}
                        className="min-h-11 rounded-md border border-borda px-3 font-bold disabled:opacity-30"
                      >
                        <Icone nome="subiu" tamanho={17} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Descer ${c.nome}`}
                        disabled={i === paradas.length - 1}
                        onClick={() => moverParada(dia.id, p.clienteId, 1)}
                        className="min-h-11 rounded-md border border-borda px-3 font-bold disabled:opacity-30"
                      >
                        <Icone nome="desceu" tamanho={17} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Editar horário e objetivo de ${c.nome}`}
                        onClick={() => setParadaEmEdicao(p.clienteId)}
                        className="min-h-11 rounded-md border border-borda px-3 text-sm font-semibold"
                      >
                        <Icone nome="relogio" tamanho={16} className="mr-1" />
                        Horário
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTransferindo(transferindo === p.clienteId ? null : p.clienteId)
                        }
                        className="min-h-11 rounded-md border border-borda px-3 text-sm font-semibold"
                      >
                        Mover de dia
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await removerParada(dia.id, p.clienteId);
                          avisar(`${c.nome} saiu do dia.`);
                        }}
                        className="min-h-11 rounded-md border border-borda px-3 text-sm font-semibold text-perigo"
                      >
                        Remover
                      </button>
                    </div>
                  )}

                  {editando && transferindo === p.clienteId && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(roteiros ?? [])
                        .filter((r) => r.id !== dia.id)
                        .map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={async () => {
                              await transferirParada(dia.id, r.id, p.clienteId);
                              setTransferindo(null);
                              avisar(`Movido para ${fmtCurto(r.data)} — ${r.cidade}.`);
                            }}
                            className="rounded-md border border-borda bg-fundo px-2.5 py-2 text-xs font-semibold"
                          >
                            S{r.semana} {LABEL_DIA_SEMANA_CURTO[r.diaSemana]} {fmtCurto(r.data)}
                            <span className="block text-[10px] font-normal text-tinta-fraca">
                              {r.cidade} ({r.paradas.length})
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {editando && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setAddAberto(true)}
                className="w-full rounded-md border border-dashed border-borda py-3 font-semibold text-tinta-fraca"
              >
                + Adicionar cliente a este dia
              </button>
              <button
                type="button"
                onClick={() => setNovoDiaAberto(true)}
                className="w-full rounded-md border border-dashed border-borda py-3 font-semibold text-tinta-fraca"
              >
                + Criar outro dia de rua
              </button>
            </div>
          )}

          {dia.tardeLivre && (
            <p className="rounded-md bg-carta px-3 py-2 text-sm text-tinta-fraca">
              <Icone nome="telefone" tamanho={15} className="mr-1 inline-block -mt-0.5" />
              Tarde reservada para follow-up telefônico e consolidação.
            </p>
          )}

          <button
            type="button"
            disabled={gerando}
            onClick={async () => {
              setGerando(true);
              try {
                const r = await gerarProximaSemana();
                setRelatorio(r);
                if (r.roteiros.length) {
                  setSemana(r.roteiros[0].semana);
                  setDiaId(r.roteiros[0].id);
                }
              } catch (e) {
                avisar(e instanceof Error ? e.message : String(e));
              } finally {
                setGerando(false);
              }
            }}
            className="mt-2 w-full rounded-lg bg-marca py-3.5 text-lg font-bold text-white disabled:opacity-40"
          >
            {gerando ? "Montando…" : "Gerar semana seguinte"}
          </button>
        </div>
      )}

      {relatorio && (
        <div
          className="fixed inset-0 z-[60] flex items-end bg-black/40"
          onClick={() => setRelatorio(null)}
        >
          <div
            className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-carta p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">
              Semana {relatorio.roteiros[0]?.semana ?? ""} montada
            </h2>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-fundo p-2">
                <dt className="text-xs text-tinta-fraca">Compromissos</dt>
                <dd className="text-xl font-bold">{relatorio.resumo.compromissos}</dd>
              </div>
              <div className="rounded-md bg-fundo p-2">
                <dt className="text-xs text-tinta-fraca">Follow-up</dt>
                <dd className="text-xl font-bold">{relatorio.resumo.followUp}</dd>
              </div>
              <div className="rounded-md bg-fundo p-2">
                <dt className="text-xs text-tinta-fraca">Prospecção</dt>
                <dd className="text-xl font-bold">{relatorio.resumo.novos}</dd>
              </div>
            </dl>
            <ul className="mt-3 space-y-1 text-sm">
              {relatorio.roteiros.map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span>
                    {LABEL_DIA_SEMANA_CURTO[r.diaSemana]} {fmtCurto(r.data)} · {r.cidade}
                  </span>
                  <span className="font-semibold">
                    {r.paradas.length} parada{r.paradas.length === 1 ? "" : "s"}
                    {r.tardeLivre && " (meio dia)"}
                  </span>
                </li>
              ))}
            </ul>

            {relatorio.sobra.length > 0 && (
              <div className="mt-3 rounded-md border border-borda border-l-4 border-l-alerta p-3">
                <p className="text-sm font-bold text-alerta">
                  {relatorio.sobra.length} cliente{relatorio.sobra.length === 1 ? "" : "s"} não
                  coube{relatorio.sobra.length === 1 ? "" : "ram"} na semana
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-tinta-fraca">
                  {relatorio.sobra.slice(0, 8).map((c) => (
                    <li key={c.cliente.id}>
                      {c.cliente.nome} — {LABEL_MOTIVO[c.motivo].toLowerCase()}
                    </li>
                  ))}
                  {relatorio.sobra.length > 8 && <li>e mais {relatorio.sobra.length - 8}…</li>}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => setRelatorio(null)}
              className="mt-4 w-full rounded-lg bg-marca py-3 font-bold text-white"
            >
              Ver o roteiro
            </button>
          </div>
        </div>
      )}

      {addAberto && dia && (
        <EscolherCliente
          cidadeDoDia={dia.cidade}
          aoFechar={() => setAddAberto(false)}
          aoEscolher={async (c) => {
            setAddAberto(false);
            if (dia.paradas.some((p) => p.clienteId === c.id)) {
              avisar("Esse cliente já está no dia.");
              return;
            }
            await adicionarParada(dia.id, c.id);
            avisar(`${c.nome} entrou no dia.`);
          }}
        />
      )}

      {novoDiaAberto && (
        <NovoDia
          cidadeSugerida={dia?.cidade ?? ""}
          aoFechar={() => setNovoDiaAberto(false)}
          aoCriado={(data) => {
            setNovoDiaAberto(false);
            avisar(`Dia de ${fmtCurto(data)} criado.`);
          }}
        />
      )}

      {editandoDia && dia && (
        <EditarDia
          dia={dia}
          aoFechar={() => setEditandoDia(false)}
          aoApagado={() => {
            setEditandoDia(false);
            avisar("Dia apagado.");
          }}
          aoDuplicado={(data) => {
            setEditandoDia(false);
            avisar(`Dia copiado para ${fmtCurto(data)}.`);
          }}
        />
      )}

      {paradaEmEdicao && dia && (() => {
        const p = dia.paradas.find((x) => x.clienteId === paradaEmEdicao);
        const c = p && porId.get(p.clienteId);
        if (!p || !c) return null;
        return (
          <EditarParada
            roteiroId={dia.id}
            parada={p}
            cliente={c}
            aoFechar={() => setParadaEmEdicao(null)}
          />
        );
      })()}

      <Aviso texto={aviso} />
    </main>
  );
}
