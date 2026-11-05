// Página de inicio provisional; el look and feel real llega en el paso 0.5.
type Norma = { codigo: string; nombre: string; edicion: string };

async function cargarNormas(): Promise<Norma[] | null> {
  try {
    const res = await fetch(`http://localhost:${process.env.API_PORT ?? 3001}/normas`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as Norma[]) : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const normas = await cargarNormas();
  return (
    <main style={{ maxWidth: 720, margin: '4rem auto', padding: '0 1rem' }}>
      <h1 style={{ color: '#0E5C42' }}>sig-iso</h1>
      <p>Sistema de Gestión Integrado ISO — SynapTech. Esqueleto de la Fase 0 (paso 0.2).</p>
      <h2>Normas de la v1 (datos de ejemplo desde la API)</h2>
      {normas ? (
        <ul>
          {normas.map((n) => (
            <li key={n.codigo}>
              <strong>{n.codigo}:{n.edicion}</strong> — {n.nombre}
            </li>
          ))}
        </ul>
      ) : (
        <p>No se pudo contactar la API en el puerto 3001. Ejecute <code>pnpm dev</code>.</p>
      )}
    </main>
  );
}
