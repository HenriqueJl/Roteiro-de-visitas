"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { fmtData, fmtMoeda } from "@/lib/datas";
import { FormPedido } from "@/components/vendas/FormPedido";
import { Analise } from "@/components/vendas/Analise";
import { EditarPedido } from "@/components/vendas/EditarPedido";
import { EscolherCliente } from "@/components/registro/EscolherCliente";
import {
  ICONE_TIPO_CLIENTE,
  LABEL_FORMA_PAGAMENTO,
  LABEL_PRODUTO,
  LABEL_STATUS_PEDIDO,
  type Cliente,
  type Pedido,
} from "@/lib/types";
import { Icone } from "@/lib/icones";
import { Aviso, useAviso } from "@/components/Aviso";

function TelaVendas() {
  const params = useSearchParams();
  const clientePreSelecionado = params.get("cliente");

  const { aviso, avisar } = useAviso(3000);
  const [alvo, setAlvo] = useState<Cliente | null>(null);
  const [escolherAberto, setEscolherAberto] = useState(false);
  const [pedidoEmEdicao, setPedidoEmEdicao] = useState<Pedido | null>(null);


  const clientes = useLiveQuery(() => db.clientes.toArray(), []);
  const pedidos = useLiveQuery(
    async () => (await db.pedidos.toArray()).sort((a, b) => b.data.localeCompare(a.data)),
    [],
  );
  const interacoes = useLiveQuery(() => db.interacoes.toArray(), []);

  const porId = useMemo(() => new Map((clientes ?? []).map((c) => [c.id, c])), [clientes]);

  // Vindo da ficha do cliente (`/vendas?cliente=…`), abre o formulário direto.
  useEffect(() => {
    if (!clientePreSelecionado || !clientes) return;
    const c = clientes.find((x) => x.id === clientePreSelecionado);
    if (c) setAlvo(c);
  }, [clientePreSelecionado, clientes]);

  return (
    <main>
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-bold">Vendas</h1>
      </header>

      <div className="space-y-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setEscolherAberto(true)}
          className="w-full rounded-lg bg-marca py-3.5 text-lg font-bold text-white active:bg-marca-forte"
        >
          + Lançar pedido
        </button>

        {clientes === undefined || pedidos === undefined || interacoes === undefined ? (
          <p className="py-8 text-center text-tinta-fraca">Carregando…</p>
        ) : (
          <Analise clientes={clientes} pedidos={pedidos} interacoes={interacoes} />
        )}

        <h2 className="pt-1 text-xs font-bold uppercase tracking-wide text-tinta-fraca">
          Últimos pedidos
        </h2>

        {pedidos === undefined ? (
          <p className="py-8 text-center text-tinta-fraca">Carregando…</p>
        ) : pedidos.length === 0 ? (
          <p className="rounded-lg border border-borda bg-carta p-6 text-center text-sm text-tinta-fraca">
            Nenhum pedido lançado ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {pedidos.map((p) => {
              const c = porId.get(p.clienteId);
              return (
                <li key={p.id} className="rounded-lg border border-borda bg-carta p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {c ? (
                        <Link
                          href={`/clientes/ficha?id=${c.id}`}
                          className="block truncate font-bold"
                        >
                          <Icone nome={ICONE_TIPO_CLIENTE[c.tipo]} className="inline-block -mt-0.5 mr-1 text-tinta-fraca" />
                          {c.nome}
                        </Link>
                      ) : (
                        <p className="truncate font-bold text-tinta-fraca">Cliente removido</p>
                      )}
                      <p className="text-sm text-tinta-fraca">
                        {fmtData(p.data)} · {LABEL_FORMA_PAGAMENTO[p.formaPagamento]}
                        {p.prazoDias > 0 && ` ${p.prazoDias}d`} ·{" "}
                        {LABEL_STATUS_PEDIDO[p.status]}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`font-bold ${
                          p.status === "cancelado" ? "text-tinta-fraca line-through" : "text-marca"
                        }`}
                      >
                        {fmtMoeda(p.valorTotal)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Editar pedido de ${c?.nome ?? "cliente removido"}`}
                        onClick={() => setPedidoEmEdicao(p)}
                        className="rounded-md border border-borda p-1.5 text-tinta-fraca"
                      >
                        <Icone nome="editar" tamanho={15} />
                      </button>
                    </div>
                  </div>
                  <ul className="mt-1 text-sm text-tinta-fraca">
                    {p.itens.map((i) => (
                      <li key={i.produto}>
                        {i.quantidade}× {LABEL_PRODUTO[i.produto]} ·{" "}
                        {fmtMoeda(i.precoUnitario)}
                        {i.desconto > 0 && ` (−${i.desconto}%)`}
                      </li>
                    ))}
                  </ul>
                  {p.observacoes && (
                    <p className="mt-1 text-sm italic text-tinta-fraca">“{p.observacoes}”</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {escolherAberto && (
        <EscolherCliente
          aoFechar={() => setEscolherAberto(false)}
          aoEscolher={(c) => {
            setEscolherAberto(false);
            setAlvo(c);
          }}
        />
      )}

      {alvo && (
        <FormPedido
          key={alvo.id}
          cliente={alvo}
          aoFechar={() => setAlvo(null)}
          aoSalvo={(v) => {
            setAlvo(null);
            avisar(`Pedido de ${fmtMoeda(v)} lançado.`);
          }}
        />
      )}

      {pedidoEmEdicao && (
        <EditarPedido
          pedido={pedidoEmEdicao}
          nomeCliente={porId.get(pedidoEmEdicao.clienteId)?.nome ?? "Cliente removido"}
          aoFechar={() => setPedidoEmEdicao(null)}
        />
      )}

      <Aviso texto={aviso} />
    </main>
  );
}

export default function Pagina() {
  return (
    <Suspense fallback={null}>
      <TelaVendas />
    </Suspense>
  );
}
