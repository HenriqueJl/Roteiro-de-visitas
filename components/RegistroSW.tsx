"use client";

import { useEffect } from "react";

/**
 * Registra o service worker. Só em produção: em desenvolvimento o Next troca
 * os chunks a cada salvamento e um SW cacheando isso dá tela branca.
 *
 * Para testar o modo offline de verdade: `npm run build && npm start`.
 */
export function RegistroSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => {
      console.error("Service worker não registrou:", e);
    });
  }, []);

  return null;
}
