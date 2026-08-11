"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { atualizarCliente } from "@/lib/api";
import { useDados } from "@/components/Dados";
import { CONFIG_PADRAO, type Config } from "@/lib/types";
import { diasDesde } from "@/lib/datas";
import { contemBusca } from "@/lib/texto";
import { FormCliente } from "@/components/clientes/FormCliente";
import { Kanban } from "@/components/clientes/Kanban";
import {
  ESTAGIOS_INSTITUCIONAL,
  ESTAGIOS_VAREJO,
  FUNIS,
  ICONE_TIPO_CLIENTE,
  LABEL_ESTAGIO,
  LABEL_FUNIL,
  LABEL_STATUS_CLIENTE,
  LABEL_TIPO_CLIENTE,
  STATUS_CLIENTE,
  TIPOS_CLIENTE,
  type Estagio,
  type Funil,
} from "@/lib/types";
import { Icone } from "@/lib/icones";

const TODOS = "todos";
const filtro = "min-w-0 flex-1 rounded-md border border-borda bg-carta px-2 py-2 text-sm";

/** Estágios dos dois funis, sem repetição, para o seletor. */
const ESTAGIOS_TODOS = [
  ...new Set<Estagio>([...ESTAGIOS_INSTITUCIONAL, ...ESTAGIOS_VAREJO]),
];

export default function TelaClientes() {
  const roteador = useRouter();
  const [busca, setBusca] = useState("");
  const [cidade, setCidade] = useState(TODOS);
  const [tipo, setTipo] = useState(TODOS);
  const [estagio, setEstagio] = useState(TODOS);
  const [status, setStatus] = useState<string>("ativo");
  const [novoAberto, setNovoAberto] = useState(false);
  const [visao, setVisao] = useState<"lista" | "kanban">("lista");
  // O quadro mostra um funil por vez: as colunas são outras (P5), e empilhar os
  // dois lado a lado daria treze colunas para rolar com o dedo.
  const [funil, setFunil] = useState<Funil>("institucional");

  const dados = useDados();
  const clientes = dados?.clientes;
  const config = useMemo<Config>(
    () => ({
      ...CONFIG_PADRAO,
      ...((dados?.meta.find((m) => m.chave === "config")?.valor as Partial<Config>) ?? {}),
    }),
    [dados],
  );
  const diasAlerta = config.diasSemContatoAlerta;

  const cidades = useMemo(
    () => [...new Set((clientes ?? []).map((c) => c.cidade))].sort(),
    [clientes],
  );

  /** Filtros comuns às duas visões. O estágio fica fora: no quadro ele é a coluna. */
  const base = useMemo(() => {
    return (clientes ?? [])
      .filter(
        (c) =>
          (status === TODOS || c.status === status) &&
          (cidade === TODOS || c.cidade === cidade) &&
          (tipo === TODOS || c.tipo === tipo) &&
          contemBusca(busca, c.nome, c.bairro, c.endereco),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [clientes, busca, cidade, tipo, status]);

  const lista = useMemo(
    () => base.filter((c) => estagio === TODOS || c.estagio === estagio),
    [base, estagio],
  );

  const doQuadro = useMemo(() => base.filter((c) => c.funil === funil), [base, funil]);

  return (
    <main>
      <header className="sticky top-0 z-30 space-y-2 border-b border-borda bg-fundo/95 px-4 py-3 backdrop-blur">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold">Clientes</h1>
          <span className="text-sm text-tinta-fraca">
            {visao === "lista" ? lista.length : doQuadro.length}
          </span>
        </div>

        <div className="flex gap-1.5" role="tablist" aria-label="Visão">
          {(["lista", "kanban"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={visao === v}
              onClick={() => setVisao(v)}
              className={`flex-1 rounded-md py-2 text-sm font-semibold ${
                visao === v
                  ? "bg-marca text-white"
                  : "border border-borda bg-carta text-tinta-fraca"
              }`}
            >
              {v === "lista" ? "Lista" : "Quadro"}
            </button>
          ))}
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, bairro ou endereço"
          className="w-full rounded-md border border-borda bg-carta p-3"
        />
        <div className="flex gap-1.5">
          <select
            aria-label="Filtrar por cidade"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            className={filtro}
          >
            <option value={TODOS}>Cidade</option>
            {cidades.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={filtro}
          >
            <option value={TODOS}>Tipo</option>
            {TIPOS_CLIENTE.map((t) => (
              <option key={t} value={t}>
                {LABEL_TIPO_CLIENTE[t]}
              </option>
            ))}
          </select>
          {/* No quadro, o estágio é a coluna; o que se escolhe ali é o funil,
              porque cada um tem o seu próprio conjunto de colunas (P5). */}
          {visao === "lista" ? (
            <select
              aria-label="Filtrar por estágio"
              value={estagio}
              onChange={(e) => setEstagio(e.target.value)}
              className={filtro}
            >
              <option value={TODOS}>Estágio</option>
              {ESTAGIOS_TODOS.map((s) => (
                <option key={s} value={s}>
                  {LABEL_ESTAGIO[s]}
                </option>
              ))}
            </select>
          ) : (
            <select
              aria-label="Escolher funil"
              value={funil}
              onChange={(e) => setFunil(e.target.value as Funil)}
              className={filtro}
            >
              {FUNIS.map((f) => (
                <option key={f} value={f}>
                  {LABEL_FUNIL[f]}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Filtrar por status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={filtro}
          >
            {STATUS_CLIENTE.map((s) => (
              <option key={s} value={s}>
                {LABEL_STATUS_CLIENTE[s]}
              </option>
            ))}
            <option value={TODOS}>Todos</option>
          </select>
        </div>
      </header>

      {visao === "kanban" && (
        <div className="py-3">
          <Kanban
            clientes={doQuadro}
            funil={funil}
            diasAlerta={diasAlerta}
            aoMover={(id, novo) => atualizarCliente(id, { estagio: novo })}
          />
          <p className="px-4 pt-1 text-xs text-tinta-fraca">
            Use ← → para mudar o estágio. Marcar perdido é feito no registro da
            visita, com motivo.
          </p>
        </div>
      )}

      <ul
        className={`px-2 py-2 md:grid md:grid-cols-2 md:gap-x-4 ${
          visao === "kanban" ? "hidden" : ""
        }`}
      >
        {lista.map((c) => {
          const dias = c.ultimoContatoEm ? diasDesde(c.ultimoContatoEm) : null;
          const esquecido = c.status === "ativo" && dias !== null && dias > diasAlerta;
          const nuncaVisitado = c.status === "ativo" && dias === null;
          return (
            <li key={c.id}>
              <Link
                href={`/clientes/ficha?id=${c.id}`}
                className="flex min-h-14 items-center gap-3 rounded-md px-2 py-2 active:bg-carta"
              >
                <span aria-hidden className="text-xl">
                  <Icone nome={ICONE_TIPO_CLIENTE[c.tipo]} className="text-tinta-fraca" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.nome}</span>
                  <span className="block truncate text-sm text-tinta-fraca">
                    {c.cidade}
                    {c.bairro && ` · ${c.bairro}`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="rounded-md bg-carta px-2 py-0.5 text-xs font-bold text-marca ring-1 ring-borda">
                    {LABEL_ESTAGIO[c.estagio]}
                  </span>
                  {esquecido && (
                    <span className="text-xs font-bold text-perigo">{dias} d sem contato</span>
                  )}
                  {nuncaVisitado && (
                    <span className="text-xs font-semibold text-tinta-fraca">nunca visitado</span>
                  )}
                  {c.status !== "ativo" && (
                    <span className="text-xs font-semibold text-tinta-fraca">
                      {LABEL_STATUS_CLIENTE[c.status]}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
        {lista.length === 0 && clientes !== undefined && (
          <li className="py-10 text-center text-sm text-tinta-fraca">
            Nenhum cliente com esses filtros.
          </li>
        )}
      </ul>

      <button
        type="button"
        onClick={() => setNovoAberto(true)}
        aria-label="Novo cliente"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-marca text-2xl font-bold text-white shadow-lg"
      >
        +
      </button>

      {novoAberto && (
        <FormCliente
          aoFechar={() => setNovoAberto(false)}
          aoSalvo={(id) => {
            setNovoAberto(false);
            roteador.push(`/clientes/ficha?id=${id}`);
          }}
        />
      )}
    </main>
  );
}
