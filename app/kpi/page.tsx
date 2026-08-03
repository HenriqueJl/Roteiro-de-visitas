"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { fmtCurto } from "@/lib/datas";
import { estoqueAtual, fluxoDaSemana, semanaAnteriorA, semanaDe } from "@/lib/kpi";
import { CartaoAgora, CartaoKpi } from "@/components/kpi/CartaoKpi";
import { BlocoBackup } from "@/components/kpi/Backup";

export default function Kpi() {
  const clientes = useLiveQuery(() => db.clientes.toArray(), []);
  const interacoes = useLiveQuery(() => db.interacoes.toArray(), []);
  const pedidos = useLiveQuery(() => db.pedidos.toArray(), []);
  const tarefas = useLiveQuery(() => db.tarefas.toArray(), []);

  const carregando =
    clientes === undefined ||
    interacoes === undefined ||
    pedidos === undefined ||
    tarefas === undefined;

  const dados = useMemo(() => {
    if (carregando) return null;
    const semana = semanaDe();
    const anterior = semanaAnteriorA(semana);
    return {
      semana,
      anterior,
      atual: fluxoDaSemana(interacoes, pedidos, semana),
      passada: fluxoDaSemana(interacoes, pedidos, anterior),
      estoque: estoqueAtual(clientes, tarefas),
    };
  }, [carregando, clientes, interacoes, pedidos, tarefas]);

  return (
    <main>
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 px-4 py-3 backdrop-blur">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold">KPI da semana</h1>
          <Link href="/config" className="text-sm font-semibold text-marca underline">
            Ajustes
          </Link>
        </div>
        {dados && (
          <p className="text-sm text-tinta-fraca">
            Semana de {fmtCurto(dados.semana.de)} · comparada com{" "}
            {fmtCurto(dados.anterior.de)}
          </p>
        )}
      </header>

      <div className="space-y-4 px-4 py-3">
        {!dados ? (
          <p className="py-8 text-center text-tinta-fraca">Carregando…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <CartaoKpi
                rotulo="Visitas realizadas"
                valor={dados.atual.visitas}
                anterior={dados.passada.visitas}
              />
              <CartaoKpi
                rotulo="Pedidos fechados"
                valor={dados.atual.pedidos}
                anterior={dados.passada.pedidos}
              />
              <CartaoKpi
                rotulo="Taxa de conversão"
                valor={dados.atual.conversao}
                anterior={dados.passada.conversao}
                unidade="porcento"
                detalhe={`${dados.atual.visitasComPedido} de ${dados.atual.visitas} ${
                  dados.atual.visitas === 1 ? "visita" : "visitas"
                }`}
              />
              <CartaoKpi
                rotulo="Faturamento"
                valor={dados.atual.faturamento}
                anterior={dados.passada.faturamento}
                unidade="moeda"
              />
              <CartaoKpi
                rotulo="Demonstrações"
                valor={dados.atual.demonstracoes}
                anterior={dados.passada.demonstracoes}
              />
              <CartaoKpi
                rotulo="Decisores mapeados"
                valor={dados.atual.decisoresMapeados}
                anterior={dados.passada.decisoresMapeados}
                detalhe="1ª vez que o contato foi nomeado"
              />
              <CartaoKpi
                rotulo="Amostras deixadas"
                valor={dados.atual.amostrasDeixadas}
                anterior={dados.passada.amostrasDeixadas}
              />
            </div>

            {/* Estoque: número do agora, sem comparação semanal (ver lib/kpi.ts). */}
            <div>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-fraca">
                Agora
              </h2>
              <div className="grid grid-cols-2 gap-2 md:max-w-md">
                <CartaoAgora
                  rotulo="Amostras em teste"
                  valor={dados.estoque.amostrasEmTeste}
                  detalhe="Retorno ainda em aberto"
                />
                <CartaoAgora
                  rotulo="Oportunidades abertas"
                  valor={dados.estoque.oportunidadesAbertas}
                  detalhe="Clientes que saíram de prospect"
                />
              </div>
            </div>

            <BlocoBackup />
          </>
        )}
      </div>
    </main>
  );
}
