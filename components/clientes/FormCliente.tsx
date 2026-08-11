"use client";

/**
 * Cadastro e edição de cliente. Não está na letra da especificação (seção 6.4
 * só pede lista e ficha), mas um CRM de prospecção sem cadastro morre na
 * primeira semana: ele vai achar porta nova toda hora. Mantido mínimo.
 *
 * Coordenadas vêm do GPS do aparelho, capturadas em pé na porta do lugar —
 * mais preciso que qualquer geocodificação, e funciona offline.
 */

import { useState } from "react";
import { atualizarCliente, criarCliente } from "@/lib/api";
import {
  LABEL_TIPO_CLIENTE,
  TIPOS_CLIENTE,
  type Cliente,
  type TipoCliente,
} from "@/lib/types";

const campo = "w-full rounded-md border border-borda bg-fundo p-3";

export function FormCliente({
  inicial,
  aoFechar,
  aoSalvo,
}: {
  inicial?: Cliente;
  aoFechar: () => void;
  aoSalvo: (id: string) => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [tipo, setTipo] = useState<TipoCliente>(inicial?.tipo ?? "petshop");
  const [cidade, setCidade] = useState(inicial?.cidade ?? "Três Corações");
  const [bairro, setBairro] = useState(inicial?.bairro ?? "");
  const [endereco, setEndereco] = useState(inicial?.endereco ?? "");
  const [telefone, setTelefone] = useState(inicial?.telefone ?? "");
  const [contatoNome, setContatoNome] = useState(inicial?.contatoPrincipal?.nome ?? "");
  const [contatoCargo, setContatoCargo] = useState(inicial?.contatoPrincipal?.cargo ?? "");
  const [lat, setLat] = useState<number | undefined>(inicial?.lat);
  const [lng, setLng] = useState<number | undefined>(inicial?.lng);
  const [gpsEstado, setGpsEstado] = useState<"parado" | "buscando" | "erro">("parado");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  function capturarGps() {
    if (!("geolocation" in navigator)) {
      setGpsEstado("erro");
      return;
    }
    setGpsEstado("buscando");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGpsEstado("parado");
      },
      () => setGpsEstado("erro"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function salvar() {
    if (!nome.trim() || !cidade.trim()) return;
    setSalvando(true);
    setErro("");
    try {
      const dados = {
        nome: nome.trim(),
        tipo,
        cidade: cidade.trim(),
        bairro: bairro.trim(),
        endereco: endereco.trim(),
        telefone: telefone.trim(),
        lat,
        lng,
        contatoPrincipal: contatoNome.trim()
          ? { nome: contatoNome.trim(), cargo: contatoCargo.trim(), telefone: "" }
          : undefined,
      };
      if (inicial) {
        await atualizarCliente(inicial.id, dados);
        aoSalvo(inicial.id);
      } else {
        const novo = await criarCliente(dados);
        aoSalvo(novo.id);
      }
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
          <h2 className="text-lg font-bold">{inicial ? "Editar cliente" : "Novo cliente"}</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={aoFechar}
            className="w-10 text-2xl text-tinta-fraca"
          >
            ×
          </button>
        </header>

        <div className="space-y-3 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div>
            <label className="text-sm font-bold" htmlFor="fc-nome">
              Nome *
            </label>
            <input
              id="fc-nome"
              autoFocus={!inicial}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={`${campo} mt-1`}
            />
          </div>

          <div>
            <label className="text-sm font-bold" htmlFor="fc-tipo">
              Tipo *
            </label>
            <select
              id="fc-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoCliente)}
              className={`${campo} mt-1`}
            >
              {TIPOS_CLIENTE.map((t) => (
                <option key={t} value={t}>
                  {LABEL_TIPO_CLIENTE[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-sm font-bold" htmlFor="fc-cidade">
                Cidade *
              </label>
              <input
                id="fc-cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                list="fc-cidades"
                className={`${campo} mt-1`}
              />
              <datalist id="fc-cidades">
                <option value="Três Corações" />
                <option value="Varginha" />
              </datalist>
            </div>
            <div className="flex-1">
              <label className="text-sm font-bold" htmlFor="fc-bairro">
                Bairro
              </label>
              <input
                id="fc-bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className={`${campo} mt-1`}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold" htmlFor="fc-endereco">
              Endereço
            </label>
            <input
              id="fc-endereco"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className={`${campo} mt-1`}
            />
          </div>

          <div>
            <label className="text-sm font-bold" htmlFor="fc-telefone">
              Telefone
            </label>
            <input
              id="fc-telefone"
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="35999990000"
              className={`${campo} mt-1`}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-sm font-bold" htmlFor="fc-contato">
                Contato
              </label>
              <input
                id="fc-contato"
                value={contatoNome}
                onChange={(e) => setContatoNome(e.target.value)}
                placeholder="Nome"
                className={`${campo} mt-1`}
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-bold" htmlFor="fc-cargo">
                Cargo
              </label>
              <input
                id="fc-cargo"
                value={contatoCargo}
                onChange={(e) => setContatoCargo(e.target.value)}
                placeholder="Dono, enf., compras…"
                className={`${campo} mt-1`}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={capturarGps}
            className="w-full rounded-md border border-borda py-2.5 text-sm font-semibold"
          >
            {gpsEstado === "buscando"
              ? "Buscando sinal…"
              : lat != null
                ? `Localização capturada (${lat.toFixed(5)}, ${lng!.toFixed(5)}) — capturar de novo`
                : "Capturar localização (fique na porta)"}
          </button>
          {gpsEstado === "erro" && (
            <p className="text-center text-sm text-alerta">
              GPS indisponível. Dá para salvar sem — o cliente só fica fora do mapa.
            </p>
          )}

          <button
            type="button"
            onClick={salvar}
            disabled={!nome.trim() || !cidade.trim() || salvando}
            className="w-full rounded-lg bg-marca py-3.5 text-lg font-bold text-white disabled:opacity-40"
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          {erro && <p className="text-center text-sm font-semibold text-perigo">{erro}</p>}
        </div>
      </div>
    </div>
  );
}
