"use client";

/**
 * Ferramentas do dia — o que eu abriria antes de sair de casa.
 *
 * Três coisas que a mão fazia uma por uma:
 *
 * 1. **Resumo** — quantas paradas, quantos quilômetros, e a janela de horas. É a
 *    resposta para "esse dia cabe?" sem precisar somar de cabeça.
 * 2. **Reordenar por proximidade** — o motor ordena na geração, mas assim que ele
 *    acrescenta ou tira uma parada a ordem fica velha. Um toque refaz.
 * 3. **Distribuir horários** — digitar seis horários é o tipo de tédio que faz a
 *    ferramenta ser abandonada.
 *
 * As duas últimas respeitam parada fixa: hora marcada não é sugestão.
 */

import { useMemo, useState } from "react";
import { distribuirHorariosDoDia, reordenarDiaPorProximidade } from "@/lib/api";
import { resumoDaRota } from "@/lib/rota";
import { Icone } from "@/lib/icones";
import type { Cliente, Roteiro } from "@/lib/types";

/** Intervalos plausíveis para uma rota urbana com deslocamento. */
const INTERVALOS = [30, 45, 60, 90];

export function FerramentasDia({
  dia,
  porId,
  aoAvisar,
}: {
  dia: Roteiro;
  porId: Map<string, Cliente>;
  aoAvisar: (m: string) => void;
}) {
  const [inicio, setInicio] = useState("09:00");
  const [intervalo, setIntervalo] = useState(45);
  const [ocupado, setOcupado] = useState(false);

  const resumo = useMemo(
    () =>
      resumoDaRota(dia.paradas, (id) => {
        const c = porId.get(id);
        return c?.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : undefined;
      }),
    [dia.paradas, porId],
  );

  const fixas = dia.paradas.filter((p) => p.fixa).length;

  async function reordenar() {
    setOcupado(true);
    try {
      const trocaram = await reordenarDiaPorProximidade(dia.id);
      aoAvisar(
        trocaram === 0
          ? "A ordem já estava a melhor pela proximidade."
          : `${trocaram} parada${trocaram > 1 ? "s" : ""} trocou de lugar.`,
      );
    } finally {
      setOcupado(false);
    }
  }

  async function distribuir() {
    setOcupado(true);
    try {
      await distribuirHorariosDoDia(dia.id, inicio, intervalo);
      aoAvisar(
        fixas > 0
          ? `Horários a cada ${intervalo} min, mantendo ${fixas} hora marcada.`
          : `Horários a cada ${intervalo} min a partir de ${inicio}.`,
      );
    } finally {
      setOcupado(false);
    }
  }

  const horas = resumo.janelaMin !== null ? Math.round((resumo.janelaMin / 60) * 10) / 10 : null;
  // Cinco horas por dia é o teto real da seção 1 (25 h semanais).
  const apertado = horas !== null && horas > 5;

  return (
    <section className="space-y-3 rounded-md border border-borda bg-carta p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span>
          <strong>{resumo.paradas}</strong> parada{resumo.paradas === 1 ? "" : "s"}
        </span>
        <span className="text-tinta-fraca">~{resumo.km} km em linha reta</span>
        {horas !== null && (
          <span className={apertado ? "font-semibold text-alerta" : "text-tinta-fraca"}>
            {String(horas).replace(".", ",")} h de janela
            {apertado && " — passa das 5 h"}
          </span>
        )}
        {resumo.semGps > 0 && (
          <span className="text-tinta-fraca">{resumo.semGps} sem GPS</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={ocupado || resumo.paradas < 3}
          onClick={reordenar}
          className="min-h-11 rounded-md border border-borda px-3 text-sm font-semibold disabled:opacity-40"
        >
          <Icone nome="roteiro" tamanho={16} className="mr-1.5" />
          Reordenar por proximidade
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold text-tinta-fraca">
          Começar às
          <input
            type="time"
            value={inicio}
            onChange={(e) => e.target.value && setInicio(e.target.value)}
            className="mt-0.5 block w-28 rounded-md border border-borda bg-fundo p-2 text-base font-normal text-tinta"
          />
        </label>
        <label className="text-xs font-semibold text-tinta-fraca">
          A cada
          <select
            value={intervalo}
            onChange={(e) => setIntervalo(Number(e.target.value))}
            className="mt-0.5 block rounded-md border border-borda bg-fundo p-2 text-base font-normal text-tinta"
          >
            {INTERVALOS.map((n) => (
              <option key={n} value={n}>
                {n} min
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={ocupado || resumo.paradas === 0}
          onClick={distribuir}
          className="min-h-11 rounded-md border border-borda px-3 text-sm font-semibold disabled:opacity-40"
        >
          <Icone nome="relogio" tamanho={16} className="mr-1.5" />
          Distribuir horários
        </button>
      </div>

      {fixas > 0 && (
        <p className="text-xs text-tinta-fraca">
          {fixas} parada{fixas > 1 ? "s" : ""} com hora marcada não será movida nem
          reescrita.
        </p>
      )}
    </section>
  );
}
