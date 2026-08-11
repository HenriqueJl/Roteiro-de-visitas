"use client";

/**
 * Lançamento de pedido (seção 6.5).
 *
 * O preço unitário vem pré-preenchido com o último praticado para aquele
 * produto (`config.precoPorProduto`), que `criarPedido` atualiza a cada venda.
 * É o que evita redigitar tabela de preço na calçada.
 */

import { useEffect, useMemo, useState } from "react";
import { criarPedido, lerConfig } from "@/lib/api";
import { fmtMoeda, hoje } from "@/lib/datas";
import {
  FORMAS_PAGAMENTO,
  LABEL_FORMA_PAGAMENTO,
  LABEL_PRODUTO,
  LABEL_STATUS_PEDIDO,
  PRODUTOS_POR_TIPO,
  STATUS_PEDIDO,
  valorItem,
  valorPedido,
  type Cliente,
  type FormaPagamento,
  type ItemPedido,
  type Produto,
  type StatusPedido,
} from "@/lib/types";

const campo = "w-full rounded-md border border-borda bg-fundo p-3";

/** Aceita "12,50" e "12.50" — o teclado do celular oferece vírgula. */
function paraNumero(t: string): number {
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function FormPedido({
  cliente,
  aoFechar,
  aoSalvo,
}: {
  cliente: Cliente;
  aoFechar: () => void;
  aoSalvo: (valor: number) => void;
}) {
  const [itens, setItens] = useState<ItemPedido[]>([]);
  /**
   * Texto cru do campo de preço, por produto.
   *
   * O número mora em `itens`, mas o que o usuário digita mora aqui: sem isso o
   * campo precisaria ser não controlado para aceitar estados intermediários
   * ("18," antes de "18,50"), e aí o texto na tela passa a divergir do estado
   * a cada re-render. Controlado com texto próprio resolve os dois.
   */
  const [precoTexto, setPrecoTexto] = useState<Partial<Record<Produto, string>>>({});
  const [precosPadrao, setPrecosPadrao] = useState<Partial<Record<Produto, number>>>({});
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const [prazoDias, setPrazoDias] = useState(0);
  const [status, setStatus] = useState<StatusPedido>("pendente");
  const [data, setData] = useState(hoje());
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    lerConfig().then((c) => setPrecosPadrao(c.precoPorProduto));
  }, []);

  const disponiveis = PRODUTOS_POR_TIPO[cliente.tipo];
  const total = useMemo(() => valorPedido(itens), [itens]);

  function alternarProduto(p: Produto) {
    const jaTem = itens.some((i) => i.produto === p);
    if (jaTem) {
      setItens((atual) => atual.filter((i) => i.produto !== p));
      return;
    }
    const preco = precosPadrao[p] ?? 0;
    setPrecoTexto((t) => ({ ...t, [p]: preco ? String(preco).replace(".", ",") : "" }));
    setItens((atual) => [
      ...atual,
      { produto: p, quantidade: 1, precoUnitario: preco, desconto: 0 },
    ]);
  }

  function editarItem(p: Produto, patch: Partial<ItemPedido>) {
    setItens((atual) => atual.map((i) => (i.produto === p ? { ...i, ...patch } : i)));
  }

  const temPrecoZerado = itens.some((i) => i.precoUnitario <= 0);

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      await criarPedido({
        clienteId: cliente.id,
        data,
        itens,
        formaPagamento,
        prazoDias,
        status,
        observacoes: observacoes.trim(),
      });
      aoSalvo(total);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={aoFechar}>
      <div
        className="flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-carta"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-borda px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Novo pedido</h2>
            <p className="truncate text-sm text-tinta-fraca">{cliente.nome}</p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={aoFechar}
            className="w-10 shrink-0 text-2xl text-tinta-fraca"
          >
            ×
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <p className="text-sm font-bold">Produtos</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {disponiveis.map((p) => {
                const ativo = itens.some((i) => i.produto === p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => alternarProduto(p)}
                    className={`rounded-full px-3 py-2 text-sm font-semibold ${
                      ativo ? "bg-marca text-white" : "border border-borda bg-fundo"
                    }`}
                  >
                    {LABEL_PRODUTO[p]}
                  </button>
                );
              })}
            </div>
          </div>

          {itens.map((i) => (
            <div key={i.produto} className="rounded-lg border border-borda bg-fundo/60 p-3">
              <div className="flex items-baseline justify-between">
                <p className="font-bold">{LABEL_PRODUTO[i.produto]}</p>
                <p className="font-bold">{fmtMoeda(valorItem(i))}</p>
              </div>
              <div className="mt-2 flex gap-2">
                <label className="flex-1 text-xs font-semibold text-tinta-fraca">
                  Qtd
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={i.quantidade}
                    onChange={(e) =>
                      editarItem(i.produto, { quantidade: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className={`${campo} mt-0.5`}
                  />
                </label>
                <label className="flex-1 text-xs font-semibold text-tinta-fraca">
                  Preço un. (R$)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={precoTexto[i.produto] ?? ""}
                    placeholder="0,00"
                    onChange={(e) => {
                      const texto = e.target.value;
                      setPrecoTexto((t) => ({ ...t, [i.produto]: texto }));
                      editarItem(i.produto, { precoUnitario: paraNumero(texto) });
                    }}
                    className={`${campo} mt-0.5`}
                  />
                </label>
                <label className="flex-1 text-xs font-semibold text-tinta-fraca">
                  Desc. (%)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    value={i.desconto || ""}
                    placeholder="0"
                    onChange={(e) =>
                      editarItem(i.produto, {
                        desconto: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                      })
                    }
                    className={`${campo} mt-0.5`}
                  />
                </label>
              </div>
            </div>
          ))}

          {itens.length > 0 && (
            <>
              <div className="flex items-baseline justify-between rounded-lg bg-fundo px-4 py-3">
                <span className="font-bold">Total</span>
                <span className="text-2xl font-bold text-marca">{fmtMoeda(total)}</span>
              </div>

              <div className="flex gap-2">
                <label className="flex-1 text-sm font-bold">
                  Pagamento
                  <select
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
                    className={`${campo} mt-1`}
                  >
                    {FORMAS_PAGAMENTO.map((f) => (
                      <option key={f} value={f}>
                        {LABEL_FORMA_PAGAMENTO[f]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex-1 text-sm font-bold">
                  Prazo (dias)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={prazoDias || ""}
                    placeholder="0"
                    onChange={(e) => setPrazoDias(Math.max(0, Number(e.target.value) || 0))}
                    className={`${campo} mt-1`}
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <label className="flex-1 text-sm font-bold">
                  Data
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => e.target.value && setData(e.target.value)}
                    className={`${campo} mt-1`}
                  />
                </label>
                <label className="flex-1 text-sm font-bold">
                  Situação
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusPedido)}
                    className={`${campo} mt-1`}
                  >
                    {STATUS_PEDIDO.map((s) => (
                      <option key={s} value={s}>
                        {LABEL_STATUS_PEDIDO[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-sm font-bold">
                Observações
                <textarea
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className={`${campo} mt-1`}
                />
              </label>
            </>
          )}
        </div>

        <div className="space-y-2 border-t border-borda px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {temPrecoZerado && (
            <p className="text-center text-sm font-semibold text-alerta">
              Há item sem preço — o pedido entra valendo menos do que vale.
            </p>
          )}
          <button
            type="button"
            onClick={salvar}
            disabled={itens.length === 0 || salvando}
            className="w-full rounded-lg bg-marca py-3.5 text-lg font-bold text-white disabled:opacity-40"
          >
            {salvando ? "Salvando…" : `Salvar pedido — ${fmtMoeda(total)}`}
          </button>
          {erro && <p className="text-center text-sm font-semibold text-perigo">{erro}</p>}
        </div>
      </div>
    </div>
  );
}
