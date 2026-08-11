"use client";

/**
 * Cria um dia de roteiro do zero — para a semana que o motor não previu: um
 * feriado que empurrou tudo, uma cidade nova a 100 km, um dia extra de rua.
 *
 * A semana é derivada da data, não digitada: um dia rotulado "semana 3" com data
 * da semana 5 quebraria as abas e a contagem do KPI.
 */

import { useState } from "react";
import { criarDiaRoteiro } from "@/lib/api";
import { addDias, diaSemanaDe, fmtDiaExtenso, hoje } from "@/lib/datas";
import { Campo, Sheet, botaoPrimario, entrada } from "@/components/Sheet";

export function NovoDia({
  cidadeSugerida,
  aoFechar,
  aoCriado,
}: {
  cidadeSugerida: string;
  aoFechar: () => void;
  aoCriado: (data: string) => void;
}) {
  const [data, setData] = useState(addDias(hoje(), 1));
  const [cidade, setCidade] = useState(cidadeSugerida);
  const [titulo, setTitulo] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const fimDeSemana = diaSemanaDe(data) === 0;

  async function criar() {
    setSalvando(true);
    setErro("");
    try {
      const r = await criarDiaRoteiro({ data, cidade: cidade.trim(), titulo: titulo.trim() });
      if (r) aoCriado(r.data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Sheet
      titulo="Novo dia de rua"
      aoFechar={aoFechar}
      rodape={
        <>
          <button
            type="button"
            onClick={criar}
            disabled={salvando || fimDeSemana || !cidade.trim()}
            className={botaoPrimario}
          >
            {salvando ? "Criando…" : "Criar dia"}
          </button>
          {erro && <p className="text-center text-sm font-semibold text-perigo">{erro}</p>}
        </>
      }
    >
      <Campo rotulo="Data">
        <input
          type="date"
          value={data}
          onChange={(e) => e.target.value && setData(e.target.value)}
          className={entrada}
        />
        <p className="mt-1 text-xs text-tinta-fraca">
          {fimDeSemana
            ? "O roteiro só prevê segunda a sexta."
            : fmtDiaExtenso(data)}
        </p>
      </Campo>

      <Campo rotulo="Cidade">
        <input value={cidade} onChange={(e) => setCidade(e.target.value)} className={entrada} />
      </Campo>

      <Campo rotulo="Título" dica="Opcional. Ex.: “varredura pet + fechamento”.">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={entrada} />
      </Campo>

      <p className="text-xs text-tinta-fraca">
        O dia nasce vazio. Depois use “Adicionar cliente a este dia” para montar a
        rota.
      </p>
    </Sheet>
  );
}
