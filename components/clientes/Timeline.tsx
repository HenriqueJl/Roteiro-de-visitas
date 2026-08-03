"use client";

import { fmtInstante, fmtPrazo } from "@/lib/datas";
import {
  ICONE_RESULTADO,
  LABEL_OBJECAO,
  LABEL_PRODUTO,
  LABEL_RESULTADO,
  LABEL_TIPO_INTERACAO,
  type Interacao,
} from "@/lib/types";

/** Histórico em ordem inversa — o que aconteceu, do mais recente ao mais antigo. */
export function Timeline({ interacoes }: { interacoes: Interacao[] }) {
  if (interacoes.length === 0) {
    return (
      <p className="rounded-xl border border-borda bg-carta p-4 text-center text-sm text-tinta-fraca">
        Nenhuma interação registrada ainda.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {interacoes.map((i) => (
        <li key={i.id} className="rounded-xl border border-borda bg-carta p-3">
          <div className="flex items-baseline gap-2">
            <span aria-hidden>{ICONE_RESULTADO[i.resultado]}</span>
            <span className="font-bold">{LABEL_RESULTADO[i.resultado]}</span>
            <span className="text-sm text-tinta-fraca">
              {LABEL_TIPO_INTERACAO[i.tipo]}
            </span>
            <span className="ml-auto shrink-0 text-xs text-tinta-fraca">
              {fmtInstante(i.data)}
            </span>
          </div>

          {i.contatoFalado?.nome && (
            <p className="mt-1 text-sm">
              👤 {i.contatoFalado.nome}
              {i.contatoFalado.cargo && ` — ${i.contatoFalado.cargo}`}
            </p>
          )}

          {i.produtosApresentados.length > 0 && (
            <p className="mt-1 text-sm text-tinta-fraca">
              Apresentou: {i.produtosApresentados.map((p) => LABEL_PRODUTO[p]).join(", ")}
            </p>
          )}

          {i.objecao && (
            <p className="mt-1 text-sm">
              <span className="rounded bg-fundo px-1.5 py-0.5 text-xs font-bold text-alerta ring-1 ring-borda">
                {LABEL_OBJECAO[i.objecao]}
              </span>
              {i.objecaoObs && <span className="text-tinta-fraca"> — {i.objecaoObs}</span>}
            </p>
          )}

          {i.amostraDeixada && (
            <p className="mt-1 text-sm">
              🎁 Amostra: {LABEL_PRODUTO[i.amostraDeixada.produto]} ({i.amostraDeixada.qtd}) ·
              retorno {fmtPrazo(i.amostraDeixada.retornoEm)}
            </p>
          )}

          {i.notas && <p className="mt-1 text-sm italic text-tinta-fraca">“{i.notas}”</p>}

          {i.encerramento ? (
            <p className="mt-2 border-t border-borda pt-2 text-sm font-semibold text-perigo">
              Encerrado — {i.encerramento.motivo}
            </p>
          ) : (
            i.proximoPasso && (
              <p className="mt-2 border-t border-borda pt-2 text-sm">
                → {i.proximoPasso}
                {i.proximoPassoEm && (
                  <span className="text-tinta-fraca"> ({fmtPrazo(i.proximoPassoEm)})</span>
                )}
              </p>
            )
          )}
        </li>
      ))}
    </ol>
  );
}
