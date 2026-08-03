"use client";

/**
 * Edição do pedido depois de lançado.
 *
 * Os itens não são editáveis aqui de propósito: mudar quantidade ou preço de um
 * pedido já lançado reescreveria faturamento passado, e aí o número que ele
 * levou ao gestor na semana anterior deixa de ser reproduzível. O que muda com o
 * tempo — status, forma de pagamento, prazo, observação — muda. Se os itens
 * estiverem errados, o caminho honesto é cancelar e lançar de novo.
 */

import { useState } from "react";
import { atualizarPedido, removerPedido } from "@/lib/db";
import { fmtData, fmtMoeda } from "@/lib/datas";
import {
  FORMAS_PAGAMENTO,
  LABEL_FORMA_PAGAMENTO,
  LABEL_PRODUTO,
  LABEL_STATUS_PEDIDO,
  STATUS_PEDIDO,
  type FormaPagamento,
  type Pedido,
  type StatusPedido,
} from "@/lib/types";
import {
  Campo,
  Sheet,
  botaoNeutro,
  botaoPerigo,
  botaoPrimario,
  entrada,
} from "@/components/Sheet";

export function EditarPedido({
  pedido,
  nomeCliente,
  aoFechar,
}: {
  pedido: Pedido;
  nomeCliente: string;
  aoFechar: () => void;
}) {
  const [status, setStatus] = useState<StatusPedido>(pedido.status);
  const [forma, setForma] = useState<FormaPagamento>(pedido.formaPagamento);
  const [prazo, setPrazo] = useState(String(pedido.prazoDias));
  const [obs, setObs] = useState(pedido.observacoes);
  const [confirmando, setConfirmando] = useState(false);

  async function salvar() {
    await atualizarPedido(pedido.id, {
      status,
      formaPagamento: forma,
      prazoDias: Math.max(0, Number(prazo) || 0),
      observacoes: obs.trim(),
    });
    aoFechar();
  }

  return (
    <Sheet
      titulo="Editar pedido"
      subtitulo={`${nomeCliente} · ${fmtData(pedido.data)} · ${fmtMoeda(pedido.valorTotal)}`}
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
                  await removerPedido(pedido.id);
                  aoFechar();
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
              Apagar pedido
            </button>
          )}
        </>
      }
    >
      <Campo rotulo="Status" dica="Cancelado sai do faturamento e do ticket médio.">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_PEDIDO.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                status === s
                  ? s === "cancelado"
                    ? "border-perigo bg-perigo text-white"
                    : "border-marca bg-marca text-white"
                  : "border-borda bg-fundo text-tinta-fraca"
              }`}
            >
              {LABEL_STATUS_PEDIDO[s]}
            </button>
          ))}
        </div>
      </Campo>

      <Campo rotulo="Forma de pagamento">
        <div className="flex flex-wrap gap-1.5">
          {FORMAS_PAGAMENTO.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setForma(f)}
              className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                forma === f
                  ? "border-marca bg-marca text-white"
                  : "border-borda bg-fundo text-tinta-fraca"
              }`}
            >
              {LABEL_FORMA_PAGAMENTO[f]}
            </button>
          ))}
        </div>
      </Campo>

      <Campo rotulo="Prazo">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={180}
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            className={`${entrada} max-w-28`}
          />
          <span className="text-sm text-tinta-fraca">dias</span>
        </div>
      </Campo>

      <Campo rotulo="Observações">
        <textarea
          rows={2}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          className={entrada}
        />
      </Campo>

      <div className="rounded-md border border-borda bg-fundo p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-tinta-fraca">
          Itens (não editáveis)
        </p>
        <ul className="mt-1 text-sm">
          {pedido.itens.map((i) => (
            <li key={i.produto}>
              {i.quantidade}× {LABEL_PRODUTO[i.produto]} · {fmtMoeda(i.precoUnitario)}
              {i.desconto > 0 && ` (−${i.desconto}%)`}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-tinta-fraca">
          Para corrigir itens, cancele este pedido e lance outro — assim o
          faturamento das semanas passadas continua reproduzível.
        </p>
      </div>
    </Sheet>
  );
}
