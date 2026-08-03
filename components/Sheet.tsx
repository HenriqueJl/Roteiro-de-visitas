"use client";

/**
 * Bottom sheet — o invólucro que já se repetia em quatro telas.
 *
 * Fecha ao toque no fundo e no Esc. O conteúdo rola; o cabeçalho e o rodapé
 * ficam presos, porque num teclado aberto de celular o botão de salvar é a
 * primeira coisa que desaparece.
 */

import { useEffect } from "react";
import { Icone } from "@/lib/icones";

export function Sheet({
  titulo,
  subtitulo,
  aoFechar,
  rodape,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  aoFechar: () => void;
  rodape?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [aoFechar]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={aoFechar}>
      <div
        className="mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-lg bg-carta md:mb-6 md:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-2 border-b border-borda px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-bold">{titulo}</p>
            {subtitulo && <p className="truncate text-xs text-tinta-fraca">{subtitulo}</p>}
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={aoFechar}
            className="w-10 shrink-0 text-tinta-fraca"
          >
            <Icone nome="fechar" tamanho={20} />
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto px-4 py-4">{children}</div>

        {rodape && (
          <div className="space-y-2 border-t border-borda px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}

/** Rótulo + campo, o par que aparece em todo formulário de edição. */
export function Campo({
  rotulo,
  dica,
  children,
}: {
  rotulo: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{rotulo}</span>
      {dica && <span className="block text-xs text-tinta-fraca">{dica}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const entrada = "w-full rounded-md border border-borda bg-fundo p-3";

export const botaoPrimario =
  "w-full rounded-md bg-marca py-3 font-bold text-white disabled:opacity-40";

export const botaoNeutro =
  "w-full rounded-md border border-borda py-3 font-semibold text-tinta-fraca";

export const botaoPerigo =
  "w-full rounded-md border border-perigo py-3 font-semibold text-perigo";
