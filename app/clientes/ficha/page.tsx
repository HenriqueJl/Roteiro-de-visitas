"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { alternarTarefa, atualizarCliente, db } from "@/lib/db";
import { diasDesde, fmtData, fmtMoeda, fmtPrazo, fmtRelativo } from "@/lib/datas";
import { linkGoogleMaps, linkLigar, linkWaze, linkWhatsApp } from "@/lib/links";
import { FormCliente } from "@/components/clientes/FormCliente";
import { Timeline } from "@/components/clientes/Timeline";
import { SheetRegistro } from "@/components/registro/SheetRegistro";
import {
  ICONE_TIPO_CLIENTE,
  LABEL_ESTAGIO,
  LABEL_FUNIL,
  LABEL_ORIGEM_TAREFA,
  LABEL_STATUS_CLIENTE,
  LABEL_STATUS_PEDIDO,
  LABEL_TIPO_CLIENTE,
  estagiosDoFunil,
  type Estagio,
} from "@/lib/types";

const acao =
  "flex min-h-12 flex-1 items-center justify-center gap-1 rounded-lg border border-borda bg-carta text-sm font-semibold";

function Ficha() {
  const params = useSearchParams();
  const roteador = useRouter();
  const id = params.get("id") ?? "";

  const [registroAberto, setRegistroAberto] = useState(false);
  const [editarAberto, setEditarAberto] = useState(false);
  const [toast, setToast] = useState("");

  function avisar(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const cliente = useLiveQuery(async () => (await db.clientes.get(id)) ?? null, [id]);
  const interacoes = useLiveQuery(
    async () =>
      (await db.interacoes.where("clienteId").equals(id).toArray()).sort((a, b) =>
        b.data.localeCompare(a.data),
      ),
    [id],
  );
  const pedidos = useLiveQuery(
    async () =>
      (await db.pedidos.where("clienteId").equals(id).toArray()).sort((a, b) =>
        b.data.localeCompare(a.data),
      ),
    [id],
  );
  const tarefas = useLiveQuery(
    async () =>
      (await db.tarefas.where("clienteId").equals(id).toArray())
        .filter((t) => !t.concluida)
        .sort((a, b) => a.vencimentoEm.localeCompare(b.vencimentoEm)),
    [id],
  );
  const notas = useLiveQuery(
    async () =>
      (await db.notas.where("clienteId").equals(id).toArray()).sort((a, b) =>
        b.criadoEm.localeCompare(a.criadoEm),
      ),
    [id],
  );

  const totalComprado = useMemo(
    () =>
      (pedidos ?? [])
        .filter((p) => p.status !== "cancelado")
        .reduce((s, p) => s + p.valorTotal, 0),
    [pedidos],
  );

  if (cliente === undefined) {
    return <p className="p-8 text-center text-tinta-fraca">Carregando…</p>;
  }

  if (cliente === null) {
    return (
      <main className="p-6 text-center">
        <p className="font-semibold">Cliente não encontrado.</p>
        <Link href="/clientes" className="mt-3 inline-block font-bold text-marca underline">
          Voltar para a lista
        </Link>
      </main>
    );
  }

  const dias = cliente.ultimoContatoEm ? diasDesde(cliente.ultimoContatoEm) : null;
  const temGps = cliente.lat != null && cliente.lng != null;

  async function mudarEstagio(novo: Estagio) {
    await atualizarCliente(id, { estagio: novo });
    avisar(`Estágio: ${LABEL_ESTAGIO[novo]}`);
  }

  async function reabrir() {
    await atualizarCliente(id, { status: "ativo" });
    avisar("Cliente reaberto.");
  }

  return (
    <main>
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/95 px-4 py-3 backdrop-blur">
        <div className="flex items-start gap-2">
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => roteador.back()}
            className="w-8 shrink-0 text-left text-xl font-bold"
          >
            ←
          </button>
          <span aria-hidden className="text-2xl">
            {ICONE_TIPO_CLIENTE[cliente.tipo]}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight">{cliente.nome}</h1>
            <p className="text-sm text-tinta-fraca">
              {LABEL_TIPO_CLIENTE[cliente.tipo]} · {LABEL_FUNIL[cliente.funil]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditarAberto(true)}
            className="shrink-0 text-sm font-semibold text-marca underline"
          >
            Editar
          </button>
        </div>
      </header>

      <div className="space-y-3 px-4 py-3">
        {/* --- Próximo passo em destaque --- */}
        {cliente.status !== "ativo" ? (
          <section className="rounded-xl border border-borda border-l-4 border-l-perigo bg-carta p-4">
            <p className="font-bold text-perigo">
              {LABEL_STATUS_CLIENTE[cliente.status]}
            </p>
            <button
              type="button"
              onClick={reabrir}
              className="mt-2 min-h-11 rounded-lg border border-borda px-4 font-semibold"
            >
              Reabrir cliente
            </button>
          </section>
        ) : (tarefas ?? []).length > 0 ? (
          <section className="rounded-xl border border-borda border-l-4 border-l-marca bg-carta p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-tinta-fraca">
              Próximo passo
            </h2>
            <ul className="mt-1 space-y-2">
              {(tarefas ?? []).map((t) => (
                <li key={t.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Concluir: ${t.titulo}`}
                    onChange={() => alternarTarefa(t.id)}
                    className="mt-1 h-5 w-5 shrink-0 accent-marca"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t.titulo}</span>
                    <span className="block text-sm text-tinta-fraca">
                      {LABEL_ORIGEM_TAREFA[t.origem]} · {fmtPrazo(t.vencimentoEm)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="rounded-xl border border-borda border-l-4 border-l-alerta bg-carta p-4">
            <p className="font-semibold text-alerta">Sem próximo passo definido.</p>
            <p className="mt-0.5 text-sm text-tinta-fraca">
              Registre uma interação para reabrir a cobrança.
            </p>
          </section>
        )}

        {/* --- Ações --- */}
        <div className="flex gap-2">
          {cliente.telefone && (
            <a href={linkLigar(cliente.telefone)} className={acao}>
              📞 Ligar
            </a>
          )}
          {cliente.telefone && (
            <a
              href={linkWhatsApp(cliente.telefone)}
              target="_blank"
              rel="noopener noreferrer"
              className={acao}
            >
              💬 WhatsApp
            </a>
          )}
          {temGps && (
            <a
              href={linkWaze(cliente.lat!, cliente.lng!)}
              target="_blank"
              rel="noopener noreferrer"
              className={acao}
            >
              🚗 Waze
            </a>
          )}
          {temGps && (
            <a
              href={linkGoogleMaps(cliente.lat!, cliente.lng!)}
              target="_blank"
              rel="noopener noreferrer"
              className={acao}
            >
              🗺️ Maps
            </a>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRegistroAberto(true)}
            className="min-h-12 flex-1 rounded-lg bg-marca font-bold text-white active:bg-marca-forte"
          >
            Registrar interação
          </button>
          <Link
            href={`/vendas?cliente=${cliente.id}`}
            className="flex min-h-12 flex-1 items-center justify-center rounded-lg border border-borda bg-carta font-bold"
          >
            Lançar pedido
          </Link>
        </div>

        {/* --- Estágio --- */}
        <section className="rounded-xl border border-borda bg-carta p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-tinta-fraca">
            Estágio — funil {LABEL_FUNIL[cliente.funil].toLowerCase()}
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {estagiosDoFunil(cliente.funil).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => mudarEstagio(s)}
                className={`rounded-full px-3 py-2 text-sm font-semibold ${
                  cliente.estagio === s
                    ? "bg-marca text-white"
                    : "border border-borda bg-fundo"
                }`}
              >
                {LABEL_ESTAGIO[s]}
              </button>
            ))}
          </div>
        </section>

        {/* --- Dados --- */}
        <section className="rounded-xl border border-borda bg-carta p-4 text-sm">
          <dl className="space-y-1">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-tinta-fraca">Endereço</dt>
              <dd className="min-w-0">
                {cliente.endereco || "—"}
                {cliente.bairro && `, ${cliente.bairro}`}
                <br />
                {cliente.cidade}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-tinta-fraca">Telefone</dt>
              <dd>{cliente.telefone || "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-tinta-fraca">Contato</dt>
              <dd>
                {cliente.contatoPrincipal?.nome
                  ? `${cliente.contatoPrincipal.nome}${
                      cliente.contatoPrincipal.cargo
                        ? ` — ${cliente.contatoPrincipal.cargo}`
                        : ""
                    }`
                  : "—"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-tinta-fraca">Último contato</dt>
              <dd>
                {cliente.ultimoContatoEm ? (
                  <>
                    {fmtRelativo(cliente.ultimoContatoEm)}
                    {dias !== null && dias > 21 && (
                      <span className="ml-1 font-bold text-perigo">({dias} d)</span>
                    )}
                  </>
                ) : (
                  "nunca visitado"
                )}
              </dd>
            </div>
            {!temGps && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-tinta-fraca">Localização</dt>
                <dd className="text-alerta">
                  sem GPS — fora do mapa e da ordenação por proximidade
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* --- Pedidos --- */}
        {(pedidos ?? []).length > 0 && (
          <section className="rounded-xl border border-borda bg-carta p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-tinta-fraca">
                Pedidos
              </h2>
              <span className="font-bold">{fmtMoeda(totalComprado)}</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {(pedidos ?? []).map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-2">
                  <span>{fmtData(p.data)}</span>
                  <span className="text-tinta-fraca">{LABEL_STATUS_PEDIDO[p.status]}</span>
                  <span className="font-semibold">{fmtMoeda(p.valorTotal)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* --- Notas --- */}
        {(notas ?? []).length > 0 && (
          <section className="rounded-xl border border-borda bg-carta p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-tinta-fraca">
              Notas
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {(notas ?? []).map((n) => (
                <li key={n.id} className={n.resolvida ? "text-tinta-fraca line-through" : ""}>
                  {n.texto}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* --- Timeline --- */}
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-fraca">
            Histórico ({(interacoes ?? []).length})
          </h2>
          <Timeline interacoes={interacoes ?? []} />
        </section>
      </div>

      {registroAberto && (
        <SheetRegistro
          alvo={{ cliente }}
          aoFechar={() => setRegistroAberto(false)}
          aoSalvo={() => {
            setRegistroAberto(false);
            avisar("Interação registrada.");
          }}
        />
      )}

      {editarAberto && (
        <FormCliente
          inicial={cliente}
          aoFechar={() => setEditarAberto(false)}
          aoSalvo={() => {
            setEditarAberto(false);
            avisar("Cliente atualizado.");
          }}
        />
      )}

      {toast && (
        <p className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-tinta px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </p>
      )}
    </main>
  );
}

export default function Pagina() {
  return (
    <Suspense fallback={null}>
      <Ficha />
    </Suspense>
  );
}
