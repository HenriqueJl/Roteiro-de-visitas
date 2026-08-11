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
import { atualizarRoteiro, duplicarRoteiro, reagendarRoteiro, removerRoteiro } from "@/lib/api";
import { addDias, fmtCurto, fmtDiaExtenso } from "@/lib/datas";
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
  aoDuplicado,
}: {
  dia: Roteiro;
  aoFechar: () => void;
  aoApagado: () => void;
  aoDuplicado: (data: string) => void;
}) {
  const [titulo, setTitulo] = useState(dia.titulo);
  const [cidade, setCidade] = useState(dia.cidade);
  const [observacao, setObservacao] = useState(dia.observacao ?? "");
  const [tardeLivre, setTardeLivre] = useState(dia.tardeLivre);
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [data, setData] = useState(dia.data);
  // Duplicar sugere a mesma data + 7: a visita que se repete quase sempre
  // repete na mesma semana seguinte, no mesmo dia da semana.
  const [dataCopia, setDataCopia] = useState(addDias(dia.data, 7));
  const [erro, setErro] = useState("");

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      await atualizarRoteiro(dia.id, {
        titulo: titulo.trim(),
        cidade: cidade.trim(),
        observacao: observacao.trim() || undefined,
        tardeLivre,
      });
      // Reagendar depois do resto: se a data colidir, o erro aparece com as
      // outras alterações já salvas, em vez de perder tudo.
      if (data !== dia.data) await reagendarRoteiro(dia.id, data);
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  async function duplicar() {
    setErro("");
    try {
      await duplicarRoteiro(dia.id, dataCopia);
      aoDuplicado(dataCopia);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
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

      <Campo rotulo="Data" dica="Mover o dia inteiro — o feriado que empurra a semana.">
        <input
          type="date"
          value={data}
          onChange={(e) => e.target.value && setData(e.target.value)}
          className={entrada}
        />
      </Campo>

      <div className="rounded-md border border-borda bg-fundo p-3">
        <p className="text-sm font-bold">Repetir este dia</p>
        <p className="mt-0.5 text-xs text-tinta-fraca">
          Copia as {dia.paradas.length} parada
          {dia.paradas.length === 1 ? "" : "s"} com horários e objetivos, como não
          visitadas.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            type="date"
            value={dataCopia}
            onChange={(e) => e.target.value && setDataCopia(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-borda bg-carta p-2.5"
          />
          <button
            type="button"
            onClick={duplicar}
            className="shrink-0 rounded-md border border-marca px-3 font-semibold text-marca"
          >
            Copiar para {fmtCurto(dataCopia)}
          </button>
        </div>
      </div>

      {erro && <p className="text-sm font-semibold text-perigo">{erro}</p>}
    </Sheet>
  );
}
