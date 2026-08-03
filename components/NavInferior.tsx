"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/", icone: "🏠", rotulo: "Hoje" },
  { href: "/roteiro", icone: "🗺️", rotulo: "Roteiro" },
  { href: "/clientes", icone: "👥", rotulo: "Clientes" },
  { href: "/vendas", icone: "💰", rotulo: "Vendas" },
  { href: "/notas", icone: "📝", rotulo: "Notas" },
  { href: "/kpi", icone: "📊", rotulo: "KPI" },
] as const;

export function NavInferior() {
  const rota = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-carta pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md">
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
              <span aria-hidden className="text-lg leading-none">
                {a.icone}
              </span>
              {a.rotulo}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
