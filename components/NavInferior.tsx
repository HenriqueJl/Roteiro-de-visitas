"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icone } from "@/lib/icones";

const ABAS = [
  { href: "/", icone: "hoje", rotulo: "Hoje" },
  { href: "/roteiro", icone: "roteiro", rotulo: "Roteiro" },
  { href: "/clientes", icone: "clientes", rotulo: "Clientes" },
  { href: "/vendas", icone: "vendas", rotulo: "Vendas" },
  { href: "/notas", icone: "notas", rotulo: "Notas" },
  { href: "/kpi", icone: "kpi", rotulo: "KPI" },
] as const;

export function NavInferior() {
  const rota = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-carta pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md md:max-w-5xl">
        {ABAS.map((a) => {
          const ativa = a.href === "/" ? rota === "/" : rota.startsWith(a.href);
          return (
            <Link
              key={a.href}
              href={a.href}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
                ativa ? "text-marca" : "text-tinta-fraca"
              }`}
            >
              <Icone nome={a.icone} tamanho={21} />
              {a.rotulo}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
