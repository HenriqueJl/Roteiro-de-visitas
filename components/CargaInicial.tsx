"use client";

import { useEffect } from "react";
import { garantirSeed } from "@/lib/seed";

/**
 * Roda a carga inicial uma vez por abertura do app. É idempotente: se os
 * clientes já estão lá, não faz nada. Não renderiza nada.
 */
export function CargaInicial() {
  useEffect(() => {
    garantirSeed().catch((e) => {
      console.error("Falha na carga inicial:", e);
    });
  }, []);

  return null;
}
