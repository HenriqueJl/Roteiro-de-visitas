/**
 * Manipulação de rota do dia — funções puras, testáveis sem banco.
 *
 * A ideia que organiza este arquivo é a **parada fixa**. Depois da primeira
 * semana de rua, algumas visitas deixam de ser sugestão e passam a ser
 * compromisso: "quarta 9h com a enfermeira da CME, ela só tem essa janela".
 * Uma ferramenta que reordena a rota por proximidade e joga esse horário fora
 * é pior que não ter ferramenta — ele perde a reunião.
 *
 * Então tudo aqui respeita `fixa`: reordenar mantém a fixa no lugar dela, e
 * distribuir horários usa a fixa como âncora em vez de sobrescrevê-la.
 */

import { haversineKm, ordenarPorProximidade, type Ponto } from "./geo";

/** O mínimo que estas funções precisam saber de uma parada. */
export interface ParadaBase {
  clienteId: string;
  ordem: number;
  horarioSugerido: string;
  fixa?: boolean;
}

// ---------------------------------------------------------------------------
// Horário
// ---------------------------------------------------------------------------

/** "09:45" -> 585. Devolve null para vazio ou inválido. */
export function paraMinutos(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 585 -> "09:45". Passa da meia-noite volta a contar do zero. */
export function paraHora(minutos: number): string {
  const m = ((minutos % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Preenche os horários na ordem das paradas, a cada `intervaloMin`.
 *
 * Parada fixa não é sobrescrita — ela vira âncora: o relógio salta para o
 * horário dela e segue dali. Assim, marcar "9h com a CME" e distribuir de 30 em
 * 30 põe a próxima às 9h30, não às 9h se ela fosse a segunda da lista.
 */
export function distribuirHorarios<P extends ParadaBase>(
  paradas: P[],
  inicio: string,
  intervaloMin: number,
): P[] {
  const base = paraMinutos(inicio);
  if (base === null || intervaloMin <= 0) return paradas;

  let relogio = base;
  return [...paradas]
    .sort((a, b) => a.ordem - b.ordem)
    .map((p) => {
      if (p.fixa) {
        const fixo = paraMinutos(p.horarioSugerido);
        // Fixa sem horário legível não tem como ancorar nada: segue o relógio.
        if (fixo === null) {
          const atual = relogio;
          relogio += intervaloMin;
          return { ...p, horarioSugerido: paraHora(atual) };
        }
        relogio = fixo + intervaloMin;
        return p;
      }
      const atual = relogio;
      relogio += intervaloMin;
      return { ...p, horarioSugerido: paraHora(atual) };
    });
}

// ---------------------------------------------------------------------------
// Ordem
// ---------------------------------------------------------------------------

/**
 * Reordena por proximidade geográfica, mantendo as fixas onde estão.
 *
 * As posições ocupadas por paradas fixas ficam reservadas; as livres são
 * reordenadas entre si por vizinho mais próximo e preenchem os lugares que
 * sobraram. Parada sem coordenada não entra na conta de distância (não há como
 * medir) e vai para o fim das livres, preservando a ordem relativa que tinha.
 */
export function reordenarPorProximidade<P extends ParadaBase>(
  paradas: P[],
  posicaoDe: (clienteId: string) => Ponto | undefined,
): P[] {
  const lista = [...paradas].sort((a, b) => a.ordem - b.ordem);
  if (lista.length <= 2) return renumerar(lista);

  const livres = lista.filter((p) => !p.fixa);
  if (livres.length <= 1) return renumerar(lista);

  const comGps: (P & Ponto)[] = [];
  const semGps: P[] = [];
  for (const p of livres) {
    const pos = posicaoDe(p.clienteId);
    if (pos) comGps.push({ ...p, lat: pos.lat, lng: pos.lng });
    else semGps.push(p);
  }

  const ordenadas: P[] = [
    ...ordenarPorProximidade(comGps).map(({ lat: _lat, lng: _lng, ...resto }) => resto as unknown as P),
    ...semGps,
  ];

  // Recompõe: cada lugar que era de uma fixa continua sendo dela.
  const fila = [...ordenadas];
  const resultado = lista.map((p) => (p.fixa ? p : fila.shift()!));
  return renumerar(resultado);
}

export function renumerar<P extends { ordem: number }>(paradas: P[]): P[] {
  return paradas.map((p, i) => ({ ...p, ordem: i + 1 }));
}

// ---------------------------------------------------------------------------
// Resumo do dia
// ---------------------------------------------------------------------------

export interface ResumoRota {
  paradas: number;
  /** Quilômetros em linha reta — otimista, ver o cabeçalho de geo.ts. */
  km: number;
  /** Da primeira à última hora sugerida, em minutos. Null se faltar horário. */
  janelaMin: number | null;
  semGps: number;
}

/**
 * Números que ele lê antes de sair: quantas paradas, quanto de estrada, e se o
 * dia cabe nas cinco horas.
 */
export function resumoDaRota<P extends ParadaBase>(
  paradas: P[],
  posicaoDe: (clienteId: string) => Ponto | undefined,
): ResumoRota {
  const lista = [...paradas].sort((a, b) => a.ordem - b.ordem);
  const pontos: Ponto[] = [];
  let semGps = 0;
  for (const p of lista) {
    const pos = posicaoDe(p.clienteId);
    if (pos) pontos.push(pos);
    else semGps += 1;
  }

  let km = 0;
  for (let i = 1; i < pontos.length; i++) km += haversineKm(pontos[i - 1], pontos[i]);

  const horas = lista
    .map((p) => paraMinutos(p.horarioSugerido))
    .filter((m): m is number => m !== null);

  return {
    paradas: lista.length,
    km: Math.round(km * 10) / 10,
    janelaMin: horas.length >= 2 ? Math.max(...horas) - Math.min(...horas) : null,
    semGps,
  };
}
