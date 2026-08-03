"use client";

/**
 * Edição do dia de roteiro: título, cidade, observação, tarde livre — e apagar.
 *
 * O roteiro é sugestão, não ordem de serviço: o motor da seção 7 escreve um
 * plano razoável, e a semana real desmonta esse plano toda terça. Se ele não
 * puder reescrever, passa a manter o plano na cabeça e o app deixa de valer.
 *
 * Apagar o dia pede confirmação em dois tempos, porque leva as paradas junto.
 */

import { useState } from "react";
import { atualizarRoteiro, removerRoteiro } from "@/lib/db";
import { fmtDiaExtenso } from "@/lib/datas";
import type { Roteiro } from "@/lib/types";
import {
  Campo,
  Sheet,
  botaoNeutro,
  botaoPerigo,
  botaoPrimario,
  entrada,
} from "@/components/Sheet";

export function EditarDia({
  dia,
  aoFechar,
  aoApagado,
}: {
  dia: Roteiro;
  aoFechar: () => void;
  aoApagado: () => void;
}) {
  const [titulo, setTitulo] = useState(dia.titulo);
  const [cidade, setCidade] = useState(dia.cidade);
  const [observacao, setObservacao] = useState(dia.observacao ?? "");
  const [tardeLivre, setTardeLivre] = useState(dia.tardeLivre);
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    await atualizarRoteiro(dia.id, {
      titulo: titulo.trim(),
      cidade: cidade.trim(),
      observacao: observacao.trim() || undefined,
      tardeLivre,
    });
    aoFechar();
  }

  return (
    <Sheet
      titulo="Editar dia"
      subtitulo={fmtDiaExtenso(dia.data)}
      aoFechar={aoFechar}
      rodape={
        <>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !cidade.trim()}
            className={botaoPrimario}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          {confirmando ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  await removerRoteiro(dia.id);
                  aoApagado();
                }}
                className="w-full rounded-md bg-perigo py-3 font-bold text-white"
              >
                Apagar mesmo
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
              Apagar este dia
              {dia.paradas.length > 0 && ` e ${dia.paradas.length} parada${
                dia.paradas.length > 1 ? "s" : ""
              }`}
            </button>
          )}
        </>
      }
    >
      <Campo rotulo="Cidade" dica="Um dia = uma cidade. Misturar joga a estrada fora.">
        <input value={cidade} onChange={(e) => setCidade(e.target.value)} className={entrada} />
      </Campo>

      <Campo rotulo="Título" dica="O que este dia é. Ex.: “corredor médico-hospitalar”.">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={entrada} />
      </Campo>

      <Campo rotulo="Observação" dica="Aparece no topo do dia, na tela Hoje.">
        <textarea
          rows={2}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          className={entrada}
        />
      </Campo>

      <label className="flex min-h-11 items-center gap-2.5 text-sm font-bold">
        <input
          type="checkbox"
          checked={tardeLivre}
          onChange={(e) => setTardeLivre(e.target.checked)}
          className="h-5 w-5 accent-marca"
        />
        Tarde reservada para follow-up
      </label>
    </Sheet>
  );
}
