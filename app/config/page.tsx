"use client";

/**
 * Ajustes.
 *
 * O tipo `Config` existia desde o começo, mas os valores estavam presos no
 * código: mudar o prazo de retorno de amostra exigia editar um arquivo. Todos
 * eles governam comportamento que o uso real vai contrariar — o limite de 6
 * paradas vale para Varginha e não vale para o Centro de Três Corações, onde as
 * lojas ficam na mesma rua.
 *
 * Fica fora da barra de navegação de propósito: é tela de ajuste, aberta uma vez
 * por mês, e a barra é para o que ele usa na rua.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { lerConfig, salvarConfig } from "@/lib/api";
import { fmtMoeda } from "@/lib/datas";
import { Icone } from "@/lib/icones";
import { CONFIG_PADRAO, LABEL_PRODUTO, PRODUTOS, type Config } from "@/lib/types";
import { Campo, entrada } from "@/components/Sheet";
import { Aviso, useAviso } from "@/components/Aviso";

export default function Ajustes() {
  const { aviso, avisar } = useAviso(1500);
  const [cfg, setCfg] = useState<Config | null>(null);

  useEffect(() => {
    lerConfig().then(setCfg);
  }, []);

  async function mudar(patch: Partial<Config>) {
    const novo = await salvarConfig(patch);
    setCfg(novo);
    avisar("Salvo.");
  }

  if (!cfg) return <p className="p-8 text-center text-tinta-fraca">Carregando…</p>;

  const numero = (v: string, min: number, max: number, atual: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : atual;
  };

  return (
    <main>
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-borda bg-fundo/95 px-4 py-3 backdrop-blur">
        <Link href="/kpi" aria-label="Voltar" className="w-8 text-tinta-fraca">
          <Icone nome="seta-esquerda" tamanho={22} />
        </Link>
        <h1 className="text-xl font-bold">Ajustes</h1>
      </header>

      <div className="space-y-3 px-4 py-3">
        <section className="space-y-4 rounded-lg border border-borda bg-carta p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-tinta-fraca">
            Cobranças
          </h2>

          <Campo
            rotulo="Retorno de amostra"
            dica="Dias até a cobrança da amostra deixada (P3). Padrão: 7."
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={90}
                value={cfg.diasRetornoAmostra}
                onChange={(e) =>
                  mudar({
                    diasRetornoAmostra: numero(e.target.value, 1, 90, cfg.diasRetornoAmostra),
                  })
                }
                className={`${entrada} max-w-28`}
              />
              <span className="text-sm text-tinta-fraca">dias</span>
            </div>
          </Campo>

          <Campo
            rotulo="Alerta de cliente esquecido"
            dica="Dias sem contato para o cliente aparecer marcado no CRM."
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={3}
                max={180}
                value={cfg.diasSemContatoAlerta}
                onChange={(e) =>
                  mudar({
                    diasSemContatoAlerta: numero(e.target.value, 3, 180, cfg.diasSemContatoAlerta),
                  })
                }
                className={`${entrada} max-w-28`}
              />
              <span className="text-sm text-tinta-fraca">dias</span>
            </div>
          </Campo>
        </section>

        <section className="space-y-4 rounded-lg border border-borda bg-carta p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-tinta-fraca">
            Geração de roteiro
          </h2>

          <Campo
            rotulo="Máximo de paradas por dia"
            dica="Cinco horas de rua com deslocamento não comportam muito mais que 6."
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={12}
                value={cfg.maxParadasPorDia}
                onChange={(e) =>
                  mudar({ maxParadasPorDia: numero(e.target.value, 1, 12, cfg.maxParadasPorDia) })
                }
                className={`${entrada} max-w-28`}
              />
              <span className="text-sm text-tinta-fraca">paradas</span>
            </div>
          </Campo>

          <Campo
            rotulo="Follow-up na rota"
            dica="Quanto da semana vai para quem já foi visitado. O resto é prospecção nova."
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={10}
                value={cfg.percentualFollowUp}
                onChange={(e) => mudar({ percentualFollowUp: Number(e.target.value) })}
                className="min-w-0 flex-1 accent-marca"
              />
              <span className="w-24 text-right text-sm font-bold tabular-nums">
                {cfg.percentualFollowUp}% / {100 - cfg.percentualFollowUp}%
              </span>
            </div>
          </Campo>

          <Campo rotulo="Cidade base" dica="Ponto de partida para ordenar por proximidade.">
            <input
              value={cfg.cidadeBase}
              onChange={(e) => setCfg({ ...cfg, cidadeBase: e.target.value })}
              onBlur={(e) => mudar({ cidadeBase: e.target.value.trim() })}
              className={entrada}
            />
          </Campo>
        </section>

        <section className="space-y-3 rounded-lg border border-borda bg-carta p-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-tinta-fraca">
              Preços praticados
            </h2>
            <p className="text-xs text-tinta-fraca">
              Pré-preenchem o formulário de pedido. São atualizados sozinhos a cada
              pedido lançado — edite aqui só para corrigir.
            </p>
          </div>
          {PRODUTOS.map((p) => (
            <div key={p} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-sm">{LABEL_PRODUTO[p]}</span>
              <span className="text-sm text-tinta-fraca">R$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                defaultValue={
                  cfg.precoPorProduto[p] ? String(cfg.precoPorProduto[p]).replace(".", ",") : ""
                }
                onBlur={(e) => {
                  const n = Number(e.target.value.replace(/\./g, "").replace(",", "."));
                  const precos = { ...cfg.precoPorProduto };
                  if (Number.isFinite(n) && n > 0) precos[p] = n;
                  else delete precos[p];
                  mudar({ precoPorProduto: precos });
                }}
                className="w-24 rounded-md border border-borda bg-fundo p-2 text-right"
              />
            </div>
          ))}
          {Object.keys(cfg.precoPorProduto).length > 0 && (
            <p className="text-xs text-tinta-fraca">
              Ticket dos preços cheios:{" "}
              {fmtMoeda(
                Object.values(cfg.precoPorProduto).reduce((s, v) => s + (v ?? 0), 0),
              )}
            </p>
          )}
        </section>

        <button
          type="button"
          onClick={() => mudar(CONFIG_PADRAO)}
          className="w-full rounded-md border border-borda py-3 text-sm font-semibold text-tinta-fraca"
        >
          Voltar tudo ao padrão
        </button>

        <Aviso texto={aviso} />
      </div>
    </main>
  );
}
