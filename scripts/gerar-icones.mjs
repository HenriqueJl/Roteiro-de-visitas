/**
 * Gera os ícones do PWA a partir de um SVG desenhado aqui mesmo.
 *
 * Rode com: node scripts/gerar-icones.mjs
 * Só precisa rodar de novo se o desenho do ícone mudar — os PNGs ficam
 * versionados em public/icons/.
 *
 * O símbolo é um roteiro: três paradas ligadas por uma linha ascendente.
 * Sem texto, porque a 48px nenhum texto sobrevive.
 */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const AZUL = "#0b3fa8";
const AZUL_ESCURO = "#082e7d";

/**
 * @param {object} o
 * @param {boolean} o.maskable  Sangra até a borda e encolhe o desenho para a
 *                              zona segura de 80% exigida pelo Android.
 */
function svg({ maskable }) {
  // Na versão maskable o Android recorta em círculo/squircle: o desenho precisa
  // caber num círculo de 80% do lado. 0.62 dá folga confortável.
  const escala = maskable ? 0.62 : 0.78;
  const fundo = maskable
    ? `<rect width="512" height="512" fill="url(#g)"/>`
    : `<rect width="512" height="512" rx="112" ry="112" fill="url(#g)"/>`;

  const desenho = `
    <g stroke="#ffffff" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M 96 400 L 240 296 L 336 344 L 416 128" opacity="0.95"/>
    </g>
    <g fill="#ffffff">
      <circle cx="96"  cy="400" r="38"/>
      <circle cx="240" cy="296" r="38"/>
      <circle cx="336" cy="344" r="38"/>
    </g>
    <g fill="#ffffff">
      <circle cx="416" cy="128" r="54"/>
      <circle cx="416" cy="128" r="22" fill="${AZUL}"/>
    </g>`;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${AZUL}"/>
      <stop offset="1" stop-color="${AZUL_ESCURO}"/>
    </linearGradient>
  </defs>
  ${fundo}
  <g transform="translate(256 256) scale(${escala}) translate(-256 -256)">
    ${desenho}
  </g>
</svg>`);
}

const saidas = [
  { arquivo: "public/icons/icon-192.png", tamanho: 192, maskable: false },
  { arquivo: "public/icons/icon-512.png", tamanho: 512, maskable: false },
  { arquivo: "public/icons/icon-maskable-192.png", tamanho: 192, maskable: true },
  { arquivo: "public/icons/icon-maskable-512.png", tamanho: 512, maskable: true },
  // iOS ignora o manifest e usa esta. Sem transparência, sem cantos próprios.
  { arquivo: "public/icons/apple-touch-icon.png", tamanho: 180, maskable: true },
  // Favicon da aba e do histórico do Chrome.
  { arquivo: "app/icon.png", tamanho: 256, maskable: false },
];

await mkdir("public/icons", { recursive: true });

for (const { arquivo, tamanho, maskable } of saidas) {
  await sharp(svg({ maskable }), { density: 512 })
    .resize(tamanho, tamanho)
    .png({ compressionLevel: 9 })
    .toFile(arquivo);
  console.log(`✓ ${arquivo} (${tamanho}px)`);
}
