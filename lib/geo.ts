/**
 * Geometria de rota.
 *
 * Haversine é distância em linha reta, não distância de rua — sempre otimista.
 * Serve para ordenar paradas e dar noção de tamanho do dia; não serve para
 * prometer horário de chegada.
 */

export interface Ponto {
  lat: number;
  lng: number;
}

const RAIO_TERRA_KM = 6371;
const rad = (g: number) => (g * Math.PI) / 180;

export function haversineKm(a: Ponto, b: Ponto): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(s));
}

/** Soma dos trechos, na ordem dada. */
export function distanciaDaRota(pontos: Ponto[]): number {
  let total = 0;
  for (let i = 1; i < pontos.length; i++) total += haversineKm(pontos[i - 1], pontos[i]);
  return total;
}

/**
 * Vizinho mais próximo a partir do primeiro item — o que a seção 7 pede.
 * Não é o caixeiro-viajante ótimo, e não precisa ser: com 6 paradas dentro de
 * uma cidade, a diferença para o ótimo é de poucos minutos.
 */
export function ordenarPorProximidade<T extends Ponto>(itens: T[]): T[] {
  if (itens.length <= 2) return [...itens];
  const restantes = [...itens];
  const ordenado = [restantes.shift()!];
  while (restantes.length) {
    const atual = ordenado[ordenado.length - 1];
    let melhor = 0;
    let melhorDist = Infinity;
    for (let i = 0; i < restantes.length; i++) {
      const d = haversineKm(atual, restantes[i]);
      if (d < melhorDist) {
        melhorDist = d;
        melhor = i;
      }
    }
    ordenado.push(restantes.splice(melhor, 1)[0]);
  }
  return ordenado;
}

/** Centro geográfico simples, para posicionar o mapa. */
export function centroDe(pontos: Ponto[]): Ponto {
  if (pontos.length === 0) return { lat: -21.6959, lng: -45.2561 }; // Três Corações
  const s = pontos.reduce((a, p) => ({ lat: a.lat + p.lat, lng: a.lng + p.lng }), {
    lat: 0,
    lng: 0,
  });
  return { lat: s.lat / pontos.length, lng: s.lng / pontos.length };
}
