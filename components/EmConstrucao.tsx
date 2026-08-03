/** Marcador temporário das telas ainda não construídas. Some ao fim da obra. */
export function EmConstrucao({ titulo, etapa }: { titulo: string; etapa: number }) {
  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">{titulo}</h1>
      <p className="mt-2 text-sm text-tinta-fraca">Entra na etapa {etapa} da construção.</p>
    </main>
  );
}
