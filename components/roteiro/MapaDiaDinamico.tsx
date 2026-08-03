"use client";

import dynamic from "next/dynamic";

export type { PontoParada } from "./MapaDia";

/**
 * O Leaflet acessa `window` ao ser importado, então o mapa não pode participar
 * do render do servidor. Este wrapper isola o `ssr: false`.
 */
export const MapaDiaDinamico = dynamic(() => import("./MapaDia"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center rounded-xl border border-borda bg-carta text-sm text-tinta-fraca">
      Carregando mapa…
    </div>
  ),
});
