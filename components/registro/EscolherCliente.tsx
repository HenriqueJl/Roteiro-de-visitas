"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { contemBusca } from "@/lib/texto";
import { ICONE_TIPO_CLIENTE, type Cliente } from "@/lib/types";

/**
 * Seletor de cliente para a visita fora do roteiro. Busca por nome, cidade ou
 * bairro; a cidade do dia vem primeiro — é onde ele está parado na calçada.
 */
export function EscolherCliente({
  cidadeDoDia,
  aoFechar,
  aoEscolher,
}: {
  cidadeDoDia?: string;
  aoFechar: () => void;
  aoEscolher: (cliente: Cliente) => void;
}) {
  const [busca, setBusca] = useState("");

  const clientes = useLiveQuery(
    () => db.clientes.where("status").equals("ativo").toArray(),
    [],
  );

  const lista = useMemo(() => {
    return (clientes ?? [])
      .filter((c) => contemBusca(busca, c.nome, c.cidade, c.bairro))
      .sort(
        (a, b) =>
          Number(b.cidade === cidadeDoDia) - Number(a.cidade === cidadeDoDia) ||
          a.nome.localeCompare(b.nome, "pt-BR"),
      )
      .slice(0, 60);
  }, [clientes, busca, cidadeDoDia]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={aoFechar}>
      <div
        className="flex max-h-[85dvh] w-full flex-col rounded-t-2xl bg-carta"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-borda px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Onde você está?</h2>
            <button
              type="button"
              aria-label="Fechar"
              onClick={aoFechar}
              className="w-10 text-2xl text-tinta-fraca"
            >
              ×
            </button>
          </div>
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, cidade ou bairro"
            className="mt-2 w-full rounded-lg border border-borda bg-fundo p-3"
          />
        </header>
        <ul className="overflow-y-auto px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {lista.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => aoEscolher(c)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left active:bg-fundo"
              >
                <span aria-hidden className="text-xl">
                  {ICONE_TIPO_CLIENTE[c.tipo]}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{c.nome}</span>
                  <span className="block truncate text-sm text-tinta-fraca">
                    {c.cidade}
                    {c.bairro && ` · ${c.bairro}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {lista.length === 0 && (
            <li className="py-8 text-center text-sm text-tinta-fraca">
              Nenhum cliente encontrado.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
