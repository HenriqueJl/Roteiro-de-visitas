"use client";

import { useState } from "react";
import { linkGoogleMaps, linkLigar, linkWaze } from "@/lib/links";
import {
  ICONE_TIPO_CLIENTE,
  LABEL_TIPO_CLIENTE_CURTO,
  type Cliente,
  type ParadaRoteiro,
} from "@/lib/types";
import { Icone } from "@/lib/icones";

const botaoSecundario =
  "flex min-w-20 items-center justify-center rounded-md border border-borda bg-fundo px-3 text-sm font-semibold";

/**
 * Uma parada do dia. Concluída, colapsa numa linha; pendente, mostra os três
 * botões da especificação: Ligar, Navegar, Registrar.
 */
export function CardParada({
  parada,
  cliente,
  aoRegistrar,
}: {
  parada: ParadaRoteiro;
  cliente: Cliente;
  aoRegistrar: (parada: ParadaRoteiro, cliente: Cliente) => void;
}) {
  const [navegarAberto, setNavegarAberto] = useState(false);

  if (parada.concluida) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-borda bg-carta px-4 py-2 opacity-60">
        <span aria-hidden className="font-bold text-ok">
          <Icone nome="check" tamanho={15} />
        </span>
        <span className="truncate text-sm">{cliente.nome}</span>
        <span className="ml-auto shrink-0 text-xs text-tinta-fraca">
          {parada.horarioSugerido}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-borda bg-carta p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <span aria-label={LABEL_TIPO_CLIENTE_CURTO[cliente.tipo]} className="text-xl">
          <Icone nome={ICONE_TIPO_CLIENTE[cliente.tipo]} className="text-tinta-fraca" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">{cliente.nome}</p>
          <p className="mt-0.5 text-sm text-tinta-fraca">
            {cliente.endereco}
            {cliente.bairro && ` — ${cliente.bairro}`}
            {cliente.telefone && ` · ${cliente.telefone}`}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-fundo px-2 py-1 text-sm font-bold text-marca">
          {parada.horarioSugerido}
        </span>
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-sm">
        <Icone nome="objetivo" tamanho={15} className="mt-0.5 text-tinta-fraca" />
        <span>{parada.objetivo}</span>
      </p>

      <div className="mt-3 flex gap-2">
        {cliente.telefone && (
          <a href={linkLigar(cliente.telefone)} className={botaoSecundario}>
            Ligar
          </a>
        )}
        {cliente.lat != null && cliente.lng != null && (
          <button
            type="button"
            onClick={() => setNavegarAberto((v) => !v)}
            className={botaoSecundario}
            aria-expanded={navegarAberto}
          >
            Navegar
          </button>
        )}
        <button
          type="button"
          onClick={() => aoRegistrar(parada, cliente)}
          className="flex-1 rounded-md bg-marca px-3 text-sm font-bold text-white active:bg-marca-forte"
        >
          Registrar
        </button>
      </div>

      {navegarAberto && cliente.lat != null && cliente.lng != null && (
        <div className="mt-2 flex gap-2">
          <a
            href={linkGoogleMaps(cliente.lat, cliente.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${botaoSecundario} flex-1`}
          >
            Google Maps
          </a>
          <a
            href={linkWaze(cliente.lat, cliente.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${botaoSecundario} flex-1`}
          >
            Waze
          </a>
        </div>
      )}
    </div>
  );
}
