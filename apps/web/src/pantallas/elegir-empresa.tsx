import { Alert, Button, Card } from '@sig/ui';
import type { EmpresaDePersona } from '../api/tipos';
import type { AvisoCambio } from '../cambio-empresa/cambiar';
import { es } from '../i18n/es-EC';
import { MARCA_GENERICA } from '../marca/generica';
import { AvisoEnfocado } from './aviso-enfocado';
import { LogoEmpresa } from './marco';

/**
 * Pantalla al entrar para quien pertenece a varias empresas (ADR 035): elige con cuál va a trabajar antes de ver nada. Cada empresa es
 * un formulario con un solo dato, su slug; la API decide si la persona pertenece a ella. No lleva identificadores internos.
 */
export const PantallaEleccionEmpresa = ({ empresas, aviso = null }: { empresas: readonly EmpresaDePersona[]; aviso?: AvisoCambio | null }) => (
  <main className="flex min-h-screen items-center justify-center bg-bg p-6">
    <Card className="w-full max-w-md p-8">
      <div className="mb-6">
        <LogoEmpresa empresa={MARCA_GENERICA} />
      </div>
      <h1 className="text-2xl font-semibold text-fg">{es.eleccion.titulo}</h1>
      <p className="mb-4 mt-2 text-sm text-fg-muted">{es.eleccion.ayuda}</p>
      {aviso && (
        <AvisoEnfocado etiqueta={es.app.aviso}>
          <Alert tono={es.empresas.avisos[aviso].tono} titulo={es.empresas.avisos[aviso].titulo}>
            {es.empresas.avisos[aviso].detalle}
          </Alert>
        </AvisoEnfocado>
      )}
      <ul aria-label={es.eleccion.lista} className="flex flex-col gap-3">
        {empresas.map((e) => (
          <li key={e.slug}>
            <form method="post" action="/empresas/elegir">
              <input type="hidden" name="empresa" value={e.slug} />
              <Button type="submit" className="w-full" aria-label={es.eleccion.entrar(e.nombre)}>
                {e.nombre}
              </Button>
            </form>
          </li>
        ))}
      </ul>
      <form method="post" action="/auth/logout" className="mt-6">
        <Button type="submit" variante="secondary" className="w-full">
          {es.sesion.cerrar}
        </Button>
      </form>
    </Card>
  </main>
);
