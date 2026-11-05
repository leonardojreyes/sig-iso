import { Card } from '@sig/ui';
import { empresas } from '../src/empresas';
import { es } from '../src/i18n/es-EC';
import { LogoEmpresa } from '../src/pantallas/marco';

export default function Inicio() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-semibold text-fg">{es.app.nombre}</h1>
      <p className="mt-1 text-fg-muted">{es.app.lema}</p>
      <h2 className="mb-2 mt-10 text-xl font-semibold text-fg">{es.inicio.titulo}</h2>
      <p className="mb-6 text-fg-muted">{es.inicio.descripcion}</p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {Object.values(empresas).map((e) => (
          <li key={e.id} data-empresa={e.id}>
            <Card>
              <LogoEmpresa empresa={e} />
              <p className="mb-3 mt-4 text-sm text-fg-muted">{es.inicio.entrar}</p>
              <a className="font-medium text-primary underline-offset-2 hover:underline" href={`/e/${e.id}/ingreso`}>{es.ingreso.titulo}</a>
              {' · '}
              <a className="font-medium text-primary underline-offset-2 hover:underline" href={`/e/${e.id}/panel`}>{es.nav.panel}</a>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
