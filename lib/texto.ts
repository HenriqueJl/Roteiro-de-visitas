/**
 * Normalizacao de texto para busca.
 *
 * Na calcada, com o teclado do celular, ninguem digita "Nha" com acento, nem
 * lembra do apostrofo de "Couto's", nem do hifen de "Acacia - Loja 1". A busca
 * precisa achar assim mesmo.
 *
 * `\p{Diacritic}` casa as marcas que o NFD separa das letras. Usado no lugar
 * do intervalo literal U+0300-U+036F porque aqueles caracteres sao invisiveis
 * no editor e somem num copiar-e-colar descuidado.
 */
export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

/** So letras e numeros, sem separador algum: "Couto's Pet" -> "coutospet". */
function compactar(t: string): string {
  return normalizar(t).replace(/ /g, "");
}

/**
 * `agulha` aparece em algum dos campos?
 *
 * Compara em duas formas. A normalizada respeita os limites de palavra; a
 * compacta perdoa a pontuacao que o usuario nao digitou — sem ela, "coutos"
 * nao acha "Couto's Pet", porque o apostrofo vira separador.
 */
export function contemBusca(agulha: string, ...campos: string[]): boolean {
  const q = normalizar(agulha);
  if (!q) return true;
  const qc = compactar(agulha);
  return campos.some((c) => normalizar(c).includes(q) || compactar(c).includes(qc));
}