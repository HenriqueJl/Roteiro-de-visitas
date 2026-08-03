/**
 * Campo — service worker.
 *
 * Três estratégias, uma por tipo de recurso:
 *
 *   navegação        → rede primeiro, cache como rede de segurança
 *   /_next/static/*  → cache primeiro (os nomes já carregam hash, são imutáveis)
 *   tiles do mapa    → cache primeiro, cache próprio, com teto de tamanho
 *
 * O cache dos tiles é o que faz o mapa sobreviver ao modo avião. Ele é
 * separado do cache do app de propósito: uma atualização da aplicação não deve
 * jogar fora quilômetros de mapa já baixado.
 *
 * Escrito à mão em vez de via next-pwa: são ~120 linhas, e a estratégia dos
 * tiles precisaria de configuração personalizada de qualquer forma.
 */

const VERSAO = "v1";
const CACHE_APP = `campo-app-${VERSAO}`;
const CACHE_TILES = "campo-tiles-v1"; // sobrevive de propósito à troca de VERSAO
const MAX_TILES = 800; // ~25 MB. Cobre Três Corações e Varginha com folga.

const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

const ehTile = (url) =>
  /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname) ||
  /(^|\.)basemaps\.cartocdn\.com$/.test(url.hostname);

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_APP);
      // Um recurso que falha não pode derrubar a instalação inteira — por isso
      // não usamos addAll aqui.
      await Promise.all(SHELL.map((u) => cache.add(u).catch(() => {})));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((n) => n.startsWith("campo-") && n !== CACHE_APP && n !== CACHE_TILES)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (evento) => {
  if (evento.data === "SKIP_WAITING") self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Estratégias
// ---------------------------------------------------------------------------

/** Mantém o cache abaixo do teto. `keys()` devolve em ordem de inserção. */
async function podar(nome, max) {
  const cache = await caches.open(nome);
  const chaves = await cache.keys();
  const excedente = chaves.length - max;
  if (excedente > 0) {
    await Promise.all(chaves.slice(0, excedente).map((c) => cache.delete(c)));
  }
}

/** Quadrado neutro para tile nunca baixado — melhor que o ícone de imagem quebrada. */
function tileVazio() {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">' +
    '<rect width="256" height="256" fill="#e6e8ec"/>' +
    '<path d="M0 0h256v256H0z" fill="none" stroke="#d3d8e0"/>' +
    "</svg>";
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
  });
}

async function tiles(requisicao) {
  const cache = await caches.open(CACHE_TILES);
  const guardado = await cache.match(requisicao);
  if (guardado) return guardado;

  try {
    const resposta = await fetch(requisicao);
    // `opaque` acontece quando o tile vem sem CORS. Dá para guardar, mas ocupa
    // muito mais cota — por isso o TileLayer pede os tiles com crossOrigin.
    if (resposta.ok || resposta.type === "opaque") {
      await cache.put(requisicao, resposta.clone());
      podar(CACHE_TILES, MAX_TILES); // sem await: não segura a resposta
    }
    return resposta;
  } catch {
    return tileVazio();
  }
}

async function redePrimeiro(requisicao) {
  const cache = await caches.open(CACHE_APP);
  try {
    const resposta = await fetch(requisicao);
    if (resposta.ok) cache.put(requisicao, resposta.clone());
    return resposta;
  } catch {
    return (
      (await cache.match(requisicao)) ||
      (await cache.match("/")) ||
      Response.error()
    );
  }
}

async function cachePrimeiro(requisicao) {
  const cache = await caches.open(CACHE_APP);
  const guardado = await cache.match(requisicao);
  if (guardado) return guardado;
  try {
    const resposta = await fetch(requisicao);
    if (resposta.ok) cache.put(requisicao, resposta.clone());
    return resposta;
  } catch {
    return Response.error();
  }
}

/** Responde do cache na hora e atualiza por baixo para a próxima vez. */
async function revalidando(requisicao) {
  const cache = await caches.open(CACHE_APP);
  const guardado = await cache.match(requisicao);
  const rede = fetch(requisicao)
    .then((resposta) => {
      if (resposta.ok) cache.put(requisicao, resposta.clone());
      return resposta;
    })
    .catch(() => null);
  return guardado || (await rede) || Response.error();
}

// ---------------------------------------------------------------------------
// Roteamento
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;
  if (requisicao.method !== "GET") return;

  const url = new URL(requisicao.url);

  if (ehTile(url)) {
    evento.respondWith(tiles(requisicao));
    return;
  }

  // Qualquer outra origem passa direto, sem interceptação.
  if (url.origin !== self.location.origin) return;

  if (requisicao.mode === "navigate") {
    evento.respondWith(redePrimeiro(requisicao));
    return;
  }

  // Payload do App Router: precisa combinar com os chunks em uso, então
  // preferimos a rede e só caímos no cache quando não há sinal.
  if (url.searchParams.has("_rsc")) {
    evento.respondWith(redePrimeiro(requisicao));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    evento.respondWith(cachePrimeiro(requisicao));
    return;
  }

  evento.respondWith(revalidando(requisicao));
});
