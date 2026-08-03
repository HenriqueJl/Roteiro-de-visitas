"use client";

/**
 * Edição de uma parada: horário sugerido e objetivo da visita.
 *
 * Também é aqui que se reabre uma parada marcada como concluída por engano —
 * caso comum na rua, onde o toque errado acontece com o telefone na mão. Isso
 * não apaga a interação registrada, apenas desmarca a parada; apagar a
 * interação é ação da ficha do cliente, onde o histórico está visível.
 */

import { useState } from "react";
import { atualizarParada, reabrirParada, removerParada } from "@/lib/db";
import type { Cliente, ParadaRoteiro } from "@/lib/types";
import {
  Campo,
  Sheet,
  botaoNeutro,
  botaoPerigo,
  botaoPrimario,
  entrada,
} from "@/components/Sheet";

export function EditarParada({
  roteiroId,
  parada,
  cliente,
  aoFechar,
}: {
  roteiroId: string;
  parada: ParadaRoteiro;
  cliente: Cliente;
  aoFechar: () => void;
}) {
  const [horario, setHorario] = useState(parada.horarioSugerido);
  const [objetivo, setObjetivo] = useState(parada.objetivo);
  const [confirmando, setConfirmando] = useState(false);

  async function salvar() {
    await atualizarParada(roteiroId, parada.clienteId, {
      horarioSugerido: horario,
      objetivo: objetivo.trim(),
    });
    aoFechar();
  }

  return (
    <Sheet
      titulo="Editar parada"
      subtitulo={cliente.nome}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" onClick={salvar} className={botaoPrimario}>
            Salvar
          </button>
          {confirmando ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  await removerParada(roteiroId, parada.clienteId);
                  aoFechar();
                }}
                className="w-full rounded-md bg-perigo py-3 font-bold text-white"
              >
                Tirar mesmo
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className={botaoNeutro}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className={botaoPerigo}
            >
              Tirar do dia
            </button>
          )}
        </>
      }
    >
      <Campo rotulo="Horário sugerido" dica="Deixe vazio se não quiser hora marcada.">
        <input
          type="time"
          value={horario}
          onChange={(e) => setHorario(e.target.value)}
          className={entrada}
        />
      </Campo>

      <Campo rotulo="Objetivo da visita" dica="O que você vai fazer ali. Aparece no card.">
        <textarea
          rows={2}
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          className={entrada}
        />
      </Campo>

      {parada.concluida && (
        <div className="rounded-md border border-alerta bg-alerta/5 p-3">
          <p className="text-sm font-semibold text-alerta">Parada marcada como concluída.</p>
          <p className="mt-0.5 text-xs text-tinta-fraca">
            Reabrir desmarca a parada e a devolve à lista do dia. A visita registrada
            continua no histórico do cliente.
          </p>
          <button
            type="button"
            onClick={async () => {
              await reabrirParada(roteiroId, parada.clienteId);
              aoFechar();
            }}
            className="mt-2 min-h-11 w-full rounded-md border border-borda bg-carta font-semibold"
          >
            Reabrir parada
          </button>
        </div>
      )}
    </Sheet>
  );
}
