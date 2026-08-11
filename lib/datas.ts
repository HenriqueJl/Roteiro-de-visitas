/**
 * Utilidades de data.
 *
 * Regra da casa: dia é `DataCivil` ("AAAA-MM-DD"), momento é `Instante` (ISO).
 * Nunca use `new Date("2026-08-03")` — o JS interpreta isso como meia-noite
 * UTC, que em Brasília cai no dia 2. Use `deCivil`.
 */

import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DataCivil, DiaSemana, Instante } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Converte um `Date` para data civil local. */
export function paraCivil(d: Date): DataCivil {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Interpreta "AAAA-MM-DD" como meia-noite *local*. */
export function deCivil(s: DataCivil): Date {
  const [a, m, d] = s.split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function hoje(): DataCivil {
  return paraCivil(new Date());
}

export function agora(): Instante {
  return new Date().toISOString();
}

export function addDias(s: DataCivil, n: number): DataCivil {
  const d = deCivil(s);
  d.setDate(d.getDate() + n);
  return paraCivil(d);
}

/** Dias de `de` até `ate`. Negativo se `ate` for anterior. */
export function diffDias(de: DataCivil, ate: DataCivil): number {
  const ms = deCivil(ate).getTime() - deCivil(de).getTime();
  return Math.round(ms / 86_400_000);
}

/** Dias decorridos desde um instante até agora. */
export function diasDesde(i: Instante): number {
  return Math.max(0, diffDias(paraCivil(new Date(i)), hoje()));
}

export function estaAtrasada(vencimento: DataCivil): boolean {
  return vencimento < hoje();
}

export function ehHoje(d: DataCivil): boolean {
  return d === hoje();
}

/** Vence hoje ou já passou — a condição de alerta da home. */
export function venceuOuVence(d: DataCivil): boolean {
  return d <= hoje();
}

/** 1=seg … 5=sex. Sábado e domingo viram 0, que o roteiro ignora. */
export function diaSemanaDe(d: DataCivil): DiaSemana | 0 {
  const n = deCivil(d).getDay();
  return n >= 1 && n <= 5 ? (n as DiaSemana) : 0;
}

/** Segunda-feira da semana que contém `d`. */
export function segundaDaSemana(d: DataCivil): DataCivil {
  const dt = deCivil(d);
  const dow = dt.getDay(); // 0=dom
  const recuo = dow === 0 ? 6 : dow - 1;
  return addDias(d, -recuo);
}

/**
 * A próxima segunda-feira — hoje, se hoje já for segunda.
 *
 * É o que ancora o roteiro inicial: as datas do seed não podem ser fixas, senão
 * quem abre o app depois daquela semana encontra um plano vencido.
 */
export function proximaSegunda(base: DataCivil = hoje()): DataCivil {
  const dow = deCivil(base).getDay(); // 0=dom
  if (dow === 1) return base;
  return addDias(base, dow === 0 ? 1 : 8 - dow);
}

/** Os cinco dias úteis a partir de uma segunda-feira. */
export function diasUteisDaSemana(segunda: DataCivil): DataCivil[] {
  return [0, 1, 2, 3, 4].map((i) => addDias(segunda, i));
}

// --- Formatação -----------------------------------------------------------

export function fmt(d: DataCivil, padrao: string): string {
  return format(deCivil(d), padrao, { locale: ptBR });
}

/** "seg, 3 de agosto" */
export function fmtDiaExtenso(d: DataCivil): string {
  return fmt(d, "EEE, d 'de' MMMM");
}

/** "03/08" */
export function fmtCurto(d: DataCivil): string {
  return fmt(d, "dd/MM");
}

/** "03/08/2026" */
export function fmtData(d: DataCivil): string {
  return fmt(d, "dd/MM/yyyy");
}

/** "14:30" a partir de um instante. */
export function fmtHora(i: Instante): string {
  return format(new Date(i), "HH:mm", { locale: ptBR });
}

/** "03/08 14:30" */
export function fmtInstante(i: Instante): string {
  return format(new Date(i), "dd/MM HH:mm", { locale: ptBR });
}

/** "03/08/2026 14:30" — para as exportações, onde o ano não pode faltar. */
export function fmtInstanteCompleto(i: Instante): string {
  return format(new Date(i), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

/** "há 3 dias" */
export function fmtRelativo(i: Instante): string {
  return formatDistanceToNowStrict(new Date(i), {
    locale: ptBR,
    addSuffix: true,
  });
}

/**
 * Texto de prazo para tarefas e amostras: "hoje", "atrasada 3 d", "em 5 d".
 * Curto de propósito — o espaço no card é escasso. `base` existe para as telas
 * que inspecionam outro dia; o padrão é o dia real.
 */
export function fmtPrazo(vencimento: DataCivil, base: DataCivil = hoje()): string {
  const d = diffDias(base, vencimento);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d === -1) return "ontem";
  if (d < 0) return `atrasada ${-d} d`;
  return `em ${d} d`;
}

/** Moeda pt-BR: "R$ 1.234,50". */
export function fmtMoeda(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Atalhos do seletor de data da etapa 3 do registro (seção 6.2). */
export const ATALHOS_DATA: { rotulo: string; dias: number }[] = [
  { rotulo: "Amanhã", dias: 1 },
  { rotulo: "+3 dias", dias: 3 },
  { rotulo: "Próxima semana", dias: 7 },
  { rotulo: "+15 dias", dias: 15 },
];
