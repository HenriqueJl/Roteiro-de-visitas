"use client";

/**
 * Exportação CSV e backup JSON (seção 6.7).
 *
 * Duas decisões de fluxo:
 *
 * 1. Um botão por arquivo, em vez de um "Exportar tudo" que dispara três
 *    downloads. Navegador bloqueia downloads em sequência disparados por um
 *    gesto só, e um bloqueio silencioso aqui significaria backup que ele acha
 *    que fez e não fez.
 * 2. Importar é destrutivo, então acontece em dois tempos: escolher o arquivo
 *    apenas valida e mostra o que tem dentro; a escrita só ocorre depois da
 *    confirmação. Ninguém apaga a base inteira num toque errado.
 */

import { useRef, useState } from "react";
import { db } from "@/lib/db";
import { fmtInstanteCompleto } from "@/lib/datas";
import {
  aplicarBackup,
  baixarCsv,
  baixarJson,
  contarBackup,
  csvClientes,
  csvInteracoes,
  csvPedidos,
  csvTarefas,
  lerBackup,
  montarBackup,
  type Backup,
} from "@/lib/exportar";

type Aviso = { tipo: "ok" | "erro"; texto: string } | null;

export function BlocoBackup() {
  const entrada = useRef<HTMLInputElement>(null);
  const [pendente, setPendente] = useState<Backup | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [ocupado, setOcupado] = useState(false);

  async function exportarCsv(qual: "clientes" | "interacoes" | "pedidos" | "tarefas") {
    try {
      const clientes = await db.clientes.toArray();
      const porId = new Map(clientes.map((c) => [c.id, c]));
      if (qual === "clientes") baixarCsv("clientes", csvClientes(clientes));
      if (qual === "interacoes")
        baixarCsv("interacoes", csvInteracoes(await db.interacoes.toArray(), porId));
      if (qual === "pedidos")
        baixarCsv("pedidos", csvPedidos(await db.pedidos.toArray(), porId));
      if (qual === "tarefas")
        baixarCsv("tarefas", csvTarefas(await db.tarefas.toArray(), porId));
      setAviso({ tipo: "ok", texto: "CSV gerado. Veja em Downloads." });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Falhou: ${(e as Error).message}` });
    }
  }

  async function exportarJson() {
    try {
      const b = await montarBackup();
      baixarJson("backup", b);
      setAviso({
        tipo: "ok",
        texto: `Backup com ${contarBackup(b)} registros salvo em Downloads.`,
      });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Falhou: ${(e as Error).message}` });
    }
  }

  async function escolherArquivo(arq: File | undefined) {
    if (!arq) return;
    setAviso(null);
    try {
      setPendente(lerBackup(await arq.text()));
    } catch (e) {
      setPendente(null);
      setAviso({ tipo: "erro", texto: (e as Error).message });
    }
    // Permite escolher o mesmo arquivo de novo depois de cancelar.
    if (entrada.current) entrada.current.value = "";
  }

  async function confirmarImportacao() {
    if (!pendente) return;
    setOcupado(true);
    try {
      const n = await aplicarBackup(pendente);
      setPendente(null);
      setAviso({ tipo: "ok", texto: `${n} registros restaurados.` });
    } catch (e) {
      setAviso({ tipo: "erro", texto: `Falhou: ${(e as Error).message}` });
    } finally {
      setOcupado(false);
    }
  }

  const botao =
    "rounded-md border border-borda bg-carta px-3 py-2.5 text-sm font-semibold active:bg-fundo";

  return (
    <section className="space-y-3 rounded-lg border border-borda bg-carta p-4">
      <div>
        <h2 className="text-sm font-bold">Exportar CSV</h2>
        <p className="text-xs text-tinta-fraca">Abre no Excel, com acentuação.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={botao} onClick={() => exportarCsv("clientes")}>
          Clientes
        </button>
        <button type="button" className={botao} onClick={() => exportarCsv("interacoes")}>
          Interações
        </button>
        <button type="button" className={botao} onClick={() => exportarCsv("pedidos")}>
          Pedidos
        </button>
        <button type="button" className={botao} onClick={() => exportarCsv("tarefas")}>
          Tarefas
        </button>
      </div>

      <hr className="border-borda" />

      <div>
        <h2 className="text-sm font-bold">Backup completo</h2>
        <p className="text-xs text-tinta-fraca">
          Faça toda sexta. O app não tem servidor — este arquivo é a única cópia
          dos seus dados.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={exportarJson}
          className="rounded-md bg-marca px-3 py-2.5 text-sm font-bold text-white active:bg-marca-forte"
        >
          Exportar JSON
        </button>
        <button
          type="button"
          className={botao}
          onClick={() => entrada.current?.click()}
        >
          Importar JSON…
        </button>
      </div>
      <input
        ref={entrada}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => escolherArquivo(e.target.files?.[0])}
      />

      {/* Confirmação da importação — o arquivo já foi lido e validado. */}
      {pendente && (
        <div className="rounded-md border border-alerta bg-alerta/5 p-3">
          <p className="text-sm font-bold text-alerta">Substituir todos os dados?</p>
          <p className="mt-1 text-xs text-tinta-fraca">
            Backup de{" "}
            {pendente.exportadoEm
              ? fmtInstanteCompleto(pendente.exportadoEm)
              : "data desconhecida"}
            , com {contarBackup(pendente)} registros ({pendente.dados.clientes.length}{" "}
            clientes, {pendente.dados.interacoes.length} interações,{" "}
            {pendente.dados.pedidos.length} pedidos). O que está no aparelho agora
            será apagado.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={confirmarImportacao}
              className="rounded-md bg-perigo px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {ocupado ? "Restaurando…" : "Substituir"}
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => setPendente(null)}
              className={botao}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {aviso && (
        <p
          className={`text-sm font-semibold ${
            aviso.tipo === "ok" ? "text-ok" : "text-perigo"
          }`}
        >
          {aviso.texto}
        </p>
      )}
    </section>
  );
}
