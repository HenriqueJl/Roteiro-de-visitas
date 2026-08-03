"use client";

/**
 * Kanban de estágio (seção 6.4).
 *
 * Duas decisões que valem registro:
 *
 * 1. **Mover por botão, e também por arraste.** A especificação pede "arrastar
 *    card muda o estágio", mas arraste HTML5 não existe em toque — no Android,
 *    que é o aparelho real deste app, `dragstart` nunca dispara. Implementar
 *    arraste por pointer events daria uma biblioteca inteira de trabalho para um
 *    gesto impreciso com o dedo, numa coluna que rola na horizontal. Então cada
 *    card tem ← → (funciona em qualquer lugar, com alvo de 44px) e o arraste
 *    nativo fica por cima, para quando ele abrir no computador.
 *
 * 2. **Não se entra em "Perdido" pelo quadro.** A coluna aparece — esconder o
 *    que se perdeu seria mentir sobre o funil — mas ela não aceita card. Marcar
 *    perdido exige motivo (P2), e o único lugar que coleta motivo é o registro
 *    de interação. Deixar o quadro fazer isso em silêncio esvaziaria a única
 *    trava que impede o pipeline de apodrecer. Sair de "Perdido" é permitido:
 *    reabrir um cliente não descarta informação nenhuma.
 */

import { useState } from "react";
import Link from "next/link";
import { diasDesde } from "@/lib/datas";
import {
  ICONE_TIPO_CLIENTE,
  LABEL_ESTAGIO,
  estagiosDoFunil,
  type Cliente,
  type Estagio,
  type Funil,
} from "@/lib/types";
import { Icone } from "@/lib/icones";

export function Kanban({
  clientes,
  funil,
  diasAlerta,
  aoMover,
}: {
  clientes: Cliente[];
  funil: Funil;
  diasAlerta: number;
  aoMover: (id: string, estagio: Estagio) => void;
}) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<Estagio | null>(null);

  const colunas = estagiosDoFunil(funil);
  /**
   * Destinos válidos: tudo menos "Perdido" — ver o cabeçalho do arquivo.
   * O tipo é anotado de propósito: sem isso o TS estreita para
   * `Exclude<Estagio, "perdido">[]` e `indexOf(c.estagio)` deixa de compilar,
   * quando procurar e não achar é justamente o caso que interessa aqui.
   */
  const destinos: Estagio[] = colunas.filter((e) => e !== "perdido");

  function mover(c: Cliente, direcao: -1 | 1) {
    const i = destinos.indexOf(c.estagio);
    // Um cliente em "Perdido" não está em `destinos`: ← o devolve ao último
    // estágio real do funil.
    const alvo =
      i === -1
        ? direcao === -1
          ? destinos[destinos.length - 1]
          : undefined
        : destinos[i + direcao];
    if (alvo && alvo !== c.estagio) aoMover(c.id, alvo);
  }

  function podeMover(c: Cliente, direcao: -1 | 1): boolean {
    const i = destinos.indexOf(c.estagio);
    if (i === -1) return direcao === -1;
    return i + direcao >= 0 && i + direcao < destinos.length;
  }

  return (
    /* Altura fixa e rolagem por coluna. Sem isso, a coluna "Prospect" com os 40
       clientes do seed estica a página para nove mil pixels e as outras colunas
       ficam sendo espaço vazio ao lado — no celular ele rolaria um quarteirão
       para não ver nada. */
    <div className="flex h-[62dvh] snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
      {colunas.map((estagio) => {
        const daColuna = clientes.filter((c) => c.estagio === estagio);
        const aceita = estagio !== "perdido";
        const realcada = sobre === estagio && aceita;
        return (
          <section
            key={estagio}
            onDragOver={(e) => {
              if (!aceita || !arrastando) return;
              e.preventDefault();
              setSobre(estagio);
            }}
            onDragLeave={() => setSobre((a) => (a === estagio ? null : a))}
            onDrop={(e) => {
              e.preventDefault();
              setSobre(null);
              if (aceita && arrastando) aoMover(arrastando, estagio);
              setArrastando(null);
            }}
            className={`flex h-full w-64 shrink-0 snap-start flex-col rounded-lg border p-2 ${
              realcada ? "border-marca bg-marca/5" : "border-borda bg-carta/60"
            }`}
          >
            <header className="flex shrink-0 items-baseline justify-between px-1 pb-2">
              <h3 className="text-sm font-bold">{LABEL_ESTAGIO[estagio]}</h3>
              <span className="text-sm font-semibold text-tinta-fraca">
                {daColuna.length}
              </span>
            </header>

            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
              {daColuna.map((c) => {
                const dias = c.ultimoContatoEm ? diasDesde(c.ultimoContatoEm) : null;
                const esquecido = dias !== null && dias > diasAlerta;
                return (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={() => setArrastando(c.id)}
                    onDragEnd={() => {
                      setArrastando(null);
                      setSobre(null);
                    }}
                    className={`rounded-md border border-borda bg-carta p-2 ${
                      arrastando === c.id ? "opacity-50" : ""
                    }`}
                  >
                    <Link href={`/clientes/ficha?id=${c.id}`} className="block">
                      <span className="flex items-start gap-1.5">
                        <Icone nome={ICONE_TIPO_CLIENTE[c.tipo]} tamanho={16} className="mt-0.5 text-tinta-fraca" />
                        <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">
                          {c.nome}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-tinta-fraca">
                        {c.cidade}
                        {c.bairro && ` · ${c.bairro}`}
                      </span>
                      {esquecido && (
                        <span className="mt-0.5 block text-xs font-bold text-perigo">
                          {dias} d sem contato
                        </span>
                      )}
                      {dias === null && (
                        <span className="mt-0.5 block text-xs text-tinta-fraca">
                          nunca visitado
                        </span>
                      )}
                    </Link>

                    <div className="mt-1.5 flex gap-1">
                      <button
                        type="button"
                        disabled={!podeMover(c, -1)}
                        onClick={() => mover(c, -1)}
                        aria-label={`Voltar ${c.nome} um estágio`}
                        className="flex-1 rounded-md border border-borda text-sm font-bold text-tinta-fraca disabled:opacity-30"
                        style={{ minHeight: 36 }}
                      >
                        <Icone nome="seta-esquerda" tamanho={16} />
                      </button>
                      <button
                        type="button"
                        disabled={!podeMover(c, 1)}
                        onClick={() => mover(c, 1)}
                        aria-label={`Avançar ${c.nome} um estágio`}
                        className="flex-1 rounded-md border border-borda text-sm font-bold text-marca disabled:opacity-30"
                        style={{ minHeight: 36 }}
                      >
                        <Icone nome="seta-direita" tamanho={16} />
                      </button>
                    </div>
                  </li>
                );
              })}

              {daColuna.length === 0 && (
                <li className="px-1 py-4 text-center text-xs text-tinta-fraca">
                  {aceita ? "Vazia" : "Nenhum perdido"}
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
