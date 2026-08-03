"use client";

/**
 * Notas (seção 6.6).
 *
 * A captura fica no topo, sempre aberta — não atrás de um botão. Esta é a tela
 * de notas: se ele chegou aqui, é para escrever. Cliente e etiquetas são
 * opcionais e ficam atrás de "Detalhes", pelo mesmo motivo do registro de
 * visita: o caminho mínimo tem de ser texto + salvar.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { alternarNota, criarNota, db, removerNota } from "@/lib/db";
import { fmtInstante, fmtRelativo } from "@/lib/datas";
import { contemBusca, separarEtiquetas } from "@/lib/texto";
import { EscolherCliente } from "@/components/registro/EscolherCliente";
import { ICONE_TIPO_CLIENTE, type Cliente } from "@/lib/types";

export default function Notas() {
  // --- captura ---
  const [texto, setTexto] = useState("");
  const [detalhes, setDetalhes] = useState(false);
  const [etiquetas, setEtiquetas] = useState("");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);

  // --- filtros ---
  const [busca, setBusca] = useState("");
  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const [verResolvidas, setVerResolvidas] = useState(false);

  // Apagar pede segunda confirmação no próprio botão — nota é coisa que ele
  // escreveu na rua e não dá para recuperar.
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const notas = useLiveQuery(
    async () => (await db.notas.toArray()).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
    [],
  );
  const clientes = useLiveQuery(() => db.clientes.toArray(), []);
  const porId = useMemo(() => new Map((clientes ?? []).map((c) => [c.id, c])), [clientes]);

  const todasEtiquetas = useMemo(() => {
    const c = new Map<string, number>();
    for (const n of notas ?? []) for (const t of n.tags) c.set(t, (c.get(t) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  }, [notas]);

  const resolvidas = useMemo(() => (notas ?? []).filter((n) => n.resolvida).length, [notas]);

  const visiveis = useMemo(() => {
    return (notas ?? []).filter((n) => {
      if (!verResolvidas && n.resolvida) return false;
      if (etiqueta && !n.tags.includes(etiqueta)) return false;
      const nome = n.clienteId ? (porId.get(n.clienteId)?.nome ?? "") : "";
      return contemBusca(busca, n.texto, nome, n.tags.join(" "));
    });
  }, [notas, verResolvidas, etiqueta, busca, porId]);

  async function salvar() {
    const t = texto.trim();
    if (!t) return;
    await criarNota({
      texto: t,
      clienteId: cliente?.id,
      tags: separarEtiquetas(etiquetas),
    });
    setTexto("");
    setEtiquetas("");
    setCliente(null);
    setDetalhes(false);
  }

  const chip = (ativo: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-semibold ${
      ativo ? "bg-marca text-white" : "border border-borda bg-carta text-tinta-fraca"
    }`;

  return (
    <main>
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-bold">Notas</h1>
      </header>

      <div className="space-y-3 px-4 py-3">
        {/* --- captura --- */}
        <section className="rounded-xl border border-borda bg-carta p-3">
          <textarea
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="O que você não pode esquecer?"
            className="w-full rounded-lg border border-borda bg-fundo p-3"
          />

          {detalhes && (
            <div className="mt-2 space-y-2">
              <button
                type="button"
                onClick={() => setEscolhendo(true)}
                className="w-full rounded-lg border border-borda px-3 py-2.5 text-left text-sm font-semibold"
              >
                {cliente ? (
                  <>
                    {ICONE_TIPO_CLIENTE[cliente.tipo]} {cliente.nome}
                  </>
                ) : (
                  "Vincular a um cliente…"
                )}
              </button>
              {cliente && (
                <button
                  type="button"
                  onClick={() => setCliente(null)}
                  className="text-xs font-semibold text-tinta-fraca underline"
                >
                  desvincular
                </button>
              )}
              <input
                value={etiquetas}
                onChange={(e) => setEtiquetas(e.target.value)}
                placeholder="Etiquetas, separadas por vírgula"
                className="w-full rounded-lg border border-borda bg-fundo p-3"
              />
              {todasEtiquetas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {todasEtiquetas.slice(0, 8).map(([t]) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setEtiquetas((atual) =>
                          separarEtiquetas(`${atual},${t}`).join(", "),
                        )
                      }
                      className="rounded-full border border-borda px-2.5 py-1 text-xs font-semibold text-tinta-fraca"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setDetalhes((v) => !v)}
              className="rounded-lg border border-borda px-3 text-sm font-semibold text-tinta-fraca"
            >
              {detalhes ? "Menos" : "Detalhes"}
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={!texto.trim()}
              className="flex-1 rounded-lg bg-marca font-bold text-white disabled:opacity-40"
            >
              Salvar nota
            </button>
          </div>
        </section>

        {/* --- filtros --- */}
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nas notas"
          className="w-full rounded-lg border border-borda bg-carta p-3"
        />

        {(todasEtiquetas.length > 0 || resolvidas > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {etiqueta && (
              <button type="button" onClick={() => setEtiqueta(null)} className={chip(true)}>
                {etiqueta} ×
              </button>
            )}
            {!etiqueta &&
              todasEtiquetas.map(([t, n]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEtiqueta(t)}
                  className={chip(false)}
                >
                  {t} <span className="text-tinta-fraca">{n}</span>
                </button>
              ))}
            {resolvidas > 0 && (
              <button
                type="button"
                onClick={() => setVerResolvidas((v) => !v)}
                className={chip(verResolvidas)}
              >
                Resolvidas {resolvidas}
              </button>
            )}
          </div>
        )}

        {/* --- lista --- */}
        {notas === undefined ? (
          <p className="py-8 text-center text-tinta-fraca">Carregando…</p>
        ) : visiveis.length === 0 ? (
          <p className="rounded-xl border border-borda bg-carta p-6 text-center text-sm text-tinta-fraca">
            {(notas.length === 0
              ? "Nenhuma nota ainda."
              : "Nenhuma nota com esse filtro.")}
          </p>
        ) : (
          <ul className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {visiveis.map((n) => {
              const c = n.clienteId ? porId.get(n.clienteId) : undefined;
              return (
                <li
                  key={n.id}
                  className={`rounded-xl border border-borda bg-carta p-3 ${
                    n.resolvida ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => alternarNota(n.id)}
                      aria-label={n.resolvida ? "Reabrir nota" : "Marcar como resolvida"}
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-sm font-bold ${
                        n.resolvida
                          ? "border-ok bg-ok text-white"
                          : "border-borda text-transparent"
                      }`}
                      style={{ minHeight: 28 }}
                    >
                      ✓
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`whitespace-pre-wrap break-words ${
                          n.resolvida ? "line-through" : ""
                        }`}
                      >
                        {n.texto}
                      </p>
                      <p className="mt-1 text-xs text-tinta-fraca">
                        <time dateTime={n.criadoEm} title={fmtInstante(n.criadoEm)}>
                          {fmtRelativo(n.criadoEm)}
                        </time>
                        {c && (
                          <>
                            {" · "}
                            <Link href={`/clientes/ficha?id=${c.id}`} className="underline">
                              {ICONE_TIPO_CLIENTE[c.tipo]} {c.nome}
                            </Link>
                          </>
                        )}
                      </p>
                      {n.tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {n.tags.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setEtiqueta(t)}
                              className="rounded-full bg-fundo px-2 py-0.5 text-xs font-semibold text-tinta-fraca"
                              style={{ minHeight: 0 }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirmando === n.id) {
                          removerNota(n.id);
                          setConfirmando(null);
                        } else {
                          setConfirmando(n.id);
                        }
                      }}
                      onBlur={() => setConfirmando((a) => (a === n.id ? null : a))}
                      className={`shrink-0 self-start rounded-lg px-2 text-sm font-bold ${
                        confirmando === n.id ? "bg-perigo text-white" : "text-tinta-fraca"
                      }`}
                    >
                      {confirmando === n.id ? "Apagar?" : "🗑"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {escolhendo && (
        <EscolherCliente
          aoFechar={() => setEscolhendo(false)}
          aoEscolher={(c) => {
            setCliente(c);
            setEscolhendo(false);
          }}
        />
      )}
    </main>
  );
}
