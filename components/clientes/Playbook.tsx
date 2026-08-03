"use client";

/**
 * Bloco colapsável de roteiro de abordagem (seção 9).
 *
 * Colapsado por padrão: na décima visita ele já sabe o roteiro de cor, e o bloco
 * aberto empurraria a timeline para fora da tela. `<details>` nativo em vez de
 * estado em React — abre e fecha sem JavaScript, o que importa quando a página
 * é servida do cache do service worker com a rede caída.
 *
 * O conteúdo vem de lib/playbooks.ts. Este componente não sabe o que há dentro
 * de um playbook: percorre as seções e desenha.
 */

import { PLAYBOOKS, produtosDoPlaybook } from "@/lib/playbooks";
import { LABEL_PRODUTO, LABEL_TIPO_CLIENTE, type TipoCliente } from "@/lib/types";
import { Icone } from "@/lib/icones";

export function Playbook({ tipo }: { tipo: TipoCliente }) {
  const pb = PLAYBOOKS[tipo];
  const produtos = produtosDoPlaybook(tipo);

  return (
    <details className="rounded-lg border border-borda bg-carta">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 p-4 font-bold marker:content-none [&::-webkit-details-marker]:hidden">
        <Icone nome="seta-direita" tamanho={16} className="text-tinta-fraca transition-transform group-open:rotate-90" />
        Como abordar {LABEL_TIPO_CLIENTE[tipo].toLowerCase()}
      </summary>

      <div className="space-y-3 border-t border-borda p-4 pt-3">
        <p className="text-sm font-semibold">{pb.resumo}</p>

        {pb.secoes.map((s) => (
          <div key={s.titulo}>
            <h3 className="text-xs font-bold uppercase tracking-wide text-tinta-fraca">
              {s.titulo}
            </h3>
            {s.ordenado ? (
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
                {s.itens.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ol>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {s.itens.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </div>
        ))}

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-tinta-fraca">
            Levar na mochila
          </h3>
          <p className="mt-1 text-sm">
            {produtos.map((p) => LABEL_PRODUTO[p]).join(" · ")}
          </p>
        </div>
      </div>
    </details>
  );
}
