"use client";

import { useState } from "react";
import { criarNota } from "@/lib/api";

/** Sheet de captura instantânea: texto, salvar, pronto. */
export function NotaRapida({
  aberta,
  aoFechar,
  aoSalvar,
}: {
  aberta: boolean;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [texto, setTexto] = useState("");

  if (!aberta) return null;

  async function salvar() {
    const t = texto.trim();
    if (!t) return;
    await criarNota({ texto: t });
    setTexto("");
    aoSalvar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={aoFechar}>
      <div
        className="w-full rounded-t-2xl bg-carta p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">Nota rápida</h2>
        <textarea
          autoFocus
          rows={4}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="O que você não pode esquecer?"
          className="mt-3 w-full rounded-md border border-borda bg-fundo p-3"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={aoFechar}
            className="flex-1 rounded-md border border-borda font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={!texto.trim()}
            className="flex-1 rounded-md bg-marca font-bold text-white disabled:opacity-40"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
