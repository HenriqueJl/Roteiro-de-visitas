"use client";

/**
 * Aviso passageiro ("Dia copiado.", "3 paradas trocaram de lugar.").
 *
 * Existia em cinco telas, copiado, e as cinco tinham o mesmo defeito: o
 * `setTimeout` do aviso anterior não era cancelado. Dois avisos em sequência —
 * distribuir horários e depois reordenar, coisa de dois toques — e o segundo
 * desaparecia quando o relógio do primeiro vencia, às vezes meio segundo depois
 * de aparecer. O `ref` guarda o timer para poder cancelá-lo.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export function useAviso(duracaoMs = 2500) {
  const [aviso, setAviso] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const avisar = useCallback(
    (texto: string) => {
      if (timer.current) clearTimeout(timer.current);
      setAviso(texto);
      timer.current = setTimeout(() => setAviso(""), duracaoMs);
    },
    [duracaoMs],
  );

  // Desmontar no meio do aviso não pode deixar o timer tentando escrever depois.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { aviso, avisar };
}

export function Aviso({ texto }: { texto: string }) {
  if (!texto) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 z-[600] max-w-[92vw] -translate-x-1/2 rounded-md bg-tinta px-4 py-2 text-center text-sm font-semibold text-white shadow-lg"
    >
      {texto}
    </p>
  );
}
