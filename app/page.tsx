"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { fmtDiaExtenso, fmtMoeda, fmtPrazo, hoje, paraCivil } from "@/lib/datas";
import { CardParada } from "@/components/hoje/CardParada";
import { NotaRapida } from "@/components/hoje/NotaRapida";
import { EscolherCliente } from "@/components/registro/EscolherCliente";
import { SheetRegistro, type AlvoRegistro } from "@/components/registro/SheetRegistro";
import type { Cliente, Tarefa } from "@/lib/types";
import { Icone } from "@/lib/icones";
import { Aviso, useAviso } from "@/components/Aviso";

/**
 * Tela Hoje — a mais importante do app (seção 6.1).
 *
 * Aceita `?data=AAAA-MM-DD` para inspecionar outro dia. Existe para teste e
 * para espiar o dia seguinte; a rua usa sempre o padrão, que é hoje.
 */
function TelaHoje() {
  const params = useSearchParams();
  const dataAtual = params.get("data") ?? hoje();

  const { aviso, avisar } = useAviso();
  const [notaAberta, setNotaAberta] = useState(false);
  const [fabAberto, setFabAberto] = useState(false);
  const [registro, setRegistro] = useState<AlvoRegistro | null>(null);
  const [escolherAberto, setEscolherAberto] = useState(false);

  // `?? null` distingue "carregando" (undefined) de "não existe" (null).
  const roteiro = useLiveQuery(
    async () => (await db.roteiros.where("data").equals(dataAtual).first()) ?? null,
    [dataAtual],
  );
  const proximoDia = useLiveQuery(
    async () => (await db.roteiros.where("data").above(dataAtual).sortBy("data"))[0] ?? null,
    [dataAtual],
  );
  const clientes = useLiveQuery(() => db.clientes.toArray(), []);
  const tarefasAbertas = useLiveQuery(
    async () =>
      (await db.tarefas.where("vencimentoEm").belowOrEqual(dataAtual).toArray()).filter(
        (t) => !t.concluida,
      ),
    [dataAtual],
  );
  const interacoesDoDia = useLiveQuery(
    async () =>
      (await db.interacoes.toArray()).filter(
        (i) => paraCivil(new Date(i.data)) === dataAtual,
      ),
    [dataAtual],
  );
  const pedidosDoDia = useLiveQuery(
    () => db.pedidos.where("data").equals(dataAtual).toArray(),
    [dataAtual],
  );

  const porId = useMemo(
    () => new Map((clientes ?? []).map((c) => [c.id, c])),
    [clientes],
  );

  // Alertas na ordem de prioridade da especificação.
  const { amostras, atrasadas, tarefasDoDia } = useMemo(() => {
    const porVencimento = (a: Tarefa, b: Tarefa) =>
      a.vencimentoEm.localeCompare(b.vencimentoEm);
    const lista = tarefasAbertas ?? [];
    return {
      amostras: lista.filter((t) => t.origem === "retorno_amostra").sort(porVencimento),
      atrasadas: lista
        .filter((t) => t.origem !== "retorno_amostra" && t.vencimentoEm < dataAtual)
        .sort(porVencimento),
      tarefasDoDia: lista.filter(
        (t) => t.origem !== "retorno_amostra" && t.vencimentoEm === dataAtual,
      ),
    };
  }, [tarefasAbertas, dataAtual]);

  // Concluída vai para o fim, mantendo a ordem da rota dentro de cada grupo.
  const paradas = useMemo(() => {
    if (!roteiro) return [];
    return [...roteiro.paradas].sort(
      (a, b) => Number(a.concluida) - Number(b.concluida) || a.ordem - b.ordem,
    );
  }, [roteiro]);

  const concluidas = paradas.filter((p) => p.concluida).length;

  const resumo = useMemo(() => {
    const visitas = (interacoesDoDia ?? []).filter((i) =>
      ["visita", "demonstracao", "entrega"].includes(i.tipo),
    ).length;
    const validos = (pedidosDoDia ?? []).filter((p) => p.status !== "cancelado");
    return {
      visitas,
      pedidos: validos.length,
      valor: validos.reduce((s, p) => s + p.valorTotal, 0),
    };
  }, [interacoesDoDia, pedidosDoDia]);

  const carregando = clientes === undefined || roteiro === undefined;

  return (
    <main>
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 px-4 py-3 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-wide text-tinta-fraca">
          {fmtDiaExtenso(dataAtual)}
        </p>
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="truncate text-xl font-bold">
            {roteiro ? roteiro.cidade : "Hoje"}
          </h1>
          {roteiro && (
            <span className="shrink-0 text-sm font-bold text-marca">
              {concluidas} de {paradas.length} visitas
            </span>
          )}
        </div>
        {roteiro?.titulo && (
          <p className="truncate text-sm text-tinta-fraca">{roteiro.titulo}</p>
        )}
      </header>

      <div className="space-y-3 px-4 py-3">
        {carregando && <p className="py-8 text-center text-tinta-fraca">Carregando…</p>}

        {!carregando && (
          <>
            {/* --- Alertas, na ordem: amostras → atrasadas → de hoje --- */}
            {amostras.length > 0 && (
              <BlocoAlerta
                titulo="Amostras vencendo"
                cor="border-l-perigo"
                tarefas={amostras}
                porId={porId}
                base={dataAtual}
              />
            )}
            {atrasadas.length > 0 && (
              <BlocoAlerta
                titulo="Tarefas atrasadas"
                cor="border-l-alerta"
                tarefas={atrasadas}
                porId={porId}
                base={dataAtual}
              />
            )}
            {tarefasDoDia.length > 0 && (
              <BlocoAlerta
                titulo="Para hoje"
                cor="border-l-marca"
                tarefas={tarefasDoDia}
                porId={porId}
                base={dataAtual}
              />
            )}

            {/* --- Paradas do dia --- */}
            {roteiro === null ? (
              <div className="rounded-lg border border-borda bg-carta p-6 text-center">
                <p className="font-semibold">Sem roteiro para hoje.</p>
                {proximoDia && (
                  <p className="mt-1 text-sm text-tinta-fraca">
                    Próximo dia de rua: {fmtDiaExtenso(proximoDia.data)} —{" "}
                    {proximoDia.cidade} ({proximoDia.paradas.length} paradas)
                  </p>
                )}
                <Link
                  href="/roteiro"
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-marca px-5 font-bold text-white"
                >
                  Ver roteiro
                </Link>
              </div>
            ) : (
              <>
                {roteiro.observacao && (
                  <p className="rounded-md bg-carta px-3 py-2 text-sm text-tinta-fraca">
                    <Icone nome="info" tamanho={15} className="mr-1 inline-block -mt-0.5" />
                    {roteiro.observacao}
                  </p>
                )}
                {/* Coluna única no celular; duas colunas no computador. A ordem
                    da rota continua sendo a de leitura: esquerda→direita, linha
                    a linha. */}
                <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                  {paradas.map((p) => {
                    const cliente = porId.get(p.clienteId);
                    if (!cliente) return null;
                    return (
                      <CardParada
                        key={p.clienteId}
                        parada={p}
                        cliente={cliente}
                        aoRegistrar={(parada, c) =>
                          setRegistro({ cliente: c, parada, roteiroId: roteiro.id })
                        }
                      />
                    );
                  })}
                </div>
                {roteiro.tardeLivre && (
                  <p className="rounded-md bg-carta px-3 py-2 text-sm text-tinta-fraca">
                    <Icone nome="telefone" tamanho={15} className="mr-1 inline-block -mt-0.5" />
                    Tarde reservada para follow-up telefônico e consolidação.
                  </p>
                )}
              </>
            )}

            {/* --- Rodapé: mini-resumo do dia --- */}
            <section className="flex justify-between rounded-lg border border-borda bg-carta px-4 py-3 text-sm">
              <span>
                <strong>{resumo.visitas}</strong> visita{resumo.visitas === 1 ? "" : "s"}
              </span>
              <span>
                <strong>{resumo.pedidos}</strong> pedido{resumo.pedidos === 1 ? "" : "s"}
              </span>
              <span className="font-bold">{fmtMoeda(resumo.valor)}</span>
            </section>
          </>
        )}
      </div>

      {/* --- Botão flutuante --- */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 pb-[env(safe-area-inset-bottom)]">
        {fabAberto && (
          <>
            <button
              type="button"
              onClick={() => {
                setFabAberto(false);
                setNotaAberta(true);
              }}
              className="rounded-md bg-carta px-4 py-2.5 text-sm font-bold shadow-lg ring-1 ring-borda"
            >
              <Icone nome="notas" tamanho={17} className="mr-1.5 inline-block -mt-0.5" />
              Nota rápida
            </button>
            <button
              type="button"
              onClick={() => {
                setFabAberto(false);
                setEscolherAberto(true);
              }}
              className="rounded-md bg-carta px-4 py-2.5 text-sm font-bold shadow-lg ring-1 ring-borda"
            >
              <Icone nome="mais" tamanho={17} className="mr-1.5 inline-block -mt-0.5" />
              Visita fora do roteiro
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setFabAberto((v) => !v)}
          aria-label={fabAberto ? "Fechar ações" : "Abrir ações"}
          aria-expanded={fabAberto}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-marca text-2xl font-bold text-white shadow-lg active:bg-marca-forte"
        >
          <Icone nome={fabAberto ? "fechar" : "mais"} tamanho={24} />
        </button>
      </div>

      <NotaRapida
        aberta={notaAberta}
        aoFechar={() => setNotaAberta(false)}
        aoSalvar={() => {
          setNotaAberta(false);
          avisar("Nota salva.");
        }}
      />

      {escolherAberto && (
        <EscolherCliente
          cidadeDoDia={roteiro?.cidade}
          aoFechar={() => setEscolherAberto(false)}
          aoEscolher={(c) => {
            setEscolherAberto(false);
            setRegistro({ cliente: c });
          }}
        />
      )}

      {registro && (
        <SheetRegistro
          key={registro.cliente.id}
          alvo={registro}
          aoFechar={() => setRegistro(null)}
          aoSalvo={(i) => {
            setRegistro(null);
            avisar(
              i.resultado === "pedido"
                ? "Registrado! Lance o pedido em Vendas."
                : i.encerramento
                  ? "Cliente encerrado."
                  : "Visita registrada.",
            );
          }}
        />
      )}

      <Aviso texto={aviso} />
    </main>
  );
}

function BlocoAlerta({
  titulo,
  cor,
  tarefas,
  porId,
  base,
}: {
  titulo: string;
  cor: string;
  tarefas: Tarefa[];
  porId: Map<string, Cliente>;
  base: string;
}) {
  return (
    <section className={`rounded-lg border border-borda bg-carta border-l-4 ${cor} px-4 py-3`}>
      <h2 className="text-sm font-bold">{titulo}</h2>
      <ul className="mt-1 space-y-1">
        {tarefas.map((t) => (
          <li key={t.id} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0">
              <span className="font-medium">{t.titulo}</span>
              {t.clienteId && porId.get(t.clienteId) && (
                <span className="text-tinta-fraca"> · {porId.get(t.clienteId)!.nome}</span>
              )}
            </span>
            <span className="shrink-0 text-xs font-semibold text-tinta-fraca">
              {fmtPrazo(t.vencimentoEm, base)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Pagina() {
  return (
    <Suspense fallback={null}>
      <TelaHoje />
    </Suspense>
  );
}
