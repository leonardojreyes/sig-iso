import { Alert, Button, Campo, Card, Input, Separador } from '@sig/ui';
import type { Empresa } from '../empresas';
import { es } from '../i18n/es-EC';
import { LogoEmpresa } from './marco';

/** Pantalla plantilla 1/5: inicio de sesión. */
export const PantallaIngreso = ({ empresa }: { empresa: Empresa }) => (
  <main className="flex min-h-screen items-center justify-center bg-bg p-6">
    <Card className="w-full max-w-md p-8">
      <div className="mb-6"><LogoEmpresa empresa={empresa} /></div>
      <h1 className="text-2xl font-semibold text-fg">{es.ingreso.titulo}</h1>
      <p className="mb-6 mt-1 text-sm text-fg-muted">{es.ingreso.subtitulo}</p>
      <Button className="w-full" type="button">{es.ingreso.sso}</Button>
      <div className="my-6 flex items-center gap-3 text-sm text-fg-muted"><Separador className="flex-1" />{es.ingreso.o}<Separador className="flex-1" /></div>
      <form className="flex flex-col gap-4" aria-label={es.ingreso.titulo}>
        <Campo etiqueta={es.ingreso.correo} requerido>{(p) => <Input type="email" autoComplete="username" {...p} />}</Campo>
        <Campo etiqueta={es.ingreso.clave} requerido>{(p) => <Input type="password" autoComplete="current-password" {...p} />}</Campo>
        <Button variante="secondary" type="submit">{es.ingreso.entrar}</Button>
      </form>
      <div className="mt-6"><Alert tono="info" titulo={es.ingreso.nota} /></div>
    </Card>
  </main>
);
